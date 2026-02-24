use std::io::{Read, Write};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::protocol::HipnucDecoder;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
}

/// List available serial ports
#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let port_type = match &p.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    format!(
                        "USB VID:{:04X} PID:{:04X}{}",
                        info.vid,
                        info.pid,
                        info.product
                            .as_ref()
                            .map(|s| format!(" ({})", s))
                            .unwrap_or_default()
                    )
                }
                serialport::SerialPortType::BluetoothPort => "Bluetooth".to_string(),
                serialport::SerialPortType::PciPort => "PCI".to_string(),
                serialport::SerialPortType::Unknown => "Unknown".to_string(),
            };
            PortInfo {
                name: p.port_name,
                port_type,
            }
        })
        .collect())
}

/// Open serial port and start reading data in a background thread
#[tauri::command]
pub fn open_port(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    port_name: String,
    baud_rate: u32,
) -> Result<(), String> {
    // Close existing port if any
    {
        state.read_running.store(false, Ordering::SeqCst);
        let mut port_lock = state.port.lock().map_err(|e| e.to_string())?;
        *port_lock = None;
        // Brief pause to let old read thread exit
        std::thread::sleep(Duration::from_millis(100));
    }

    // Open new port
    let port = serialport::new(&port_name, baud_rate)
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::One)
        .flow_control(serialport::FlowControl::None)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| format!("Failed to open {}: {}", port_name, e))?;

    // Clone port for the read thread
    let read_port = port.try_clone().map_err(|e| e.to_string())?;

    // Store the port
    {
        let mut port_lock = state.port.lock().map_err(|e| e.to_string())?;
        *port_lock = Some(port);
    }

    // Reset decoder
    {
        let mut decoder = state.decoder.lock().map_err(|e| e.to_string())?;
        *decoder = HipnucDecoder::new();
    }

    // Start read thread
    let running = Arc::clone(&state.read_running);
    running.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        read_thread(read_port, running, app);
    });

    log::info!("Opened port {} at {} baud", port_name, baud_rate);
    Ok(())
}

/// Background thread that reads serial data and emits parsed IMU events
fn read_thread(
    mut port: Box<dyn serialport::SerialPort>,
    running: Arc<std::sync::atomic::AtomicBool>,
    app: AppHandle,
) {
    let mut buf = [0u8; 256];
    let mut decoder = HipnucDecoder::new();

    while running.load(Ordering::SeqCst) {
        match port.read(&mut buf) {
            Ok(n) if n > 0 => {
                let packets = decoder.input_bytes(&buf[..n]);
                for packet in packets {
                    if let Err(e) = app.emit("imu-data", &packet) {
                        log::error!("Failed to emit imu-data event: {}", e);
                    }
                }
            }
            Ok(_) => {
                // No data, continue
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                // Normal timeout, continue reading
            }
            Err(e) => {
                log::error!("Serial read error: {}", e);
                let _ = app.emit("serial-error", e.to_string());
                break;
            }
        }
    }

    log::info!("Read thread exiting");
}

/// Close serial port
#[tauri::command]
pub fn close_port(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.read_running.store(false, Ordering::SeqCst);
    // Brief pause to let read thread exit
    std::thread::sleep(Duration::from_millis(150));

    let mut port_lock = state.port.lock().map_err(|e| e.to_string())?;
    *port_lock = None;

    log::info!("Port closed");
    Ok(())
}

/// Send a command string to the device (appends \r\n)
#[tauri::command]
pub fn send_command(
    state: tauri::State<'_, AppState>,
    command: String,
) -> Result<(), String> {
    let mut port_lock = state.port.lock().map_err(|e| e.to_string())?;
    let port = port_lock
        .as_mut()
        .ok_or("Port not open")?;

    let cmd = format!("{}\r\n", command);
    port.write_all(cmd.as_bytes())
        .map_err(|e| format!("Write failed: {}", e))?;
    port.flush()
        .map_err(|e| format!("Flush failed: {}", e))?;

    log::info!("Sent command: {}", command);
    Ok(())
}

/// Start recording data to CSV
#[tauri::command]
pub fn start_recording(
    state: tauri::State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    let file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    let mut writer = std::io::BufWriter::new(file);

    // Write CSV header
    writeln!(
        writer,
        "timestamp_ms,acc_x,acc_y,acc_z,gyr_x,gyr_y,gyr_z,mag_x,mag_y,mag_z,roll,pitch,yaw,qw,qx,qy,qz,temperature,air_pressure"
    )
    .map_err(|e| e.to_string())?;

    let mut csv = state.csv_writer.lock().map_err(|e| e.to_string())?;
    *csv = Some(writer);

    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    *rec = true;

    Ok(())
}

/// Stop recording
#[tauri::command]
pub fn stop_recording(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    *rec = false;

    let mut csv = state.csv_writer.lock().map_err(|e| e.to_string())?;
    *csv = None;

    Ok(())
}

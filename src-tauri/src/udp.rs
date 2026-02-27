use std::net::UdpSocket;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::motor_protocol::{self, CAN_FRAME_SIZE};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpConfig {
    pub gateway_ip: String,
    pub gateway_port: u16,
    pub local_port: u16,
    pub motor_id: u8,
    pub master_id: u8,
}

impl Default for UdpConfig {
    fn default() -> Self {
        Self {
            gateway_ip: "192.168.0.7".to_string(),
            gateway_port: 20001,
            local_port: 20001,
            motor_id: 127,
            master_id: 253,
        }
    }
}

/// CAN frame log entry sent to frontend
#[derive(Debug, Clone, Serialize)]
pub struct CanFrameLog {
    pub direction: String, // "tx" or "rx"
    pub can_id: u32,
    pub is_extended: bool,
    pub data: Vec<u8>,
    pub timestamp_ms: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Connect to CAN-ETH gateway via UDP
#[tauri::command]
pub fn udp_connect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    config: UdpConfig,
) -> Result<(), String> {
    // Close existing connection
    {
        state.udp_running.store(false, Ordering::SeqCst);
        let mut sock = state.udp_socket.lock().map_err(|e| e.to_string())?;
        *sock = None;
        std::thread::sleep(Duration::from_millis(50));
    }

    // Bind local socket
    let bind_addr = format!("0.0.0.0:{}", config.local_port);
    let socket = UdpSocket::bind(&bind_addr)
        .map_err(|e| format!("Failed to bind UDP socket on {}: {}", bind_addr, e))?;

    socket
        .set_read_timeout(Some(Duration::from_millis(100)))
        .map_err(|e| e.to_string())?;

    let remote_addr = format!("{}:{}", config.gateway_ip, config.gateway_port);

    socket
        .connect(&remote_addr)
        .map_err(|e| format!("Failed to connect to {}: {}", remote_addr, e))?;

    let recv_socket = socket
        .try_clone()
        .map_err(|e| format!("Failed to clone socket: {}", e))?;

    {
        let mut sock = state.udp_socket.lock().map_err(|e| e.to_string())?;
        *sock = Some(socket);
    }
    {
        let mut cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
        *cfg = config.clone();
    }

    let running = Arc::clone(&state.udp_running);
    running.store(true, Ordering::SeqCst);

    let master_id = config.master_id;

    std::thread::spawn(move || {
        udp_recv_thread(recv_socket, running, app, master_id);
    });

    log::info!("UDP connected to {}", remote_addr);
    Ok(())
}

/// Background thread that receives UDP packets and parses CAN frames
fn udp_recv_thread(
    socket: UdpSocket,
    running: Arc<std::sync::atomic::AtomicBool>,
    app: AppHandle,
    master_id: u8,
) {
    let mut buf = [0u8; 1024];

    while running.load(Ordering::SeqCst) {
        match socket.recv(&mut buf) {
            Ok(n) if n >= CAN_FRAME_SIZE => {
                let frame_count = n / CAN_FRAME_SIZE;
                for i in 0..frame_count {
                    let offset = i * CAN_FRAME_SIZE;
                    let mut frame_bytes = [0u8; CAN_FRAME_SIZE];
                    frame_bytes.copy_from_slice(&buf[offset..offset + CAN_FRAME_SIZE]);

                    let (frame_info, can_id, data) = motor_protocol::parse_can_frame(&frame_bytes);
                    let is_extended = motor_protocol::is_extended_data_frame(frame_info);

                    // Log raw frame
                    let log_entry = CanFrameLog {
                        direction: "rx".to_string(),
                        can_id,
                        is_extended,
                        data: data.to_vec(),
                        timestamp_ms: now_ms(),
                    };
                    let _ = app.emit("can-frame-log", &log_entry);

                    if motor_protocol::is_standard_data_frame(frame_info) {
                        // MIT protocol standard frame response
                        let mode = (can_id >> 8) & 0x07;
                        let id_field = (can_id & 0xFF) as u8;

                        // Response command 1: mode=0, id=master_id
                        if mode == 0 && id_field == master_id {
                            let feedback = motor_protocol::decode_feedback(&data);
                            let _ = app.emit("motor-feedback", &feedback);
                        }
                    } else if is_extended {
                        // Private protocol extended frame response
                        let (comm_type, data_area2, _target_id) =
                            motor_protocol::parse_ext_can_id(can_id);

                        match comm_type {
                            0 => {
                                // Type 0 response: device ID (64-bit MCU identifier)
                                // data_area2 low byte = motor's CAN ID
                                let responding_id = (data_area2 & 0xFF) as u8;
                                // Format 64-bit MCU ID as hex string
                                let device_id_hex: String = data.iter()
                                    .map(|b| format!("{:02X}", b))
                                    .collect::<Vec<_>>()
                                    .join("");
                                let device_info = serde_json::json!({
                                    "motor_id": responding_id,
                                    "device_id": device_id_hex,
                                });
                                let _ = app.emit("motor-device-info", &device_info);
                                let _ = app.emit("motor-scan-result", responding_id);
                            }
                            2 => {
                                // Type 2: Private protocol feedback
                                // Check for version response signature: Byte0=0x00, Byte1=0xC4, Byte2=0x56
                                if data[0] == 0x00 && data[1] == 0xC4 && data[2] == 0x56 {
                                    // Version response: Byte3~6 = firmware version (high to low)
                                    let version_str = format!("{}.{}.{}.{}", data[3], data[4], data[5], data[6]);
                                    let motor_id_resp = (data_area2 & 0xFF) as u8;
                                    let version_info = serde_json::json!({
                                        "motor_id": motor_id_resp,
                                        "version": version_str,
                                    });
                                    let _ = app.emit("motor-version-info", &version_info);
                                } else {
                                    let fb = motor_protocol::decode_private_feedback(data_area2, &data);
                                    let _ = app.emit("motor-feedback", &motor_protocol::MotorFeedback {
                                        motor_id: fb.motor_id,
                                        angle: fb.angle,
                                        velocity: fb.velocity,
                                        torque: fb.torque,
                                        temperature: fb.temperature,
                                    });
                                    let _ = app.emit("motor-private-feedback", &fb);
                                }
                            }
                            0x11 => {
                                // Type 17: Parameter read response
                                let resp = motor_protocol::decode_param_read_response(data_area2, &data);
                                let _ = app.emit("motor-param-read", &resp);
                            }
                            0x04 => {
                                // Type 4: Stop response (no special handling needed)
                                // Version query response comes via type 2, not type 4
                            }
                            0x15 => {
                                // Type 21: Fault feedback
                                let fault_word = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
                                let fault_status = motor_protocol::decode_faults(fault_word);
                                let _ = app.emit("motor-fault-status", &fault_status);
                            }
                            0x18 => {
                                // Type 24 response: same as type 2 feedback format
                                let fb = motor_protocol::decode_private_feedback(data_area2, &data);
                                let _ = app.emit("motor-private-feedback", &fb);
                            }
                            _ => {
                                // Other responses are logged via can-frame-log
                            }
                        }
                    }
                }
            }
            Ok(_) => {}
            Err(ref e)
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                // Normal timeout
            }
            Err(ref e) if e.raw_os_error() == Some(10054) => {
                // Windows WSAECONNRESET: ICMP port unreachable from previous send.
                // This is normal for connected UDP sockets on Windows — ignore and continue.
                log::warn!("UDP ICMP port unreachable (10054) — gateway may not be listening on the configured port");
                let _ = app.emit("udp-warning", "ICMP port unreachable (10054): gateway may not be listening. Check gateway IP/port and UDP mode.".to_string());
            }
            Err(e) => {
                log::error!("UDP recv error: {}", e);
                let _ = app.emit("udp-error", e.to_string());
                break;
            }
        }
    }

    log::info!("UDP recv thread exiting");
}

/// Disconnect UDP
#[tauri::command]
pub fn udp_disconnect(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.udp_running.store(false, Ordering::SeqCst);
    std::thread::sleep(Duration::from_millis(100));

    let mut sock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    *sock = None;

    log::info!("UDP disconnected");
    Ok(())
}

/// Update motor_id and master_id in the live config without reconnecting
#[tauri::command]
pub fn udp_update_motor_ids(
    state: tauri::State<'_, AppState>,
    motor_id: u8,
    master_id: u8,
) -> Result<(), String> {
    let mut cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    cfg.motor_id = motor_id;
    cfg.master_id = master_id;
    log::info!("Updated motor_id={}, master_id={}", motor_id, master_id);
    Ok(())
}

// ── Internal send helpers ───────────────────────────────────────────

/// Send a standard CAN frame (11-bit ID)
fn send_std_frame(
    state: &AppState,
    app: &AppHandle,
    can_id: u16,
    data: &[u8; 8],
) -> Result<(), String> {
    let frame = motor_protocol::build_can_frame(can_id, data);

    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;
    socket
        .send(&frame)
        .map_err(|e| format!("UDP send failed: {}", e))?;

    let log_entry = CanFrameLog {
        direction: "tx".to_string(),
        can_id: can_id as u32,
        is_extended: false,
        data: data.to_vec(),
        timestamp_ms: now_ms(),
    };
    let _ = app.emit("can-frame-log", &log_entry);

    Ok(())
}

/// Send an extended CAN frame (29-bit ID)
fn send_ext_frame(
    state: &AppState,
    app: &AppHandle,
    ext_can_id: u32,
    data: &[u8; 8],
) -> Result<(), String> {
    let frame = motor_protocol::build_ext_can_frame(ext_can_id, data);

    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;
    socket
        .send(&frame)
        .map_err(|e| format!("UDP send failed: {}", e))?;

    let log_entry = CanFrameLog {
        direction: "tx".to_string(),
        can_id: ext_can_id,
        is_extended: true,
        data: data.to_vec(),
        timestamp_ms: now_ms(),
    };
    let _ = app.emit("can-frame-log", &log_entry);

    Ok(())
}

/// Send multiple CAN frames in a single UDP packet (batch mode)
#[tauri::command]
pub fn udp_send_batch(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    frames: Vec<(u16, Vec<u8>)>,
) -> Result<(), String> {
    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;

    let mut packet = Vec::with_capacity(frames.len() * CAN_FRAME_SIZE);
    for (can_id, data_vec) in &frames {
        if data_vec.len() != 8 {
            return Err("Each CAN frame must have exactly 8 data bytes".to_string());
        }
        let mut data = [0u8; 8];
        data.copy_from_slice(data_vec);
        let frame = motor_protocol::build_can_frame(*can_id, &data);
        packet.extend_from_slice(&frame);

        let log_entry = CanFrameLog {
            direction: "tx".to_string(),
            can_id: *can_id as u32,
            is_extended: false,
            data: data_vec.clone(),
            timestamp_ms: now_ms(),
        };
        let _ = app.emit("can-frame-log", &log_entry);
    }

    if packet.len() > 650 {
        return Err("Batch too large (max 650 bytes / 50 frames)".to_string());
    }

    socket
        .send(&packet)
        .map_err(|e| format!("UDP batch send failed: {}", e))?;

    Ok(())
}

// ── MIT protocol commands (standard frame) ──────────────────────────

#[tauri::command]
pub fn motor_enable(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_enable();
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_stop(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_stop();
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_set_zero(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_set_zero();
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_set_mode(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    mode: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_set_mode(mode);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_clear_fault(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_clear_or_read_fault(0xFF);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_read_fault(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_clear_or_read_fault(0x00);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_mit_control(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    position: f32,
    velocity: f32,
    kp: f32,
    kd: f32,
    torque: f32,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_mit_params(position, velocity, kp, kd, torque);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_position_control(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    target_position: f32,
    max_speed: f32,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(1, cfg.motor_id);
    let data = motor_protocol::cmd_position(target_position, max_speed);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_speed_control(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    target_speed: f32,
    current_limit: f32,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(2, cfg.motor_id);
    let data = motor_protocol::cmd_speed(target_speed, current_limit);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_change_id(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    new_id: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_change_motor_id(new_id);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_change_master_id(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    new_master_id: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_change_master_id(new_master_id);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

#[tauri::command]
pub fn motor_change_protocol(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    protocol: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let can_id = motor_protocol::make_can_id(0, cfg.motor_id);
    let data = motor_protocol::cmd_change_protocol(protocol);
    drop(cfg);
    send_std_frame(&state, &app, can_id, &data)
}

// ── Private protocol commands (extended frame) ──────────────────────

#[tauri::command]
pub fn priv_get_device_id(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_get_device_id(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_enable(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_enable(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_stop(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    clear_fault: bool,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_stop(cfg.master_id, cfg.motor_id, clear_fault);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_set_zero(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_set_zero(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_set_can_id(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    new_id: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_set_can_id(cfg.master_id, cfg.motor_id, new_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_param_read(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    index: u16,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_param_read(cfg.master_id, cfg.motor_id, index);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_param_write(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    index: u16,
    param_type: String,
    value_f64: f64,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let master_id = cfg.master_id;
    let motor_id = cfg.motor_id;
    drop(cfg);

    let (ext_id, data) = match param_type.as_str() {
        "u8" => motor_protocol::priv_cmd_param_write_u8(master_id, motor_id, index, value_f64 as u8),
        "u16" => motor_protocol::priv_cmd_param_write_u16(master_id, motor_id, index, value_f64 as u16),
        "u32" => motor_protocol::priv_cmd_param_write_u32(master_id, motor_id, index, value_f64 as u32),
        "f32" => motor_protocol::priv_cmd_param_write_f32(master_id, motor_id, index, value_f64 as f32),
        "i16" => {
            let val = value_f64 as i16;
            motor_protocol::priv_cmd_param_write_u16(master_id, motor_id, index, val as u16)
        }
        _ => return Err(format!("Unknown param type: {}", param_type)),
    };

    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_save_params(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_save_params(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_change_baud(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    baud_code: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_change_baud(cfg.master_id, cfg.motor_id, baud_code);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_active_report(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    enable: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_active_report(cfg.master_id, cfg.motor_id, enable);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_change_protocol(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    protocol: u8,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_change_protocol(cfg.master_id, cfg.motor_id, protocol);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_read_version(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_read_version(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

#[tauri::command]
pub fn priv_fault_feedback(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let (ext_id, data) = motor_protocol::priv_cmd_fault_feedback(cfg.master_id, cfg.motor_id);
    drop(cfg);
    send_ext_frame(&state, &app, ext_id, &data)
}

/// Get device ID: sends private protocol type 0 (get_device_id) command
/// Response is parsed by recv thread and emitted as "motor-device-id" event
#[tauri::command]
pub fn udp_diagnose(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let motor_id = cfg.motor_id;
    let master_id = cfg.master_id;
    let (ext_id, data) = motor_protocol::priv_cmd_get_device_id(master_id, motor_id);
    drop(cfg);

    send_ext_frame(&state, &app, ext_id, &data)?;

    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;
    let local_addr = socket.local_addr().map(|a| a.to_string()).unwrap_or_else(|_| "unknown".to_string());
    let peer_addr = socket.peer_addr().map(|a| a.to_string()).unwrap_or_else(|_| "unknown".to_string());
    drop(sock_lock);

    Ok(format!(
        "Sent Get Device ID (type 0) to motor ID={}\nLocal: {} → Remote: {}\nResponse will appear in Device Info section",
        motor_id, local_addr, peer_addr
    ))
}

/// Scan for motors by sending get_device_id to all possible CAN IDs (0~127)
/// Responses are handled by the recv thread and emitted as "motor-scan-result" events
#[tauri::command]
pub fn udp_scan_motors(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.udp_config.lock().map_err(|e| e.to_string())?;
    let master_id = cfg.master_id;
    drop(cfg);

    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;

    for motor_id in 0..=127u8 {
        let (ext_id, data) = motor_protocol::priv_cmd_get_device_id(master_id, motor_id);
        let frame = motor_protocol::build_ext_can_frame(ext_id, &data);
        let _ = socket.send(&frame);

        let log_entry = CanFrameLog {
            direction: "tx".to_string(),
            can_id: ext_id,
            is_extended: true,
            data: data.to_vec(),
            timestamp_ms: now_ms(),
        };
        let _ = app.emit("can-frame-log", &log_entry);

        // Small delay between frames
        std::thread::sleep(Duration::from_millis(5));
    }

    Ok(())
}

/// Send a raw 13-byte frame for manual testing
#[tauri::command]
pub fn udp_send_raw(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    hex_string: String,
) -> Result<String, String> {
    let bytes: Result<Vec<u8>, _> = hex_string
        .split_whitespace()
        .map(|s| u8::from_str_radix(s, 16))
        .collect();
    let bytes = bytes.map_err(|e| format!("Invalid hex: {}", e))?;

    if bytes.len() != 13 {
        return Err(format!("Need exactly 13 bytes, got {}", bytes.len()));
    }

    let sock_lock = state.udp_socket.lock().map_err(|e| e.to_string())?;
    let socket = sock_lock.as_ref().ok_or("UDP not connected")?;

    match socket.send(&bytes) {
        Ok(n) => {
            let frame_info = bytes[0];
            let can_id = ((bytes[1] as u32) << 24)
                | ((bytes[2] as u32) << 16)
                | ((bytes[3] as u32) << 8)
                | (bytes[4] as u32);
            let is_ext = frame_info & 0x80 != 0;

            let log_entry = CanFrameLog {
                direction: "tx".to_string(),
                can_id,
                is_extended: is_ext,
                data: bytes[5..13].to_vec(),
                timestamp_ms: now_ms(),
            };
            let _ = app.emit("can-frame-log", &log_entry);

            let hex: Vec<String> = bytes.iter().map(|b| format!("{:02X}", b)).collect();
            Ok(format!("Sent {} bytes: [{}]", n, hex.join(" ")))
        }
        Err(e) => Err(format!("Send failed: {}", e)),
    }
}

/// Get the parameter table definition for the frontend
#[tauri::command]
pub fn get_param_table() -> Vec<serde_json::Value> {
    let mut result = Vec::new();
    for p in motor_protocol::WRITABLE_PARAMS.iter().chain(motor_protocol::READONLY_PARAMS.iter()) {
        result.push(serde_json::json!({
            "index": p.index,
            "name": p.name,
            "desc": p.desc,
            "paramType": format!("{:?}", p.param_type),
            "access": format!("{:?}", p.access),
            "defaultStr": p.default_str,
        }));
    }
    result
}

use std::io::Read;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

const FRAME_HEADER: u8 = 0x0F;
const FRAME_SIZE: usize = 25;

const FLAG_CH17: u8 = 0x01;
const FLAG_CH18: u8 = 0x02;
const FLAG_FRAME_LOST: u8 = 0x04;
const FLAG_FAILSAFE: u8 = 0x08;

/// SBUS decoded frame data emitted to the frontend via "sbus-data" event
#[derive(Debug, Clone, Serialize)]
pub struct SbusData {
    pub channels: Vec<u16>,       // 16 channels, raw 172–1811, mid 992
    pub ch17: bool,
    pub ch18: bool,
    pub frame_lost: bool,
    pub failsafe: bool,
}

/// Periodic statistics emitted via "sbus-stats" so the UI updates even when no
/// valid frame decodes (lets the user diagnose baud/invert/wiring issues).
#[derive(Debug, Clone, Serialize)]
pub struct SbusStats {
    pub bytes_received: u64,
    pub frames_received: u64,
    pub frames_invalid: u64,
    pub frames_lost: u64,
}

/// Stateful byte-stream decoder for SBUS frames
struct SbusDecoder {
    buffer: Vec<u8>,
    frames_received: u64,
    frames_invalid: u64,
    frames_lost: u64,
}

impl SbusDecoder {
    fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(FRAME_SIZE * 2),
            frames_received: 0,
            frames_invalid: 0,
            frames_lost: 0,
        }
    }

    /// Feed one byte; returns a decoded frame when a complete frame is accumulated.
    ///
    /// Sync strategy matches the working C++ reference: trust the 0x0F header and
    /// a fixed 25-byte stride. Do NOT validate the footer byte — many SBUS receivers
    /// use a non-zero end byte (0x04/0x14/0x24/…), so strict footer checks reject
    /// every frame on such hardware.
    fn feed(&mut self, byte: u8) -> Option<SbusData> {
        // Wait for frame header to begin accumulation
        if self.buffer.is_empty() {
            if byte == FRAME_HEADER {
                self.buffer.push(byte);
            }
            return None;
        }

        self.buffer.push(byte);

        if self.buffer.len() < FRAME_SIZE {
            return None;
        }

        // Got 25 bytes starting with 0x0F — decode unconditionally (no footer check)
        let buf: Vec<u8> = self.buffer.drain(..).collect();

        self.frames_received += 1;

        let channels = Self::decode_channels(&buf);
        let flags = buf[23];
        let frame_lost = flags & FLAG_FRAME_LOST != 0;
        let failsafe = flags & FLAG_FAILSAFE != 0;

        if frame_lost {
            self.frames_lost += 1;
        }

        Some(SbusData {
            channels,
            ch17: flags & FLAG_CH17 != 0,
            ch18: flags & FLAG_CH18 != 0,
            frame_lost,
            failsafe,
        })
    }

    /// Decode 16×11-bit channels from a 25-byte SBUS frame (matches NCAS bit layout)
    fn decode_channels(buf: &[u8]) -> Vec<u16> {
        // Cast to u32 before shifting to prevent overflow, then mask to 11 bits
        let b = |i: usize| buf[i] as u32;
        vec![
            ((b(1)       | b(2)  << 8)                      & 0x07FF) as u16,
            ((b(2) >> 3  | b(3)  << 5)                      & 0x07FF) as u16,
            ((b(3) >> 6  | b(4)  << 2  | b(5)  << 10)       & 0x07FF) as u16,
            ((b(5) >> 1  | b(6)  << 7)                      & 0x07FF) as u16,
            ((b(6) >> 4  | b(7)  << 4)                      & 0x07FF) as u16,
            ((b(7) >> 7  | b(8)  << 1  | b(9)  << 9)        & 0x07FF) as u16,
            ((b(9) >> 2  | b(10) << 6)                      & 0x07FF) as u16,
            ((b(10) >> 5 | b(11) << 3)                      & 0x07FF) as u16,
            ((b(12)      | b(13) << 8)                      & 0x07FF) as u16,
            ((b(13) >> 3 | b(14) << 5)                      & 0x07FF) as u16,
            ((b(14) >> 6 | b(15) << 2  | b(16) << 10)       & 0x07FF) as u16,
            ((b(16) >> 1 | b(17) << 7)                      & 0x07FF) as u16,
            ((b(17) >> 4 | b(18) << 4)                      & 0x07FF) as u16,
            ((b(18) >> 7 | b(19) << 1  | b(20) << 9)        & 0x07FF) as u16,
            ((b(20) >> 2 | b(21) << 6)                      & 0x07FF) as u16,
            ((b(21) >> 5 | b(22) << 3)                      & 0x07FF) as u16,
        ]
    }
}

/// Open a serial port and start SBUS frame reception in a background thread.
/// Parameters: port_name (e.g. "COM3"), baud_rate (100000 or 115200), 8N2 fixed.
#[tauri::command]
pub fn sbus_open_port(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    port_name: String,
    baud_rate: u32,
) -> Result<(), String> {
    // Stop any existing SBUS connection
    state.sbus_running.store(false, Ordering::SeqCst);
    {
        let mut lock = state.sbus_port.lock().map_err(|e| e.to_string())?;
        *lock = None;
        std::thread::sleep(Duration::from_millis(100));
    }

    // Open port: 8N2, no flow control (matches NCAS configureSerial)
    let port = serialport::new(&port_name, baud_rate)
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::Two)
        .flow_control(serialport::FlowControl::None)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| format!("Failed to open {}: {}", port_name, e))?;

    let read_port = port.try_clone().map_err(|e| e.to_string())?;

    {
        let mut lock = state.sbus_port.lock().map_err(|e| e.to_string())?;
        *lock = Some(port);
    }

    let running = Arc::clone(&state.sbus_running);
    running.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        sbus_read_thread(read_port, running, app);
    });

    log::info!("SBUS port {} opened at {} baud, 8N2", port_name, baud_rate);
    Ok(())
}

/// Background thread: reads bytes, feeds decoder, emits sbus-data events
fn sbus_read_thread(
    mut port: Box<dyn serialport::SerialPort>,
    running: Arc<std::sync::atomic::AtomicBool>,
    app: AppHandle,
) {
    let mut buf = [0u8; 64];
    let mut decoder = SbusDecoder::new();
    let mut last_frame_time = Instant::now();
    let mut timeout_emitted = false;
    let mut bytes_received: u64 = 0;
    let mut last_stats_emit = Instant::now();

    while running.load(Ordering::SeqCst) {
        match port.read(&mut buf) {
            Ok(n) if n > 0 => {
                last_frame_time = Instant::now();
                timeout_emitted = false;
                bytes_received += n as u64;
                for &byte in &buf[..n] {
                    if let Some(data) = decoder.feed(byte) {
                        if let Err(e) = app.emit("sbus-data", &data) {
                            log::error!("Failed to emit sbus-data: {}", e);
                        }
                        // Feed unified recorder
                        if let Some(state) = app.try_state::<crate::state::AppState>() {
                            crate::recorder::record_sbus(&state.recorder, &data);
                        }
                    }
                }
            }
            Ok(_) | Err(_) => {
                if last_frame_time.elapsed() > Duration::from_millis(500) && !timeout_emitted {
                    let _ = app.emit("sbus-timeout", ());
                    timeout_emitted = true;
                }
            }
        }

        // Emit stats every 200ms so UI shows byte/frame counters even with zero valid frames
        if last_stats_emit.elapsed() > Duration::from_millis(200) {
            last_stats_emit = Instant::now();
            let stats = SbusStats {
                bytes_received,
                frames_received: decoder.frames_received,
                frames_invalid: decoder.frames_invalid,
                frames_lost: decoder.frames_lost,
            };
            let _ = app.emit("sbus-stats", &stats);
        }
    }

    log::info!("SBUS read thread exiting");
}

/// Stop SBUS reception and close the port
#[tauri::command]
pub fn sbus_close_port(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.sbus_running.store(false, Ordering::SeqCst);
    std::thread::sleep(Duration::from_millis(150));
    let mut lock = state.sbus_port.lock().map_err(|e| e.to_string())?;
    *lock = None;
    log::info!("SBUS port closed");
    Ok(())
}

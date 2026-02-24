use std::sync::{Arc, Mutex};

use crate::protocol::HipnucDecoder;

/// Shared application state accessible from Tauri commands
pub struct AppState {
    /// Currently open serial port (None if disconnected)
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
    /// Flag to signal the read thread to stop
    pub read_running: Arc<std::sync::atomic::AtomicBool>,
    /// Protocol decoder instance
    pub decoder: Mutex<HipnucDecoder>,
    /// Whether currently recording data
    pub recording: Mutex<bool>,
    /// CSV writer for recording
    pub csv_writer: Mutex<Option<std::io::BufWriter<std::fs::File>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(None),
            read_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            decoder: Mutex::new(HipnucDecoder::new()),
            recording: Mutex::new(false),
            csv_writer: Mutex::new(None),
        }
    }
}

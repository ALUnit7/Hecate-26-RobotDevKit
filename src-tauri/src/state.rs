use std::net::UdpSocket;
use std::sync::{Arc, Mutex};

use crate::protocol::HipnucDecoder;
use crate::udp::UdpConfig;

/// Shared application state accessible from Tauri commands
pub struct AppState {
    // ── Serial / IMU ──
    /// Currently open serial port (None if disconnected)
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
    /// Flag to signal the serial read thread to stop
    pub read_running: Arc<std::sync::atomic::AtomicBool>,
    /// Protocol decoder instance
    pub decoder: Mutex<HipnucDecoder>,
    /// Whether currently recording data
    pub recording: Mutex<bool>,
    /// CSV writer for recording
    pub csv_writer: Mutex<Option<std::io::BufWriter<std::fs::File>>>,

    // ── UDP / Motor ──
    /// UDP socket for CAN-ETH gateway
    pub udp_socket: Mutex<Option<UdpSocket>>,
    /// Flag to signal the UDP recv thread to stop
    pub udp_running: Arc<std::sync::atomic::AtomicBool>,
    /// Current UDP connection config
    pub udp_config: Mutex<UdpConfig>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(None),
            read_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            decoder: Mutex::new(HipnucDecoder::new()),
            recording: Mutex::new(false),
            csv_writer: Mutex::new(None),

            udp_socket: Mutex::new(None),
            udp_running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            udp_config: Mutex::new(UdpConfig::default()),
        }
    }
}

use std::net::UdpSocket;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use crate::protocol::HipnucDecoder;
use crate::udp::UdpConfig;

/// MIT high-frequency loop parameters (shared between command handler and loop thread)
#[derive(Debug, Clone)]
pub struct MitLoopConfig {
    pub motor_id: u8,
    pub position: f32,
    pub velocity: f32,
    pub kp: f32,
    pub kd: f32,
    pub torque: f32,
    pub freq_hz: u32,
}

impl Default for MitLoopConfig {
    fn default() -> Self {
        Self {
            motor_id: 127,
            position: 0.0,
            velocity: 0.0,
            kp: 0.0,
            kd: 0.0,
            torque: 0.0,
            freq_hz: 200,
        }
    }
}

/// Shared application state accessible from Tauri commands
pub struct AppState {
    // ── Serial / IMU ──
    /// Currently open serial port (None if disconnected)
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
    /// Flag to signal the serial read thread to stop
    pub read_running: Arc<AtomicBool>,
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
    pub udp_running: Arc<AtomicBool>,
    /// Current UDP connection config
    pub udp_config: Mutex<UdpConfig>,
    /// Flag indicating MIT scan is in progress (recv thread emits scan results for MIT feedback)
    pub mit_scanning: Arc<AtomicBool>,

    // ── MIT high-frequency loop ──
    /// Flag to signal the MIT loop thread to stop
    pub mit_loop_running: Arc<AtomicBool>,
    /// Shared MIT loop parameters (updated from frontend sliders)
    pub mit_loop_params: Arc<Mutex<MitLoopConfig>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(None),
            read_running: Arc::new(AtomicBool::new(false)),
            decoder: Mutex::new(HipnucDecoder::new()),
            recording: Mutex::new(false),
            csv_writer: Mutex::new(None),

            udp_socket: Mutex::new(None),
            udp_running: Arc::new(AtomicBool::new(false)),
            udp_config: Mutex::new(UdpConfig::default()),
            mit_scanning: Arc::new(AtomicBool::new(false)),

            mit_loop_running: Arc::new(AtomicBool::new(false)),
            mit_loop_params: Arc::new(Mutex::new(MitLoopConfig::default())),
        }
    }
}

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::Serialize;
use tauri::Manager;

use crate::protocol::Hi91Data;
use crate::motor_protocol::{MotorFeedback, PrivateFeedback};
use crate::sbus::SbusData;
use crate::state::AppState;

// ── Record entry types ──────────────────────────────────────────────────────

/// One line written to the .jsonl recording file.
/// `t` is seconds from recording start (f64, microsecond resolution).
#[allow(dead_code)]
#[derive(Serialize)]
#[serde(tag = "src", rename_all = "snake_case")]
pub enum RecordEntry<'a> {
    Imu {
        t: f64,
        #[serde(flatten)]
        d: &'a Hi91Data,
    },
    Motor {
        t: f64,
        #[serde(flatten)]
        d: &'a MotorFeedback,
    },
    MotorPrivate {
        t: f64,
        #[serde(flatten)]
        d: &'a PrivateFeedback,
    },
    Sbus {
        t: f64,
        #[serde(flatten)]
        d: &'a SbusData,
    },
}

// ── Recorder state ──────────────────────────────────────────────────────────

pub struct RecorderInner {
    writer: BufWriter<File>,
    start: Instant,
    path: PathBuf,
    imu_count: u64,
    motor_count: u64,
    sbus_count: u64,
}

impl RecorderInner {
    fn elapsed_secs(&self) -> f64 {
        self.start.elapsed().as_secs_f64()
    }

    pub fn write_imu(&mut self, d: &Hi91Data) {
        let entry = RecordEntry::Imu { t: self.elapsed_secs(), d };
        if let Ok(line) = serde_json::to_string(&entry) {
            let _ = writeln!(self.writer, "{}", line);
            self.imu_count += 1;
        }
    }

    pub fn write_motor(&mut self, d: &MotorFeedback) {
        let entry = RecordEntry::Motor { t: self.elapsed_secs(), d };
        if let Ok(line) = serde_json::to_string(&entry) {
            let _ = writeln!(self.writer, "{}", line);
            self.motor_count += 1;
        }
    }

    pub fn write_motor_private(&mut self, d: &PrivateFeedback) {
        let entry = RecordEntry::MotorPrivate { t: self.elapsed_secs(), d };
        if let Ok(line) = serde_json::to_string(&entry) {
            let _ = writeln!(self.writer, "{}", line);
            self.motor_count += 1;
        }
    }

    pub fn write_sbus(&mut self, d: &SbusData) {
        let entry = RecordEntry::Sbus { t: self.elapsed_secs(), d };
        if let Ok(line) = serde_json::to_string(&entry) {
            let _ = writeln!(self.writer, "{}", line);
            self.sbus_count += 1;
        }
    }
}

/// Thread-safe recorder handle stored in AppState.
pub type Recorder = Arc<Mutex<Option<RecorderInner>>>;

pub fn new_recorder() -> Recorder {
    Arc::new(Mutex::new(None))
}

// ── Convenience helpers called from read threads ────────────────────────────
// Each function tries to lock the recorder; if it's None (not recording), it's
// a no-op. The lock is held only long enough to serialize and write one line.

pub fn record_imu(rec: &Recorder, d: &Hi91Data) {
    if let Ok(mut guard) = rec.try_lock() {
        if let Some(inner) = guard.as_mut() {
            inner.write_imu(d);
        }
    }
}

pub fn record_motor(rec: &Recorder, d: &MotorFeedback) {
    if let Ok(mut guard) = rec.try_lock() {
        if let Some(inner) = guard.as_mut() {
            inner.write_motor(d);
        }
    }
}

pub fn record_motor_private(rec: &Recorder, d: &PrivateFeedback) {
    if let Ok(mut guard) = rec.try_lock() {
        if let Some(inner) = guard.as_mut() {
            inner.write_motor_private(d);
        }
    }
}

pub fn record_sbus(rec: &Recorder, d: &SbusData) {
    if let Ok(mut guard) = rec.try_lock() {
        if let Some(inner) = guard.as_mut() {
            inner.write_sbus(d);
        }
    }
}

// ── Status emitted to frontend ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct RecorderStatus {
    pub recording: bool,
    pub path: Option<String>,
    pub elapsed_secs: f64,
    pub imu_count: u64,
    pub motor_count: u64,
    pub sbus_count: u64,
}

fn status_idle() -> RecorderStatus {
    RecorderStatus {
        recording: false,
        path: None,
        elapsed_secs: 0.0,
        imu_count: 0,
        motor_count: 0,
        sbus_count: 0,
    }
}

fn status_from(inner: &RecorderInner) -> RecorderStatus {
    RecorderStatus {
        recording: true,
        path: Some(inner.path.to_string_lossy().to_string()),
        elapsed_secs: inner.elapsed_secs(),
        imu_count: inner.imu_count,
        motor_count: inner.motor_count,
        sbus_count: inner.sbus_count,
    }
}

// ── Tauri commands ──────────────────────────────────────────────────────────

/// Start recording.  `path` is absolute; if empty, auto-generate in app_data_dir.
#[tauri::command]
pub fn rec_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<RecorderStatus, String> {
    let mut lock = state.recorder.lock().map_err(|e| e.to_string())?;

    if lock.is_some() {
        return Err("Already recording".to_string());
    }

    // Resolve path: use provided path or auto-generate
    let file_path: PathBuf = if path.is_empty() {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        // Filename: rec_YYYYMMDD_HHMMSS.jsonl
        let ts = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        dir.join(format!("rec_{}.jsonl", ts))
    } else {
        PathBuf::from(&path)
    };

    let file = File::create(&file_path)
        .map_err(|e| format!("Cannot create recording file: {}", e))?;

    let inner = RecorderInner {
        writer: BufWriter::new(file),
        start: Instant::now(),
        path: file_path,
        imu_count: 0,
        motor_count: 0,
        sbus_count: 0,
    };

    let status = status_from(&inner);
    *lock = Some(inner);

    log::info!("Recording started: {}", status.path.as_deref().unwrap_or("?"));
    Ok(status)
}

/// Stop recording and flush the file.
#[tauri::command]
pub fn rec_stop(state: tauri::State<'_, AppState>) -> Result<RecorderStatus, String> {
    let mut lock = state.recorder.lock().map_err(|e| e.to_string())?;

    match lock.take() {
        None => Ok(status_idle()),
        Some(mut inner) => {
            let _ = inner.writer.flush();
            let status = RecorderStatus {
                recording: false,
                path: Some(inner.path.to_string_lossy().to_string()),
                elapsed_secs: inner.elapsed_secs(),
                imu_count: inner.imu_count,
                motor_count: inner.motor_count,
                sbus_count: inner.sbus_count,
            };
            log::info!(
                "Recording stopped: {} imu={} motor={} sbus={} t={:.1}s",
                status.path.as_deref().unwrap_or("?"),
                status.imu_count,
                status.motor_count,
                status.sbus_count,
                status.elapsed_secs,
            );
            Ok(status)
        }
    }
}

/// Query recording status without changing state.
#[tauri::command]
pub fn rec_status(state: tauri::State<'_, AppState>) -> Result<RecorderStatus, String> {
    let lock = state.recorder.lock().map_err(|e| e.to_string())?;
    Ok(match lock.as_ref() {
        None => status_idle(),
        Some(inner) => status_from(inner),
    })
}

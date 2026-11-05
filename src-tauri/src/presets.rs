use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ── Data types (mirrored in src/types/presets.ts) ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ChannelType {
    Stick,
    Switch2,
    Switch3,
    SwitchSpring,
    Knob,
    Lever,
    Trim,
    Unassigned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelMapping {
    /// Display label shown on the channel bar (free text)
    pub label: String,
    /// Transmitter control identifier, e.g. "J1", "SA", "LD" (free text)
    pub control: String,
    /// How to render and interpret this channel's value
    pub channel_type: ChannelType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SbusPreset {
    pub id: String,
    pub name: String,
    /// Exactly 16 channel mappings (indices 0–15)
    pub channels: Vec<ChannelMapping>,
    pub built_in: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetsFile {
    pub version: u32,
    pub active_id: String,
    pub presets: Vec<SbusPreset>,
}

// ── Built-in default preset ─────────────────────────────────────────────────

pub fn built_in_preset() -> SbusPreset {
    use ChannelType::*;
    let ch = |label: &str, control: &str, t: ChannelType| ChannelMapping {
        label: label.to_string(),
        control: control.to_string(),
        channel_type: t,
    };
    SbusPreset {
        id: "built-in-default".to_string(),
        name: "Default (TX16S)".to_string(),
        built_in: true,
        created_at: 0,
        updated_at: 0,
        channels: vec![
            ch("右摇杆 横", "J1", Stick),
            ch("右摇杆 纵", "J2", Stick),
            ch("左摇杆 纵", "J3", Stick),
            ch("左摇杆 横", "J4", Stick),
            ch("SE", "SE", Switch3),
            ch("SF", "SF", Switch2),
            ch("SG", "SG", Switch3),
            ch("SH 复位", "SH", SwitchSpring),
            ch("SA", "SA", Switch3),
            ch("SB", "SB", Switch3),
            ch("SC", "SC", Switch3),
            ch("SD", "SD", Switch3),
            ch("LD 左旋钮", "LD", Knob),
            ch("RD 右旋钮", "RD", Knob),
            ch("LS 左拨杆", "LS", Lever),
            ch("RS 右拨杆", "RS", Lever),
        ],
    }
}

// ── File path ───────────────────────────────────────────────────────────────

fn presets_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(dir.join("sbus_presets.json"))
}

// ── Tauri commands ──────────────────────────────────────────────────────────

/// Load presets from disk. Returns the built-in preset merged with any
/// user-defined presets. Creates the file if it does not exist yet.
#[tauri::command]
pub fn sbus_load_presets(app: tauri::AppHandle) -> Result<PresetsFile, String> {
    let path = presets_path(&app)?;

    if !path.exists() {
        // First run — return defaults, nothing written yet
        let builtin = built_in_preset();
        let id = builtin.id.clone();
        return Ok(PresetsFile {
            version: 1,
            active_id: id,
            presets: vec![builtin],
        });
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("Read failed: {}", e))?;
    let mut file: PresetsFile =
        serde_json::from_str(&raw).map_err(|e| format!("Parse failed: {}", e))?;

    // Always inject the built-in preset at position 0 (may have been stripped on save)
    let builtin = built_in_preset();
    if !file.presets.iter().any(|p| p.id == builtin.id) {
        file.presets.insert(0, builtin);
    }

    Ok(file)
}

/// Persist user presets to disk. The built-in preset is stripped before
/// writing (it is re-injected on load).
#[tauri::command]
pub fn sbus_save_presets(
    app: tauri::AppHandle,
    presets_file: PresetsFile,
) -> Result<(), String> {
    let path = presets_path(&app)?;

    // Strip the immutable built-in before saving
    let mut to_save = presets_file.clone();
    to_save.presets.retain(|p| !p.built_in);

    let json = serde_json::to_string_pretty(&to_save)
        .map_err(|e| format!("Serialize failed: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Write failed: {}", e))?;
    Ok(())
}

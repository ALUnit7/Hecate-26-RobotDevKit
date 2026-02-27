#[allow(dead_code)]
mod motor_protocol;
mod protocol;
mod serial;
mod state;
mod udp;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Serial / IMU
            serial::list_ports,
            serial::open_port,
            serial::close_port,
            serial::send_command,
            serial::start_recording,
            serial::stop_recording,
            // UDP / Motor (MIT standard frame)
            udp::udp_connect,
            udp::udp_disconnect,
            udp::udp_update_motor_ids,
            udp::udp_send_batch,
            udp::motor_enable,
            udp::motor_stop,
            udp::motor_set_zero,
            udp::motor_set_mode,
            udp::motor_clear_fault,
            udp::motor_read_fault,
            udp::motor_mit_control,
            udp::motor_position_control,
            udp::motor_speed_control,
            udp::motor_change_id,
            udp::motor_change_master_id,
            udp::motor_change_protocol,
            // Private protocol (extended frame)
            udp::priv_get_device_id,
            udp::priv_enable,
            udp::priv_stop,
            udp::priv_set_zero,
            udp::priv_set_can_id,
            udp::priv_param_read,
            udp::priv_param_write,
            udp::priv_save_params,
            udp::priv_change_baud,
            udp::priv_active_report,
            udp::priv_change_protocol,
            udp::priv_read_version,
            udp::priv_fault_feedback,
            udp::get_param_table,
            udp::udp_diagnose,
            udp::udp_send_raw,
            udp::udp_scan_motors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

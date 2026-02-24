mod protocol;
mod serial;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            serial::list_ports,
            serial::open_port,
            serial::close_port,
            serial::send_command,
            serial::start_recording,
            serial::stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Entry point. Tauri 2's mobile_entry_point macro is what lets this exact
// same crate build for Android (and iOS) alongside Windows/Mac/Linux.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(server_manager::ServerRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_system_ram_mb,
            commands::get_resource_usage,
            commands::start_server,
            commands::stop_server,
            commands::list_running_servers,
            commands::get_server_log,
            commands::send_command,
            commands::start_playit,
            commands::stop_playit,
            commands::get_playit_status,
            commands::resolve_and_download_jar,
            commands::get_default_servers_dir,
            commands::rcon_command,
            commands::write_text_file,
            commands::read_player_inventory,
            commands::set_inventory_slot,
            commands::clear_inventory_slot,
            commands::get_live_java_versions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub mod server_manager;
pub mod commands;
pub mod jar_resolver;
pub mod rcon;

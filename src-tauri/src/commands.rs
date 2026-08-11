use crate::server_manager::{self, ServerConfig, ServerRegistry};
use sysinfo::System;
use tauri::State;

#[tauri::command]
pub fn get_system_ram_mb() -> u64 {
    let mut sys = System::new_all();
    sys.refresh_memory();
    sys.total_memory() / 1024 / 1024 // sysinfo gives KB
}

#[derive(serde::Serialize)]
pub struct ResourceUsage {
    pub cpu_percent: f32,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
}

#[tauri::command]
pub fn get_resource_usage() -> ResourceUsage {
    let mut sys = System::new_all();
    sys.refresh_all();
    ResourceUsage {
        cpu_percent: sys.global_cpu_usage(),
        ram_used_mb: sys.used_memory() / 1024 / 1024,
        ram_total_mb: sys.total_memory() / 1024 / 1024,
    }
}

#[tauri::command]
pub async fn start_server(
    app: tauri::AppHandle,
    registry: State<'_, ServerRegistry>,
    config: ServerConfig,
) -> Result<(), String> {
    server_manager::start_server(&app, &registry, config).await
}

#[tauri::command]
pub fn stop_server(registry: State<'_, ServerRegistry>, name: String) -> Result<(), String> {
    server_manager::stop_server(&registry, &name)
}

#[tauri::command]
pub fn list_running_servers(registry: State<'_, ServerRegistry>) -> Vec<String> {
    registry.running.lock().unwrap().keys().cloned().collect()
}

#[tauri::command]
pub fn get_server_log(registry: State<'_, ServerRegistry>, name: String) -> Vec<String> {
    server_manager::get_server_log(&registry, &name)
}

#[tauri::command]
pub async fn send_command(registry: State<'_, ServerRegistry>, name: String, command: String) -> Result<(), String> {
    server_manager::send_command(&registry, &name, &command).await
}

#[tauri::command]
pub async fn start_playit(app: tauri::AppHandle, registry: State<'_, ServerRegistry>) -> Result<(), String> {
    server_manager::start_playit(&app, &registry).await
}

#[tauri::command]
pub fn stop_playit(registry: State<'_, ServerRegistry>) -> Result<(), String> {
    server_manager::stop_playit(&registry)
}

#[tauri::command]
pub fn get_playit_status(registry: State<'_, ServerRegistry>) -> Option<server_manager::PlayitState> {
    server_manager::get_playit_status(&registry)
}

/// Resolves the real download URL for the picked loader/version, downloads
/// the actual jar to <working_dir>/server.jar, and returns that path —
/// this is the real replacement for "the app doesn't auto-install."
#[tauri::command]
pub async fn resolve_and_download_jar(loader: String, version: String, working_dir: String) -> Result<String, String> {
    let url = crate::jar_resolver::resolve_jar_url(&loader, &version).await?;
    let dest = std::path::Path::new(&working_dir).join("server.jar");
    crate::jar_resolver::download_jar(&url, &dest).await?;
    dest.to_str().map(|s| s.to_string()).ok_or_else(|| "Invalid path".to_string())
}

/// Real, live list of Java Edition versions fetched from Mojang — used so
/// new Minecraft releases show up automatically instead of needing the
/// app itself updated with a hardcoded list every time.
#[tauri::command]
pub async fn get_live_java_versions() -> Result<Vec<String>, String> {
    crate::jar_resolver::fetch_live_java_versions().await
}

#[tauri::command]
pub fn get_default_servers_dir(app: tauri::AppHandle) -> String {
    // A real, sensible location: alongside the app's own data dir, in a
    // clearly-named "Minecraft Server" folder — matches what we've called
    // it throughout the UI.
    server_manager::app_data_dir(&app).join("Minecraft Server").to_string_lossy().to_string()
}

/// Sends one real RCON command to the running server and returns its real
/// text response — this is what actually makes OP/whitelist/ban/kick/
/// gamemode buttons do something real, instead of just changing local UI
/// state. Requires RCON enabled in that server's server.properties.
#[tauri::command]
pub async fn rcon_command(port: u16, password: String, command: String) -> Result<String, String> {
    crate::rcon::rcon_command("127.0.0.1", port, &password, &command).await
}

/// Reads a player's real current inventory from the live server.
#[tauri::command]
pub async fn read_player_inventory(port: u16, password: String, player_name: String) -> Result<Vec<crate::rcon::InventoryItem>, String> {
    let response = crate::rcon::rcon_command("127.0.0.1", port, &password, &format!("data get entity {player_name} Inventory")).await?;
    Ok(crate::rcon::parse_inventory_response(&response))
}

/// Sets a specific inventory slot to a real item on the live server —
/// item_id should be a real Minecraft item id like "minecraft:diamond_sword".
#[tauri::command]
pub async fn set_inventory_slot(port: u16, password: String, player_name: String, ui_slot: i32, item_id: String, count: i32) -> Result<(), String> {
    let slot = crate::rcon::ui_slot_to_command_slot(ui_slot);
    crate::rcon::rcon_command("127.0.0.1", port, &password, &format!("item replace entity {player_name} {slot} with {item_id} {count}")).await?;
    Ok(())
}

/// Empties a specific inventory slot on the live server.
#[tauri::command]
pub async fn clear_inventory_slot(port: u16, password: String, player_name: String, ui_slot: i32) -> Result<(), String> {
    let slot = crate::rcon::ui_slot_to_command_slot(ui_slot);
    crate::rcon::rcon_command("127.0.0.1", port, &password, &format!("item replace entity {player_name} {slot} with air")).await?;
    Ok(())
}

/// Writes a real text file to disk — used to place eula.txt and
/// server.properties into the server's real working directory before it
/// starts. Without a real eula.txt (eula=true), Minecraft refuses to start
/// at all; without RCON enabled in a real server.properties, none of the
/// real player-management commands can connect.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| format!("Failed writing {path}: {e}"))
}

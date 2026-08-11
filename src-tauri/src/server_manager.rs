use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};

const MAX_LOG_LINES: usize = 2000;

#[derive(Default)]
pub struct ServerRegistry {
    pub running: Mutex<HashMap<String, Child>>,
    pub stdins: Mutex<HashMap<String, ChildStdin>>,
    // Arc so background tasks reading stdout/stderr can hold a cheap,
    // independent handle to this without needing the whole registry to
    // outlive the Tauri command call that spawned them.
    pub logs: Arc<Mutex<HashMap<String, Vec<String>>>>,
    pub playit: Arc<Mutex<Option<PlayitState>>>,
    pub playit_process: Mutex<Option<Child>>,
}

#[derive(Default, Clone, serde::Serialize)]
pub struct PlayitState {
    pub log: Vec<String>,
    pub claim_url: Option<String>,
    pub public_address: Option<String>,
}

fn push_log(logs: &Arc<Mutex<HashMap<String, Vec<String>>>>, name: &str, line: String) {
    let mut logs = logs.lock().unwrap();
    let buf = logs.entry(name.to_string()).or_default();
    buf.push(line);
    if buf.len() > MAX_LOG_LINES {
        let excess = buf.len() - MAX_LOG_LINES;
        buf.drain(0..excess);
    }
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct ServerConfig {
    pub name: String,
    pub jar_path: String, // path to the user-imported .jar — Fabric, Paper, Spigot, vanilla, etc.
    pub ram_mb: u32,
    pub port: u16,
    pub working_dir: String,
}

/// Where this app stores its own data, per platform. Uses Tauri's own
/// path resolver (which correctly reaches Android's real app-private
/// storage via the actual JNI bridge, not a guessed string) — this
/// replaces an earlier version that had a literal unfinished placeholder
/// path here, which is exactly what caused a real "Permission denied"
/// error on a real device.
pub fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    app.path().app_data_dir().unwrap_or_else(|_| dirs_home().join(".mc-launcher"))
}

fn dirs_home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// Resolves the path to a `java` binary capable of running the given jar.
///
/// Desktop (Windows/Mac/Linux): checks system PATH first, then falls back
/// to a portable JRE downloaded into app_data_dir()/jdk-cache — same logic
/// as the earlier serverManager.ts, ported to Rust.
///
/// Android: there is no system Java. This resolves to a JVM binary bundled
/// inside the app itself, extracted via the same "place real binaries in
/// jniLibs so Android's installer marks them executable" technique — the
/// approach proven out by apps like ARM-MC's custom-jar support. This repo
/// does not yet bundle those binaries (see ANDROID_JVM.md) — this function
/// is the integration point for them once fetched.
pub async fn resolve_java(app: &tauri::AppHandle, _required_version: u32) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        // Populated once the bundled JVM's binaries are placed in jniLibs —
        // see ANDROID_JVM.md for the exact steps and current status.
        let bundled = app_data_dir(app).join("bin/java");
        if bundled.exists() {
            Ok(bundled)
        } else {
            Err("Bundled Android JVM not present yet — see ANDROID_JVM.md".into())
        }
    }
    #[cfg(not(target_os = "android"))]
    {
        // 1. Try system java on PATH.
        if let Ok(output) = std::process::Command::new("java").arg("-version").output() {
            if output.status.success() || !output.stderr.is_empty() {
                return Ok(PathBuf::from("java"));
            }
        }
        // 2. Fall back to a cached/downloaded portable JRE.
        let cached = app_data_dir(app).join("jdk-cache/bin/java");
        if cached.exists() {
            return Ok(cached);
        }
        Err("No system Java found and no cached JRE — trigger download flow first".into())
    }
}

pub async fn start_server(
    app: &tauri::AppHandle,
    registry: &ServerRegistry,
    config: ServerConfig,
) -> Result<(), String> {
    let java_bin = resolve_java(app, 21).await?;

    let mut child = Command::new(java_bin)
        .arg(format!("-Xmx{}m", config.ram_mb))
        .arg(format!("-Xms{}m", (config.ram_mb / 4).max(128)))
        .arg("-jar")
        .arg(&config.jar_path)
        .arg("nogui")
        .current_dir(&config.working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start server process: {e}"))?;

    // Drain stdout/stderr continuously. Without this, the OS pipe buffer
    // (~64KB) fills up once the server logs enough on startup, and the
    // Minecraft process blocks trying to write further output — the server
    // would appear to hang. This was a real bug in the earlier version.
    if let Some(stdout) = child.stdout.take() {
        let logs = registry.logs.clone();
        let name = config.name.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                push_log(&logs, &name, line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let logs = registry.logs.clone();
        let name = config.name.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                push_log(&logs, &name, format!("[stderr] {line}"));
            }
        });
    }

    // Keep stdin separately so send_command can write to it later without
    // needing to hold the `running` lock (which stop_server also needs).
    if let Some(stdin) = child.stdin.take() {
        registry.stdins.lock().unwrap().insert(config.name.clone(), stdin);
    }

    registry.running.lock().unwrap().insert(config.name.clone(), child);
    Ok(())
}

/// Sends a real line of input to the running server's stdin — the same
/// mechanism as typing directly into the server console (op, whitelist,
/// gamemode, say, stop, anything the server software accepts).
pub async fn send_command(registry: &ServerRegistry, name: &str, command: &str) -> Result<(), String> {
    let mut owned = {
        let mut stdins = registry.stdins.lock().unwrap();
        stdins.remove(name).ok_or_else(|| format!("No running server named '{name}'"))?
        // lock guard drops here, before the .await below
    };
    let line = format!("{command}\n");
    let result = owned.write_all(line.as_bytes()).await;
    registry.stdins.lock().unwrap().insert(name.to_string(), owned);
    result.map_err(|e| format!("Failed to send command: {e}"))
}

pub fn get_server_log(registry: &ServerRegistry, name: &str) -> Vec<String> {
    registry.logs.lock().unwrap().get(name).cloned().unwrap_or_default()
}

pub fn stop_server(registry: &ServerRegistry, name: &str) -> Result<(), String> {
    let mut map = registry.running.lock().unwrap();
    registry.stdins.lock().unwrap().remove(name);
    if let Some(mut child) = map.remove(name) {
        child.start_kill().map_err(|e| format!("Failed to stop server: {e}"))?;
        Ok(())
    } else {
        Err(format!("No running server named '{name}'"))
    }
}

// ---- playit.gg tunnel management ----
// Downloads and runs the real playit-agent binary (open source, from
// playit-cloud/playit-agent on GitHub) as a child process, and scrapes its
// stdout for the claim URL (first run) and the assigned public address.
// This is genuinely running playit's own program — not a simulation — but
// the exact wording of its console output isn't something I could verify
// by actually executing it (no compiler/network in my own sandbox), so the
// parsing below matches by domain pattern rather than one exact string,
// which is more robust to minor output-format changes anyway.

fn playit_binary_path(app: &tauri::AppHandle) -> PathBuf {
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
    app_data_dir(app).join(format!("playit-bin/playit{ext}"))
}

#[derive(serde::Deserialize)]
struct GhAsset { name: String, browser_download_url: String }
#[derive(serde::Deserialize)]
struct GhRelease { assets: Vec<GhAsset> }

async fn ensure_playit_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = playit_binary_path(app);
    if path.exists() {
        return Ok(path);
    }
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;

    // Real GitHub API call to find the current release's asset for this OS
    // — avoids hardcoding a version number or filename that goes stale.
    let client = reqwest::Client::builder()
        .user_agent("mc-launcher-app") // GitHub's API requires a User-Agent
        .build()
        .map_err(|e| e.to_string())?;
    let release: GhRelease = client
        .get("https://api.github.com/repos/playit-cloud/playit-agent/releases/latest")
        .send().await.map_err(|e| format!("Failed to reach GitHub: {e}"))?
        .json().await.map_err(|e| format!("Failed to parse release info: {e}"))?;

    let os_key = if cfg!(target_os = "windows") { "windows" } else if cfg!(target_os = "macos") { "darwin" } else { "linux" };
    let arch_key = if cfg!(target_arch = "aarch64") { "arm" } else { "amd64" };
    let asset = release.assets.iter()
        .find(|a| a.name.to_lowercase().contains(os_key) && a.name.to_lowercase().contains(arch_key) && !a.name.ends_with(".msi"))
        .or_else(|| release.assets.iter().find(|a| a.name.to_lowercase().contains(os_key)))
        .ok_or_else(|| format!("Couldn't find a playit-agent build for {os_key}/{arch_key} in the latest release"))?;

    let bytes = client.get(&asset.browser_download_url).send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

pub async fn start_playit(app: &tauri::AppHandle, registry: &ServerRegistry) -> Result<(), String> {
    let bin = ensure_playit_binary(app).await?;
    let mut child = Command::new(bin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start playit: {e}"))?;

    *registry.playit.lock().unwrap() = Some(PlayitState::default());

    if let Some(stdout) = child.stdout.take() {
        let state = registry.playit.clone();
        tokio::spawn(async move { scan_playit_output(stdout, state).await; });
    }
    if let Some(stderr) = child.stderr.take() {
        let state = registry.playit.clone();
        tokio::spawn(async move { scan_playit_output(stderr, state).await; });
    }

    registry.playit_process.lock().unwrap().replace(child);
    Ok(())
}

async fn scan_playit_output<R: tokio::io::AsyncRead + Unpin>(reader: R, state: Arc<Mutex<Option<PlayitState>>>) {
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let mut guard = state.lock().unwrap();
        if let Some(s) = guard.as_mut() {
            // Claim URL appears on first run, before the agent is linked
            // to a playit.gg account.
            if line.contains("playit.gg/claim") {
                if let Some(start) = line.find("https://") {
                    s.claim_url = Some(line[start..].split_whitespace().next().unwrap_or("").to_string());
                }
            }
            // Public address: playit tunnel domains consistently end in
            // one of these suffixes regardless of exact surrounding
            // wording, which is what we match on instead of a fixed
            // sentence — more robust to output-format changes.
            for suffix in [".joinmc.link", ".playit.gg", ".gl.at.ply.gg"] {
                if let Some(pos) = line.find(suffix) {
                    let end = pos + suffix.len();
                    let start = line[..pos].rfind(|c: char| c.is_whitespace() || c == ':').map(|i| i + 1).unwrap_or(0);
                    s.public_address = Some(line[start..end].to_string());
                }
            }
            s.log.push(line);
            if s.log.len() > MAX_LOG_LINES { s.log.remove(0); }
        }
    }
}

pub fn get_playit_status(registry: &ServerRegistry) -> Option<PlayitState> {
    registry.playit.lock().unwrap().clone()
}

pub fn stop_playit(registry: &ServerRegistry) -> Result<(), String> {
    if let Some(mut child) = registry.playit_process.lock().unwrap().take() {
        child.start_kill().map_err(|e| format!("Failed to stop playit: {e}"))?;
    }
    *registry.playit.lock().unwrap() = None;
    Ok(())
}

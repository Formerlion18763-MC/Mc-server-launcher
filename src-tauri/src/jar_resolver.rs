use serde::Deserialize;
use std::path::Path;

// ---- Real jar resolution using verified public APIs ----
// Mojang: https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
// Fabric: https://meta.fabricmc.net/v2/versions/...
// Paper:  https://api.papermc.io/v2/projects/paper/...
// Verified via live search against current docs/community references before
// writing this — not guessed — but I couldn't execute-test any of it (no
// compiler/network in my own sandbox), so treat this as best-effort correct
// until a real build confirms it.

#[derive(Deserialize)]
struct MojangManifest { versions: Vec<MojangVersionEntry> }
#[derive(Deserialize)]
struct MojangVersionEntry {
    id: String,
    url: String,
    #[serde(rename = "type")]
    version_type: String,
}
#[derive(Deserialize)]
struct MojangVersionDetail { downloads: MojangDownloads }
#[derive(Deserialize)]
struct MojangDownloads { server: Option<MojangDownloadInfo> }
#[derive(Deserialize)]
struct MojangDownloadInfo { url: String }

/// Fetches the real, current list of Java Edition versions directly from
/// Mojang — so new releases show up automatically instead of the app
/// needing a hardcoded list updated by hand every time Mojang ships one.
pub async fn fetch_live_java_versions() -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder().user_agent("mc-launcher-app").build().map_err(|e| e.to_string())?;
    let manifest: MojangManifest = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send().await.map_err(|e| format!("Failed to reach Mojang: {e}"))?
        .json().await.map_err(|e| format!("Failed to parse Mojang manifest: {e}"))?;
    Ok(manifest.versions.iter().filter(|v| v.version_type == "release").map(|v| v.id.clone()).collect())
}

async fn resolve_vanilla_url(client: &reqwest::Client, version: &str) -> Result<String, String> {
    let manifest: MojangManifest = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send().await.map_err(|e| format!("Failed to reach Mojang: {e}"))?
        .json().await.map_err(|e| format!("Failed to parse Mojang manifest: {e}"))?;
    let entry = manifest.versions.iter().find(|v| v.id == version)
        .ok_or_else(|| format!("Minecraft version {version} not found in Mojang's manifest"))?;
    let detail: MojangVersionDetail = client.get(&entry.url).send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    detail.downloads.server.map(|d| d.url)
        .ok_or_else(|| format!("Version {version} has no server download listed (might be too old)"))
}

#[derive(Deserialize)]
struct FabricLoaderEntry { loader: FabricLoaderVersion }
#[derive(Deserialize)]
struct FabricLoaderVersion { version: String, stable: bool }
#[derive(Deserialize)]
struct FabricInstallerEntry { version: String, stable: bool }

async fn resolve_fabric_url(client: &reqwest::Client, version: &str) -> Result<String, String> {
    let loaders: Vec<FabricLoaderEntry> = client
        .get(format!("https://meta.fabricmc.net/v2/versions/loader/{version}"))
        .send().await.map_err(|e| format!("Failed to reach Fabric meta: {e}"))?
        .json().await.map_err(|e| format!("Failed to parse Fabric loader list: {e}"))?;
    let loader = loaders.iter().find(|l| l.loader.stable).or_else(|| loaders.first())
        .ok_or_else(|| format!("No Fabric loader available for Minecraft {version}"))?;

    let installers: Vec<FabricInstallerEntry> = client
        .get("https://meta.fabricmc.net/v2/versions/installer")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let installer = installers.iter().find(|i| i.stable).or_else(|| installers.first())
        .ok_or_else(|| "No Fabric installer version available".to_string())?;

    Ok(format!(
        "https://meta.fabricmc.net/v2/versions/loader/{version}/{}/{}/server/jar",
        loader.loader.version, installer.version
    ))
}

#[derive(Deserialize)]
struct PaperBuilds { builds: Vec<u32> }

async fn resolve_paper_url(client: &reqwest::Client, version: &str) -> Result<String, String> {
    let builds: PaperBuilds = client
        .get(format!("https://api.papermc.io/v2/projects/paper/versions/{version}/builds"))
        .send().await.map_err(|e| format!("Failed to reach PaperMC: {e}"))?
        .json().await.map_err(|e| format!("Failed to parse PaperMC builds — the version {version} may not exist for Paper: {e}"))?;
    let build = builds.builds.last()
        .ok_or_else(|| format!("No Paper builds found for {version}"))?;
    let filename = format!("paper-{version}-{build}.jar");
    Ok(format!("https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{build}/downloads/{filename}"))
}

/// Resolves the correct download URL for whatever edition/loader/version
/// was picked in the UI. Bedrock and other loaders (Purpur, Forge,
/// PocketMine, NukkitX) aren't wired to a real resolver yet — only
/// vanilla/Fabric/Paper are, since those are the ones I verified real API
/// shapes for.
pub async fn resolve_jar_url(loader: &str, version: &str) -> Result<String, String> {
    let client = reqwest::Client::builder().user_agent("mc-launcher-app").build().map_err(|e| e.to_string())?;
    match loader {
        "vanilla" => resolve_vanilla_url(&client, version).await,
        "fabric" => resolve_fabric_url(&client, version).await,
        "paper" => resolve_paper_url(&client, version).await,
        other => Err(format!("Auto-download isn't wired up for '{other}' yet — only vanilla, fabric, and paper have verified real download sources so far.")),
    }
}

pub async fn download_jar(url: &str, dest_path: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("mc-launcher-app")
        .timeout(std::time::Duration::from_secs(180)) // server jars run 40-80MB; generous but bounded
        .build().map_err(|e| e.to_string())?;

    let mut last_err = String::new();
    for attempt in 1..=2 {
        match client.get(url).send().await {
            Ok(resp) => match resp.bytes().await {
                Ok(bytes) => {
                    if let Some(parent) = dest_path.parent() {
                        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                    }
                    std::fs::write(dest_path, &bytes).map_err(|e| format!("Failed saving jar: {e}"))?;
                    return Ok(());
                }
                Err(e) => last_err = format!("Download failed while reading response (attempt {attempt}/2): {e}"),
            },
            Err(e) => last_err = format!("Download failed (attempt {attempt}/2): {e}. Source URL: {url}"),
        }
        if attempt == 1 {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }
    Err(last_err)
}

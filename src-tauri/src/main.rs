#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use chrono::Local;
use sysinfo::System;
use std::io::Read as _;

// ---------------------------------------------------------------------------
// State management structure
// ---------------------------------------------------------------------------

#[derive(Default)]
struct AppState {
    // key: scope (tag), value: "alert" | "ok"
    last_alert_state: Mutex<HashMap<String, String>>,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct FetchResponse {
    status: u16,
    body: String,
}

#[derive(Serialize, Deserialize)]
struct LogResponse {
    success: bool,
    message: String,
}

#[derive(Serialize, Deserialize)]
struct SaveImageResponse {
    success: bool,
    path: String,
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// AppLocalData directory: %LOCALAPPDATA%/com.tti.gido-touch
fn get_app_data_dir() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "Failed to get local data directory".to_string())
        .map(|d| d.join("com.tti.gido-touch"))
}

fn get_log_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("logs");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;
    Ok(dir)
}

fn get_log_file_path() -> Result<PathBuf, String> {
    let log_dir = get_log_dir()?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("gido-touch-{}.log", today)))
}

fn get_images_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("images");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;
    Ok(dir)
}

fn get_settings_path() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    Ok(dir.join("settings.json"))
}

// ---------------------------------------------------------------------------
// Slack Webhook sender
// ---------------------------------------------------------------------------

fn send_slack_notification(level: &str, tag: &str, message: &str, is_recovery: bool, context_str: &str) {
    let webhook_url = match std::env::var("SLACK_WEBHOOK_URL") {
        Ok(url) if !url.is_empty() => url,
        _ => return,
    };

    let title = if is_recovery {
        format!("RECOVERY: {}", tag)
    } else {
        format!("ALERT: {}", tag)
    };

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*App*: Gido Touch\n*Message*: {message}\n*Context*: {context_str}"
        )
    });

    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        let _ = client.post(&webhook_url).json(&payload).send();
    });
}

// ---------------------------------------------------------------------------
// Logging command
// ---------------------------------------------------------------------------

#[tauri::command]
fn write_log(
    level: String,
    tag: String,
    message: String,
    context: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<LogResponse, String> {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let context_str = context.unwrap_or_default();

    // Slack notification target scopes
    let alert_scopes = [
        "map", "shopList", "NEWS", "DATA_FETCH", "ASSET_RESOLVE",
        "sse", "app", "UPDATER", "CONFIG",
        "SYSTEM", "RENDERER_ERROR"
    ];

    let upper_level = level.to_uppercase();

    // State transition-based Slack alert management
    if alert_scopes.contains(&tag.as_str()) {
        let mut alert_states = state.last_alert_state.lock().unwrap();
        let current_state = alert_states.get(&tag).cloned().unwrap_or_else(|| "ok".to_string());

        let is_error_level = upper_level == "WARN" || upper_level == "ERROR" || upper_level == "FATAL";

        if is_error_level && current_state == "ok" {
            alert_states.insert(tag.clone(), "alert".to_string());
            send_slack_notification(&upper_level, &tag, &message, false, &context_str);
        } else if upper_level == "INFO" && current_state == "alert" {
            alert_states.insert(tag.clone(), "ok".to_string());
            send_slack_notification(&upper_level, &tag, &message, true, &context_str);
        }
    }

    // Log string construction
    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, upper_level, tag, message)
    } else {
        format!(
            "[{}] [{}] [{}] {} | {}\n",
            timestamp, upper_level, tag, message, context_str
        )
    };

    let log_file_path = get_log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(LogResponse {
        success: true,
        message: format!("Logged to {}", log_file_path.display()),
    })
}

// ---------------------------------------------------------------------------
// HTTP proxy (CORS bypass for Bridge API / WSP CMS)
// ---------------------------------------------------------------------------

#[tauri::command]
fn fetch_proxy(url: String) -> Result<FetchResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let response = client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .header("Pragma", "no-cache")
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .map_err(|e| format!("Body read error: {}", e))?;

    Ok(FetchResponse { status, body })
}

// ---------------------------------------------------------------------------
// Settings commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_settings() -> Result<String, String> {
    let path = get_settings_path()?;

    if !path.exists() {
        return Ok("{}".to_string());
    }

    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
fn save_settings(json: String) -> Result<String, String> {
    // Validate JSON before writing
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = get_settings_path()?;

    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(json)
}

// ---------------------------------------------------------------------------
// Named settings commands (per-mall settings files)
// ---------------------------------------------------------------------------

/// Resolve path for a named settings file with filename validation.
fn get_named_settings_path(filename: &str) -> Result<PathBuf, String> {
    // Only allow alphanumeric, hyphens, underscores, and dots
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err(format!("Invalid settings filename: {}", filename));
    }
    if filename.contains("..") {
        return Err("Invalid filename: path traversal detected".to_string());
    }
    let dir = get_app_data_dir()?;
    Ok(dir.join(filename))
}

#[tauri::command]
fn get_named_settings(filename: String) -> Result<String, String> {
    let path = get_named_settings_path(&filename)?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[tauri::command]
fn save_named_settings(filename: String, json: String) -> Result<String, String> {
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    let path = get_named_settings_path(&filename)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write {}: {}", filename, e))?;
    Ok(json)
}

#[tauri::command]
fn settings_file_exists(filename: String) -> Result<bool, String> {
    let path = get_named_settings_path(&filename)?;
    Ok(path.exists())
}

// ---------------------------------------------------------------------------
// Image file commands (Base64-free: receives raw bytes from frontend)
// ---------------------------------------------------------------------------

#[tauri::command]
fn save_image_file(filename: String, data: Vec<u8>) -> Result<SaveImageResponse, String> {
    let images_dir = get_images_dir()?;

    // Sanitize filename to prevent path traversal
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    let file_path = images_dir.join(&safe_name);

    fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write image file: {}", e))?;

    let abs_path = file_path
        .canonicalize()
        .unwrap_or(file_path)
        .to_string_lossy()
        .to_string();

    Ok(SaveImageResponse {
        success: true,
        path: abs_path,
    })
}

#[tauri::command]
fn get_image_path(filename: String) -> Result<String, String> {
    let images_dir = get_images_dir()?;
    let file_path = images_dir.join(&filename);

    if file_path.exists() {
        Ok(file_path
            .canonicalize()
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string())
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
fn delete_image_file(filename: String) -> Result<bool, String> {
    let images_dir = get_images_dir()?;
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    let file_path = images_dir.join(&safe_name);

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete image: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Read image file as bytes (for local paths from Bridge/CMS)
#[tauri::command]
fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read image file: {}", e))
}

// ---------------------------------------------------------------------------
// Mall asset helpers
// ---------------------------------------------------------------------------

/// Resolve base path for mall assets.
/// In dev: <cwd>/src/assets/malls
/// In production: <exe_dir>/resources/assets/malls  (extraResource)
fn get_mall_assets_base_path() -> Result<PathBuf, String> {
    // Development: check for src/assets/malls relative to CWD
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("src")
        .join("assets")
        .join("malls");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Production: next to the executable under _up_/resources/assets/malls
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let prod_path = exe_dir.join("resources").join("assets").join("malls");
            if prod_path.exists() {
                return Ok(prod_path);
            }
            // Tauri on Windows: resources may sit next to the exe directly
            let alt_path = exe_dir.join("assets").join("malls");
            if alt_path.exists() {
                return Ok(alt_path);
            }
        }
    }

    Err("Mall assets directory not found".to_string())
}

/// Detect MIME type from file extension.
fn mime_from_ext(ext: &str) -> &str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

/// Read a file and return as a data-URL string (data:<mime>;base64,...).
fn file_to_data_url(path: &std::path::Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let data = fs::read(path).ok()?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = mime_from_ext(&ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Some(format!("data:{};base64,{}", mime, b64))
}

// ---------------------------------------------------------------------------
// Mall config & asset commands
// ---------------------------------------------------------------------------

/// Read a mall configuration JSON file (genres.json or pictos.json).
#[tauri::command]
fn read_mall_config(mall_id: String, config_type: String) -> Result<serde_json::Value, String> {
    let base = get_mall_assets_base_path()?;
    let config_path = base.join(&mall_id).join(format!("{}.json", config_type));

    if !config_path.exists() {
        return Ok(serde_json::Value::Null);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON in {}: {}", config_path.display(), e))
}

/// Read a mall asset file and return it as a data-URL string.
/// `relative_path` is relative to the malls directory, e.g. "suzaka/pictos/icon/restroom.svg".
#[tauri::command]
fn read_mall_asset(relative_path: String) -> Result<Option<String>, String> {
    let base = get_mall_assets_base_path()?;
    let full_path = base.join(&relative_path);

    if let Some(url) = file_to_data_url(&full_path) {
        return Ok(Some(url));
    }

    // Case-insensitive fallback: scan directory for matching filename
    if let Some(parent) = full_path.parent() {
        if parent.exists() {
            if let Some(fname) = full_path.file_name().and_then(|f| f.to_str()) {
                let lower = fname.to_lowercase();
                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        if entry.file_name().to_string_lossy().to_lowercase() == lower {
                            if let Some(url) = file_to_data_url(&entry.path()) {
                                return Ok(Some(url));
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

// ---------------------------------------------------------------------------
// Shop image command (reads arbitrary image path as data-URL)
// ---------------------------------------------------------------------------

/// Read a shop image from a local file path and return as data-URL.
/// Handles `file://` prefixed paths and Windows drive-letter paths.
#[tauri::command]
fn get_shop_image(file_path: String) -> Result<Option<String>, String> {
    let mut local = file_path.clone();

    // Strip file:// prefix
    if local.starts_with("file://") {
        local = local.replacen("file://", "", 1);
        // Handle Windows: file:///C:/... -> C:/...
        if local.starts_with('/') && local.chars().nth(1).map_or(false, |c| c.is_ascii_alphabetic()) && local.chars().nth(2) == Some(':') {
            local = local[1..].to_string();
        }
    }

    let path = std::path::Path::new(&local);
    Ok(file_to_data_url(path))
}

// ---------------------------------------------------------------------------
// System info command (CPU, memory, GPU, OS)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct SystemInfoResponse {
    cpu_name: String,
    cpu_cores: usize,
    cpu_usage: f32,
    memory_total_mb: u64,
    memory_used_mb: u64,
    memory_usage_percent: f64,
    gpu_name: String,
    os_name: String,
    os_version: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfoResponse {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_name = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown".to_string());
    let cpu_cores = sys.cpus().len();
    let cpu_usage = sys.global_cpu_usage();

    let memory_total_mb = sys.total_memory() / (1024 * 1024);
    let memory_used_mb = sys.used_memory() / (1024 * 1024);
    let memory_usage_percent = if sys.total_memory() > 0 {
        (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    } else {
        0.0
    };

    let gpu_name = get_gpu_name_cached();

    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());

    SystemInfoResponse {
        cpu_name,
        cpu_cores,
        cpu_usage,
        memory_total_mb,
        memory_used_mb,
        memory_usage_percent,
        gpu_name,
        os_name,
        os_version,
    }
}

static GPU_NAME_CACHE: OnceLock<String> = OnceLock::new();

fn get_gpu_name_cached() -> String {
    GPU_NAME_CACHE.get_or_init(|| get_gpu_name()).clone()
}

fn get_gpu_name() -> String {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(["path", "win32_VideoController", "get", "name"])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            let name = text.lines()
                .skip(1)
                .find(|l| !l.trim().is_empty())
                .map(|l| l.trim().to_string())
                .unwrap_or_default();
            if !name.is_empty() {
                return name;
            }
        }
    }
    "Unknown".to_string()
}

// ---------------------------------------------------------------------------
// Media download commands (GitHub Releases ZIP)
//
// Version management: .media-meta.json stores the GitHub asset's `updated_at`
// timestamp. On each check we query the GitHub API for the current asset
// metadata, so re-uploading the same-named ZIP to the same release will
// trigger a re-download.
// ---------------------------------------------------------------------------

fn get_media_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("media");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;
    Ok(dir)
}

#[derive(Serialize, Deserialize, Clone)]
struct MediaMeta {
    app_version: String,
    updated_at: String,
}

fn get_media_meta_path(mall_dir: &std::path::Path) -> PathBuf {
    mall_dir.join(".media-meta.json")
}

fn read_media_meta(mall_dir: &std::path::Path) -> Option<MediaMeta> {
    let path = get_media_meta_path(mall_dir);
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_media_meta(mall_dir: &std::path::Path, meta: &MediaMeta) -> Result<(), String> {
    let path = get_media_meta_path(mall_dir);
    let json = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("Failed to serialize media meta: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write media meta: {}", e))
}

/// Query GitHub API for the `updated_at` of `media-{mallId}.zip` in a release.
fn fetch_remote_asset_updated_at(mall_id: &str, app_version: &str) -> Result<Option<String>, String> {
    let api_url = format!(
        "https://api.github.com/repos/s-yoshida-33/Gido-Touch/releases/tags/v{}",
        app_version
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "Gido-Touch-Updater")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .map_err(|e| format!("GitHub API error: {}", e))?;

    if !response.status().is_success() {
        // Release not found or API error – caller handles gracefully
        return Ok(None);
    }

    let body: serde_json::Value = response
        .json()
        .map_err(|e| format!("Failed to parse GitHub API response: {}", e))?;

    let target_name = format!("media-{}.zip", mall_id);
    if let Some(assets) = body["assets"].as_array() {
        for asset in assets {
            if asset["name"].as_str() == Some(&target_name) {
                return Ok(asset["updated_at"].as_str().map(|s| s.to_string()));
            }
        }
    }

    // Asset not found in release
    Ok(None)
}

#[derive(Serialize)]
struct MediaDownloadResult {
    success: bool,
    message: String,
    skipped: bool,
}

/// Check if media needs to be downloaded.
/// Compares the local `.media-meta.json` against the GitHub Release asset's
/// `updated_at` timestamp. A re-upload of the ZIP (even at the same app
/// version) will produce a different timestamp and trigger a download.
#[tauri::command]
fn check_media_status(mall_id: String, app_version: String) -> Result<MediaDownloadResult, String> {
    let media_root = get_media_dir()?;
    let mall_dir = media_root.join(&mall_id);

    let local_meta = read_media_meta(&mall_dir);

    let has_files = mall_dir.exists() && fs::read_dir(&mall_dir)
        .map(|mut entries| entries.any(|e| {
            e.ok().map_or(false, |e| {
                !e.file_name().to_string_lossy().starts_with('.')
            })
        }))
        .unwrap_or(false);

    // Ask GitHub for the current asset timestamp
    let remote_updated_at = match fetch_remote_asset_updated_at(&mall_id, &app_version) {
        Ok(Some(ts)) => ts,
        Ok(None) => {
            // Asset not found on GitHub
            if has_files {
                return Ok(MediaDownloadResult {
                    success: true,
                    message: "Media asset not found on server. Local files are kept.".to_string(),
                    skipped: true,
                });
            }
            return Ok(MediaDownloadResult {
                success: true,
                message: format!("No media asset for {} v{} on GitHub.", mall_id, app_version),
                skipped: true,
            });
        }
        Err(e) => {
            // API unreachable – if we have local files, keep them
            if has_files {
                return Ok(MediaDownloadResult {
                    success: true,
                    message: format!("GitHub API check failed ({}). Using local files.", e),
                    skipped: true,
                });
            }
            return Ok(MediaDownloadResult {
                success: false,
                message: format!("GitHub API check failed: {}", e),
                skipped: false,
            });
        }
    };

    // Compare with stored metadata
    if has_files {
        if let Some(meta) = &local_meta {
            if meta.updated_at == remote_updated_at {
                return Ok(MediaDownloadResult {
                    success: true,
                    message: format!(
                        "Media for {} is up to date (updated_at={})",
                        mall_id, remote_updated_at
                    ),
                    skipped: true,
                });
            }
        }
    }

    Ok(MediaDownloadResult {
        success: true,
        message: format!(
            "Media update needed for {}: remote_updated_at={}",
            mall_id, remote_updated_at
        ),
        skipped: false,
    })
}

/// Download media ZIP from GitHub Releases, extract, and store metadata.
#[tauri::command]
fn download_media(mall_id: String, app_version: String) -> Result<MediaDownloadResult, String> {
    let media_root = get_media_dir()?;
    let mall_dir = media_root.join(&mall_id);
    let zip_path = media_root.join(format!("media-{}.zip", &mall_id));

    // First, get the remote updated_at for metadata storage
    let remote_updated_at = fetch_remote_asset_updated_at(&mall_id, &app_version)
        .unwrap_or(None)
        .unwrap_or_default();

    let download_url = format!(
        "https://github.com/s-yoshida-33/Gido-Touch/releases/download/v{}/media-{}.zip",
        app_version, mall_id
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let response = client
        .get(&download_url)
        .send()
        .map_err(|e| format!("Download error: {}", e))?;

    let status = response.status();

    if status == reqwest::StatusCode::NOT_FOUND {
        let has_files = mall_dir.exists() && fs::read_dir(&mall_dir)
            .map(|mut entries| entries.any(|e| {
                e.ok().map_or(false, |e| {
                    !e.file_name().to_string_lossy().starts_with('.')
                })
            }))
            .unwrap_or(false);

        if has_files {
            // Keep existing, write meta so we don't re-check
            fs::create_dir_all(&mall_dir)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
            write_media_meta(&mall_dir, &MediaMeta {
                app_version: app_version.clone(),
                updated_at: remote_updated_at,
            })?;
            return Ok(MediaDownloadResult {
                success: true,
                message: "Media not found on server. Keeping existing files.".to_string(),
                skipped: true,
            });
        }

        return Ok(MediaDownloadResult {
            success: false,
            message: format!("Media not available: HTTP {}", status),
            skipped: false,
        });
    }

    if !status.is_success() {
        return Ok(MediaDownloadResult {
            success: false,
            message: format!("Download failed: HTTP {}", status),
            skipped: false,
        });
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    fs::write(&zip_path, &bytes)
        .map_err(|e| format!("Failed to write zip file: {}", e))?;

    // Extract ZIP
    fs::create_dir_all(&mall_dir)
        .map_err(|e| format!("Failed to create mall media directory: {}", e))?;

    let zip_file = fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let out_path = match file.enclosed_name() {
            Some(path) => mall_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let mut outfile = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            let mut buf = Vec::new();
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read zip entry data: {}", e))?;
            outfile.write_all(&buf)
                .map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }
    }

    // Write media metadata
    write_media_meta(&mall_dir, &MediaMeta {
        app_version: app_version.clone(),
        updated_at: remote_updated_at.clone(),
    })?;

    // Cleanup zip
    let _ = fs::remove_file(&zip_path);

    Ok(MediaDownloadResult {
        success: true,
        message: format!(
            "Media extracted to {} (v{}, updated_at={})",
            mall_dir.display(), app_version, remote_updated_at
        ),
        skipped: false,
    })
}

/// Get media file path for a given mall and relative path.
#[tauri::command]
fn get_media_file_path(mall_id: String, relative_path: String) -> Result<String, String> {
    let media_root = get_media_dir()?;
    let file_path = media_root.join(&mall_id).join(&relative_path);

    if file_path.exists() {
        Ok(file_path
            .canonicalize()
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string())
    } else {
        Ok(String::new())
    }
}

/// List all media files for a given mall.
#[tauri::command]
fn list_media_files(mall_id: String) -> Result<Vec<String>, String> {
    let media_root = get_media_dir()?;
    let mall_dir = media_root.join(&mall_id);

    if !mall_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_files_recursive(&mall_dir, &mall_dir, &mut files)?;
    Ok(files)
}

fn collect_files_recursive(base: &PathBuf, dir: &PathBuf, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files_recursive(base, &path, files)?;
        } else {
            // Return relative path from base
            if let Ok(rel) = path.strip_prefix(base) {
                let rel_str = rel.to_string_lossy().to_string();
                // Skip hidden files like .version
                if !rel_str.starts_with('.') {
                    files.push(rel_str);
                }
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Quit app command
// ---------------------------------------------------------------------------

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

fn main() {
    let builder = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            write_log,
            fetch_proxy,
            get_settings,
            save_settings,
            get_named_settings,
            save_named_settings,
            settings_file_exists,
            save_image_file,
            get_image_path,
            delete_image_file,
            read_image_file,
            read_mall_config,
            read_mall_asset,
            get_shop_image,
            get_system_info,
            check_media_status,
            download_media,
            get_media_file_path,
            list_media_files,
            quit_app,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use chrono::Local;
use sysinfo::System;
use std::io::Read as _;
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent, WindowEvent};

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

/// Delete log files older than `max_age_days` from the log directory.
fn cleanup_old_logs(max_age_days: u64) {
    let log_dir = match get_log_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(max_age_days * 86400));
    let cutoff = match cutoff {
        Some(t) => t,
        None => return,
    };
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("log") {
                if let Ok(meta) = fs::metadata(&path) {
                    if let Ok(modified) = meta.modified() {
                        if modified < cutoff {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
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

    let app_version = env!("CARGO_PKG_VERSION");
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "unknown".to_string());

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*App*: Gido Touch\n*Version*: {app_version}\n*Host*: {hostname}\n*Message*: {message}\n*Context*: {context_str}"
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
        let mut alert_states = match state.last_alert_state.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
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
/// Atomic write: writes to a temporary file then renames to the target path.
/// Prevents data corruption if the app crashes mid-write.
fn atomic_write(path: &std::path::Path, data: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(&tmp, path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn save_settings(json: String) -> Result<String, String> {
    // Validate JSON before writing
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let path = get_settings_path()?;
    atomic_write(&path, &json)?;

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
    atomic_write(&path, &json)?;
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

/// List all mall-specific asset files (buttons, maps, open-time, etc.)
/// and return them as a map of relative_path → data-URL.
/// Looks in: <media_base>/<mall_id>/assets/
#[tauri::command]
fn list_mall_assets(mall_id: String) -> Result<HashMap<String, String>, String> {
    let media_base = get_media_base_dir()?;
    let assets_dir = media_base.join(&mall_id).join("assets");

    if !assets_dir.exists() {
        return Ok(HashMap::new());
    }

    let mut result = HashMap::new();
    scan_assets_to_data_urls(&assets_dir, &assets_dir, &mut result)?;
    Ok(result)
}

fn scan_assets_to_data_urls(
    base: &std::path::Path,
    dir: &std::path::Path,
    result: &mut HashMap<String, String>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_assets_to_data_urls(base, &path, result)?;
        } else {
            // Skip hidden files
            if let Some(fname) = path.file_name().and_then(|f| f.to_str()) {
                if fname.starts_with('.') {
                    continue;
                }
            }
            if let Ok(rel) = path.strip_prefix(base) {
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                if let Some(data_url) = file_to_data_url(&path) {
                    result.insert(rel_str, data_url);
                }
            }
        }
    }
    Ok(())
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
        // Run wmic in a background thread with a 10-second timeout to avoid
        // hanging the caller if the wmic process stalls.
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = Command::new("wmic")
                .args(["path", "win32_VideoController", "get", "name"])
                .output();
            let _ = tx.send(result);
        });
        match rx.recv_timeout(std::time::Duration::from_secs(10)) {
            Ok(Ok(out)) if out.status.success() => {
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
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                eprintln!("[SYSTEM_INFO] wmic timed out after 10s");
            }
            _ => {}
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

/// Resolve the base media directory.
/// In dev mode: <cwd>/media  (project-local media directory)
/// In production: %LOCALAPPDATA%/com.tti.gido-touch/media
fn get_media_base_dir() -> Result<PathBuf, String> {
    // Development: check for media/ relative to CWD
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("media");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Production: use AppData media directory
    get_media_dir()
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

#[derive(Clone, Serialize)]
struct MediaProgressPayload {
    phase: String,
    percent: f64,
    downloaded_bytes: u64,
    total_bytes: u64,
    message: String,
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
fn download_media(app: tauri::AppHandle, mall_id: String, app_version: String) -> Result<MediaDownloadResult, String> {
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

    let mut response = client
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

    // Stream download in chunks with progress reporting
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = fs::File::create(&zip_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut buffer = [0u8; 65536]; // 64KB chunks
    let mut last_emit = std::time::Instant::now();

    // Emit initial progress
    let _ = app.emit("media-download-progress", MediaProgressPayload {
        phase: "download".to_string(),
        percent: 0.0,
        downloaded_bytes: 0,
        total_bytes: total_size,
        message: format!("ダウンロード開始 ({})", mall_id),
    });

    loop {
        let bytes_read = response.read(&mut buffer)
            .map_err(|e| format!("Failed to read response data: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Failed to write zip data: {}", e))?;
        downloaded += bytes_read as u64;

        // Throttle event emission to ~4 times per second
        let now = std::time::Instant::now();
        if now.duration_since(last_emit).as_millis() >= 250 {
            let percent = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            };
            let _ = app.emit("media-download-progress", MediaProgressPayload {
                phase: "download".to_string(),
                percent,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                message: format!(
                    "ダウンロード中… {:.1}MB / {:.1}MB",
                    downloaded as f64 / 1_048_576.0,
                    total_size as f64 / 1_048_576.0
                ),
            });
            last_emit = now;
        }
    }
    drop(file);

    // Emit download complete
    let _ = app.emit("media-download-progress", MediaProgressPayload {
        phase: "download".to_string(),
        percent: 100.0,
        downloaded_bytes: downloaded,
        total_bytes: total_size,
        message: "ダウンロード完了。展開中…".to_string(),
    });

    // Extract ZIP
    fs::create_dir_all(&mall_dir)
        .map_err(|e| format!("Failed to create mall media directory: {}", e))?;

    let zip_file = fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let total_entries = archive.len();
    for i in 0..total_entries {
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

        // Report extraction progress every 10 entries
        if total_entries > 0 && (i % 10 == 0 || i == total_entries - 1) {
            let extract_percent = ((i + 1) as f64 / total_entries as f64) * 100.0;
            let _ = app.emit("media-download-progress", MediaProgressPayload {
                phase: "extract".to_string(),
                percent: extract_percent,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                message: format!("展開中… {}/{} ファイル", i + 1, total_entries),
            });
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
    let media_root = get_media_base_dir()?;
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
/// Returns absolute paths (suitable for convertFileSrc in the frontend).
#[tauri::command]
fn list_media_files(mall_id: String) -> Result<Vec<String>, String> {
    let media_root = get_media_base_dir()?;
    let mall_dir = media_root.join(&mall_id);

    if !mall_dir.exists() {
        return Ok(Vec::new());
    }

    // Only list video files from videos/ subdirectory
    let videos_dir = mall_dir.join("videos");
    if !videos_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_video_files_absolute(&videos_dir, &mut files)?;
    Ok(files)
}

fn collect_video_files_absolute(dir: &std::path::Path, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_video_files_absolute(&path, files)?;
        } else {
            // Skip hidden files
            if let Some(fname) = path.file_name().and_then(|f| f.to_str()) {
                if fname.starts_with('.') {
                    continue;
                }
            }
            // Only include video files
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if matches!(ext_lower.as_str(), "mp4" | "webm" | "mkv" | "avi" | "mov") {
                    let abs = path.canonicalize().unwrap_or(path);
                    files.push(abs.to_string_lossy().to_string());
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
    FORCE_QUIT.store(true, Ordering::Relaxed);
    app.exit(0);
}

// ---------------------------------------------------------------------------
// WebView Watchdog: frontend pings Rust periodically; if no ping arrives
// within the timeout the WebView is assumed dead and the app restarts.
// ---------------------------------------------------------------------------

static LAST_PING: OnceLock<AtomicI64> = OnceLock::new();
static FORCE_QUIT: AtomicBool = AtomicBool::new(false);
/// Set to true after the first successful webview_ping, so the restart
/// counter file is only reset once per process lifetime.
static WATCHDOG_COUNTER_RESET: AtomicBool = AtomicBool::new(false);
/// When true, the watchdog skips timeout checks. Used during app updates
/// where downloadAndInstall blocks the WebView and prevents ping responses.
static WATCHDOG_PAUSED: AtomicBool = AtomicBool::new(false);

/// Maximum consecutive watchdog-triggered restarts before giving up.
/// Prevents infinite restart loops when the WebView cannot recover.
const MAX_WATCHDOG_RESTARTS: i32 = 5;

fn now_epoch_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn get_watchdog_counter_path() -> Result<PathBuf, String> {
    get_app_data_dir().map(|d| d.join("watchdog_restart_count"))
}

fn read_watchdog_counter() -> i32 {
    get_watchdog_counter_path()
        .ok()
        .and_then(|p| fs::read_to_string(&p).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0)
}

fn write_watchdog_counter(count: i32) {
    if let Ok(path) = get_watchdog_counter_path() {
        let _ = fs::write(&path, count.to_string());
    }
}

#[tauri::command]
fn webview_ping() -> Result<String, String> {
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    // Reset restart counter once on first successful ping (WebView is healthy)
    if !WATCHDOG_COUNTER_RESET.swap(true, Ordering::Relaxed) {
        write_watchdog_counter(0);
    }
    Ok("pong".to_string())
}

/// Pause the watchdog during operations that block the WebView (e.g., app updates).
/// While paused, the watchdog refreshes the last-ping timestamp on each check cycle
/// so it won't trigger a restart when resumed.
#[tauri::command]
fn pause_watchdog() -> Result<String, String> {
    WATCHDOG_PAUSED.store(true, Ordering::Relaxed);
    // Refresh timestamp so the watchdog doesn't see stale time when it resumes
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    Ok("paused".to_string())
}

/// Resume the watchdog after the blocking operation completes.
#[tauri::command]
fn resume_watchdog() -> Result<String, String> {
    // Refresh timestamp before resuming to avoid immediate timeout
    LAST_PING
        .get_or_init(|| AtomicI64::new(now_epoch_secs()))
        .store(now_epoch_secs(), Ordering::Relaxed);
    WATCHDOG_PAUSED.store(false, Ordering::Relaxed);
    Ok("resumed".to_string())
}

fn start_webview_watchdog(app_handle: tauri::AppHandle) {
    let handle = Arc::new(app_handle);
    let timeout_secs: i64 = 60;

    // Initialise the ping timestamp
    LAST_PING.get_or_init(|| AtomicI64::new(now_epoch_secs()));

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));
            let last = LAST_PING
                .get()
                .map(|a| a.load(Ordering::Relaxed))
                .unwrap_or(now_epoch_secs());
            let elapsed = now_epoch_secs() - last;

            // Skip timeout check while paused (e.g., during app update download).
            // Keep refreshing the timestamp so we don't see stale elapsed time on resume.
            if WATCHDOG_PAUSED.load(Ordering::Relaxed) {
                LAST_PING
                    .get()
                    .map(|a| a.store(now_epoch_secs(), Ordering::Relaxed));
                continue;
            }

            if elapsed > timeout_secs {
                let count = read_watchdog_counter();
                if count >= MAX_WATCHDOG_RESTARTS {
                    let msg = format!(
                        "Watchdog reached max restarts ({}). Stopping auto-restart. Manual intervention required.",
                        MAX_WATCHDOG_RESTARTS
                    );
                    eprintln!("[WATCHDOG] {}", msg);
                    write_to_log_file_direct("WATCHDOG", &msg);
                    send_slack_notification("FATAL", "WATCHDOG", &msg, false, "");
                    return; // Stop the watchdog thread
                }
                write_watchdog_counter(count + 1);

                let msg = format!(
                    "No WebView ping for {}s (timeout={}s). Restarting app. (attempt {}/{})",
                    elapsed, timeout_secs, count + 1, MAX_WATCHDOG_RESTARTS
                );
                eprintln!("[WATCHDOG] {}", msg);
                write_to_log_file_direct("WATCHDOG", &msg);
                send_slack_notification("FATAL", "WATCHDOG", &msg, false, "");
                handle.restart();
            }
        }
    });
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

/// Write a critical message directly to the log file (bypasses frontend IPC).
/// Used by panic hook and watchdog where the frontend may be unavailable.
fn write_to_log_file_direct(tag: &str, message: &str) {
    if let Ok(path) = get_log_file_path() {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let entry = format!("[{}] [FATAL] [{}] {}\n", timestamp, tag, message);
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = file.write_all(entry.as_bytes());
        }
    }
}

/// Install a custom panic hook that logs the panic to the log file and stderr
/// before the process terminates. Without this, OOM or other panics would
/// cause a silent death with no trace.
fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        let location = info.location().map_or_else(
            || "unknown location".to_string(),
            |loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()),
        );

        let message = format!("PANIC at {}: {}", location, payload);
        eprintln!("[PANIC_HOOK] {}", message);
        write_to_log_file_direct("PANIC", &message);

        // Send Slack notification for panic
        send_slack_notification("FATAL", "PANIC", &message, false, &location);

        // Call the default hook (prints backtrace etc.)
        default_hook(info);
    }));
}

/// Create system tray icon with context menu.
/// The tray keeps the process alive even when all windows are closed,
/// allowing the watchdog to recreate the window after a crash.
fn setup_system_tray(app: &tauri::App) -> Result<tauri::tray::TrayIcon, Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip(app.config().product_name.as_deref().unwrap_or("Gido Touch"))
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    FORCE_QUIT.store(true, Ordering::Relaxed);
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(tray)
}

fn main() {
    // Install panic hook FIRST, before anything else can panic
    install_panic_hook();

    // Clean up log files older than 30 days on startup
    cleanup_old_logs(30);

    let builder = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|_window, event| {
            // Prevent window from closing — kiosk mode.
            // The app can only be exited via the system tray "終了" menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
            }
        })
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
            list_mall_assets,
            get_shop_image,
            get_system_info,
            check_media_status,
            download_media,
            get_media_file_path,
            list_media_files,
            quit_app,
            webview_ping,
            pause_watchdog,
            resume_watchdog,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Setup system tray — keeps process alive when window is closed/crashed
    let _tray = match setup_system_tray(&app) {
        Ok(tray) => Some(tray),
        Err(e) => {
            eprintln!("[TRAY] Failed to setup system tray: {}", e);
            write_to_log_file_direct("TRAY", &format!("Failed to setup: {}", e));
            None
        }
    };

    start_webview_watchdog(app.handle().clone());

    app.run(|_app_handle, event| {
        // Prevent the app from exiting when the last window closes.
        // Only FORCE_QUIT (set by tray "終了" or quit_app command) allows exit.
        if let RunEvent::ExitRequested { api, .. } = &event {
            if !FORCE_QUIT.load(Ordering::Relaxed) {
                api.prevent_exit();
            }
        }
    });
}

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

fn get_mall_id_from_settings() -> String {
    let path = match get_settings_path() {
        Ok(p) => p,
        Err(_) => return "unknown".to_string(),
    };
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return "unknown".to_string(),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return "unknown".to_string(),
    };
    json.get("mallId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string()
}

fn get_hostname_from_settings() -> String {
    let path = match get_settings_path() {
        Ok(p) => p,
        Err(_) => return "unknown".to_string(),
    };
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return "unknown".to_string(),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return "unknown".to_string(),
    };
    let h = json.get("hostname")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if h.is_empty() { "unknown".to_string() } else { h }
}

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
    let hostname = get_hostname_from_settings();
    let mall_id = get_mall_id_from_settings();

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*App*: Gido Touch\n*Version*: {app_version}\n*Mall*: {mall_id}\n*Host*: {hostname}\n*Message*: {message}\n*Context*: {context_str}"
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
        "MAP", "SHOPLIST", "VIDEO",
        "DATA_SYNC", "CMS_DELIVERY",
        "ASSET_CHECK",
        "SYSTEM", "RENDERER_ERROR", "APP", "UPDATER", "CONFIG",
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
// Shop change notification (bypasses state machine, sends Slack directly)
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct ShopChangeItem {
    id: String,
    name: String,
}

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.set_fullscreen(false).map_err(|e| e.to_string())?;
    window.minimize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn notify_shop_change(
    added: Vec<ShopChangeItem>,
    removed: Vec<ShopChangeItem>,
) -> Result<(), String> {
    if added.is_empty() && removed.is_empty() {
        return Ok(());
    }
    let mut parts: Vec<String> = Vec::new();
    if !added.is_empty() {
        let list = added.iter().map(|s| format!("{} ({})", s.name, s.id)).collect::<Vec<_>>().join(", ");
        parts.push(format!("追加: {}", list));
    }
    if !removed.is_empty() {
        let list = removed.iter().map(|s| format!("{} ({})", s.name, s.id)).collect::<Vec<_>>().join(", ");
        parts.push(format!("削除: {}", list));
    }
    let message = parts.join(" / ");
    let context = match (added.len(), removed.len()) {
        (a, 0) => format!("追加 {}件", a),
        (0, r) => format!("削除 {}件", r),
        (a, r) => format!("追加 {}件 / 削除 {}件", a, r),
    };
    send_slack_notification("WARN", "SHOPLIST", &message, false, &context);
    Ok(())
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

/// List all mall-specific asset files (buttons, open-times, maps).
/// Looks in:
///   <media_base>/assets/<mall_id>/       → relative keys as-is (e.g. "buttons/...")
///   <media_base>/maps/<mall_id>/<hostname>/ → prefixed with "maps/"
#[tauri::command]
fn list_mall_assets(mall_id: String, hostname: String) -> Result<HashMap<String, String>, String> {
    let media_base = get_media_base_dir()?;
    let mut result = HashMap::new();

    // Scan assets/{mall_id}/
    let assets_dir = media_base.join("assets").join(&mall_id);
    if assets_dir.exists() {
        scan_assets_to_data_urls(&assets_dir, &assets_dir, &mut result)?;
    }

    // Scan maps/{mall_id}/{hostname}/ → prefix keys with "maps/"
    if !hostname.is_empty() && hostname != "unknown" {
        let maps_dir = media_base.join("maps").join(&mall_id).join(&hostname);
        if maps_dir.exists() {
            let mut maps_raw = HashMap::new();
            scan_assets_to_data_urls(&maps_dir, &maps_dir, &mut maps_raw)?;
            for (k, v) in maps_raw {
                result.insert(format!("maps/{}", k), v);
            }
        }
    }

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
// Cleanup old hostname map directories
// ---------------------------------------------------------------------------

/// Delete all subdirectories under maps/{mall_id}/ that do not match current_hostname.
/// Called after a hostname change to remove stale map files from disk.
#[tauri::command]
fn cleanup_old_hostname_maps(mall_id: String, current_hostname: String) -> Result<(), String> {
    if mall_id.is_empty() {
        return Ok(());
    }
    let media_base = get_media_base_dir()?;
    let maps_mall_dir = media_base.join("maps").join(&mall_id);
    if !maps_mall_dir.exists() {
        return Ok(());
    }
    let entries = fs::read_dir(&maps_mall_dir)
        .map_err(|e| format!("Failed to read maps directory: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
            if dir_name != current_hostname {
                fs::remove_dir_all(&path)
                    .map_err(|e| format!("Failed to remove old hostname dir {}: {}", path.display(), e))?;
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
// Media download commands (S3 ZIP)
//
// Version management: .media-meta.json (per mall) stores the last downloaded
// ZIP filename (lastZipName). The frontend compares this against S3 latest.json
// and calls sync_video_from_s3 when the filename changes.
// ---------------------------------------------------------------------------

fn get_media_dir() -> Result<PathBuf, String> {
    let dir = get_app_data_dir()?.join("medias");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;
    Ok(dir)
}

/// Resolve the base media directory.
/// In dev mode: <cwd>/medias  (project-local media directory)
/// In production: %LOCALAPPDATA%/com.tti.gido-touch/medias
fn get_media_base_dir() -> Result<PathBuf, String> {
    // Development: check for medias/ relative to CWD
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("medias");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Production: use AppData media directory
    get_media_dir()
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

/// Internal helper: download a ZIP from S3 and extract to dest_dir (purging it first).
fn sync_zip_to_dir(
    app: &tauri::AppHandle,
    zip_url: &str,
    zip_path: &PathBuf,
    dest_dir: &PathBuf,
    label: &str,
) -> Result<MediaDownloadResult, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut response = client
        .get(zip_url)
        .header("User-Agent", "GidoTouch-MediaUpdater")
        .header("Cache-Control", "no-cache")
        .send()
        .map_err(|e| format!("Download error: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Ok(MediaDownloadResult {
            success: false,
            message: format!("Download failed: HTTP {}", status),
            skipped: false,
        });
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = fs::File::create(zip_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut buffer = [0u8; 65536];
    let mut last_emit = std::time::Instant::now();

    let _ = app.emit("media-download-progress", MediaProgressPayload {
        phase: "download".to_string(),
        percent: 0.0,
        downloaded_bytes: 0,
        total_bytes: total_size,
        message: format!("ダウンロード開始 ({})", label),
    });

    loop {
        let bytes_read = response.read(&mut buffer)
            .map_err(|e| format!("Failed to read response data: {}", e))?;
        if bytes_read == 0 { break; }
        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Failed to write zip data: {}", e))?;
        downloaded += bytes_read as u64;

        let now = std::time::Instant::now();
        if now.duration_since(last_emit).as_millis() >= 250 {
            let percent = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else { 0.0 };
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

    let _ = app.emit("media-download-progress", MediaProgressPayload {
        phase: "download".to_string(),
        percent: 100.0,
        downloaded_bytes: downloaded,
        total_bytes: total_size,
        message: "ダウンロード完了。展開中…".to_string(),
    });

    // Purge existing dest dir so removed files don't linger
    if dest_dir.exists() {
        fs::remove_dir_all(dest_dir)
            .map_err(|e| format!("Failed to clean existing directory: {}", e))?;
    }
    fs::create_dir_all(dest_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let zip_file = fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let total_entries = archive.len();
    for i in 0..total_entries {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let out_path = match entry.enclosed_name() {
            Some(path) => dest_dir.join(path),
            None => continue,
        };

        if entry.is_dir() {
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
            entry.read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read zip entry data: {}", e))?;
            outfile.write_all(&buf)
                .map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }

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

    let _ = fs::remove_file(zip_path);

    Ok(MediaDownloadResult {
        success: true,
        message: format!("Extracted to {} (zip_url={})", dest_dir.display(), zip_url),
        skipped: false,
    })
}

/// Download video ZIP from S3 and extract to media/videos/{mallId}/.
/// Version comparison and metadata updates are handled by the frontend.
#[tauri::command]
fn sync_video_from_s3(app: tauri::AppHandle, mall_id: String, zip_url: String) -> Result<MediaDownloadResult, String> {
    let media_root = get_media_dir()?;
    let zip_path = media_root.join(format!("video-{}.zip", &mall_id));
    let dest_dir = media_root.join("videos").join(&mall_id);
    sync_zip_to_dir(&app, &zip_url, &zip_path, &dest_dir, &mall_id)
}

/// Download assets ZIP from S3 and extract to media/assets/{mallId}/.
#[tauri::command]
fn sync_assets_from_s3(app: tauri::AppHandle, mall_id: String, zip_url: String) -> Result<MediaDownloadResult, String> {
    let media_root = get_media_dir()?;
    let zip_path = media_root.join(format!("assets-{}.zip", &mall_id));
    let dest_dir = media_root.join("assets").join(&mall_id);
    sync_zip_to_dir(&app, &zip_url, &zip_path, &dest_dir, &format!("assets/{}", mall_id))
}

/// Download maps ZIP from S3 and extract to media/maps/{mallId}/{hostname}/.
#[tauri::command]
fn sync_maps_from_s3(app: tauri::AppHandle, mall_id: String, hostname: String, zip_url: String) -> Result<MediaDownloadResult, String> {
    let media_root = get_media_dir()?;
    let zip_path = media_root.join(format!("maps-{}-{}.zip", &mall_id, &hostname));
    let dest_dir = media_root.join("maps").join(&mall_id).join(&hostname);
    sync_zip_to_dir(&app, &zip_url, &zip_path, &dest_dir, &format!("maps/{}/{}", mall_id, hostname))
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
    let videos_dir = media_root.join("videos").join(&mall_id);

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
                // FORCE_QUIT を立てることで on_window_event の prevent_close が
                // スキップされ、ウィンドウ破棄時の TAO パニックを防ぐ。
                FORCE_QUIT.store(true, Ordering::Relaxed);
                // handle.restart() can panic with "cannot move state from Destroyed" when
                // tao's event loop is already torn down (e.g. after a WebView crash).
                // Catch the panic and fall back to process::exit so the OS-level startup
                // mechanism can relaunch us cleanly.
                let restart_result = std::panic::catch_unwind(
                    std::panic::AssertUnwindSafe(|| handle.restart())
                );
                if restart_result.is_err() {
                    write_to_log_file_direct("WATCHDOG", "handle.restart() panicked (tao Destroyed state), falling back to process::exit");
                    std::process::exit(1);
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Focus guard: EVENT_SYSTEM_FOREGROUND hook + periodic TOPMOST enforcement
// (Windows only)
//
// Three-layer protection against other windows appearing above Gido Touch:
// 1. Event hook  — catches windows that steal keyboard focus (immediate)
// 2. Timer       — periodic enforcement every 5 seconds:
//    2a. Demote foreign visible TOPMOST windows to NOTOPMOST (EnumWindows)
//    2b. Re-assert our own TOPMOST position
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
mod focus_guard {
    use std::sync::atomic::{AtomicIsize, AtomicBool, Ordering};

    type HWND = isize;
    type HWINEVENTHOOK = isize;
    type DWORD = u32;
    type UINT = u32;
    type LONG = i32;
    type BOOL = i32;
    type WPARAM = usize;
    type LPARAM = isize;
    #[allow(non_camel_case_types)]
    type UINT_PTR = usize;
    type WNDENUMPROC = unsafe extern "system" fn(HWND, LPARAM) -> BOOL;

    // Win32 constants
    const EVENT_SYSTEM_FOREGROUND: DWORD = 0x0003;
    const WINEVENT_OUTOFCONTEXT: DWORD = 0x0000;
    const HWND_TOPMOST: HWND = -1;
    const HWND_NOTOPMOST: HWND = -2;
    const SWP_NOMOVE: UINT = 0x0002;
    const SWP_NOSIZE: UINT = 0x0001;
    const SWP_NOACTIVATE: UINT = 0x0010;
    const SWP_SHOWWINDOW: UINT = 0x0040;
    const WM_TIMER: UINT = 0x0113;
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOPMOST: LONG = 0x0008;
    const TOPMOST_TIMER_ID: UINT_PTR = 1;
    /// Enforce TOPMOST every 5 seconds: demote foreign TOPMOST windows and
    /// re-assert our own position.
    const TOPMOST_INTERVAL_MS: u32 = 5_000;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct MSG {
        hwnd: HWND,
        message: UINT,
        wParam: WPARAM,
        lParam: LPARAM,
        time: DWORD,
        pt_x: LONG,
        pt_y: LONG,
    }

    type WINEVENTPROC = unsafe extern "system" fn(
        HWINEVENTHOOK, DWORD, HWND, LONG, LONG, DWORD, DWORD,
    );

    #[link(name = "user32")]
    extern "system" {
        fn SetWinEventHook(
            event_min: DWORD,
            event_max: DWORD,
            hmod_win_event_proc: isize,
            pfn_win_event_proc: WINEVENTPROC,
            id_process: DWORD,
            id_thread: DWORD,
            dw_flags: DWORD,
        ) -> HWINEVENTHOOK;
        fn GetForegroundWindow() -> HWND;
        fn SetForegroundWindow(hwnd: HWND) -> BOOL;
        fn SetWindowPos(
            hwnd: HWND,
            hwnd_insert_after: HWND,
            x: i32, y: i32, cx: i32, cy: i32,
            u_flags: UINT,
        ) -> BOOL;
        fn GetMessageW(
            msg: *mut MSG,
            hwnd: HWND,
            msg_filter_min: UINT,
            msg_filter_max: UINT,
        ) -> BOOL;
        fn DispatchMessageW(msg: *const MSG) -> isize;
        fn SetTimer(
            hwnd: HWND,
            id_event: UINT_PTR,
            elapse: UINT,
            lp_timer_func: LPARAM,
        ) -> UINT_PTR;
        fn EnumWindows(
            lp_enum_func: WNDENUMPROC,
            l_param: LPARAM,
        ) -> BOOL;
        fn GetWindowLongW(hwnd: HWND, n_index: i32) -> LONG;
        fn IsWindowVisible(hwnd: HWND) -> BOOL;
    }

    /// HWND of the Gido Touch main window (set once at startup).
    static OWN_HWND: AtomicIsize = AtomicIsize::new(0);
    /// Guards against spawning multiple restore threads concurrently.
    static RESTORE_PENDING: AtomicBool = AtomicBool::new(false);

    /// Seconds to wait before restoring focus.
    /// Short-lived popups (e.g. RustDesk connection toast) will have
    /// disappeared by this time, so we only act on persistent windows.
    const RESTORE_DELAY_SECS: u64 = 3;

    /// EnumWindows callback: demote any visible foreign TOPMOST window to
    /// NOTOPMOST so it drops below our window in the Z-order.
    /// lParam carries our own HWND to skip.
    unsafe extern "system" fn enum_demote_topmost(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let own = l_param as HWND;
        if hwnd == own || IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        if (ex_style & WS_EX_TOPMOST) != 0 {
            SetWindowPos(
                hwnd, HWND_NOTOPMOST,
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
        1
    }

    /// Layer 1: EVENT_SYSTEM_FOREGROUND callback.
    /// Fires when another process takes keyboard focus.
    unsafe extern "system" fn hook_proc(
        _hook: HWINEVENTHOOK,
        _event: DWORD,
        hwnd: HWND,
        _id_object: LONG,
        _id_child: LONG,
        _event_thread: DWORD,
        _event_time: DWORD,
    ) {
        let own = OWN_HWND.load(Ordering::Relaxed);
        if own == 0 || hwnd == own {
            return;
        }

        if RESTORE_PENDING.swap(true, Ordering::Relaxed) {
            return;
        }

        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(RESTORE_DELAY_SECS));

            unsafe {
                let fg = GetForegroundWindow();
                if fg != own {
                    SetWindowPos(
                        own, HWND_TOPMOST,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                    );
                    SetForegroundWindow(own);
                    super::write_to_log_file_direct(
                        "FOCUS_GUARD",
                        "Restored foreground focus (another window stole focus)",
                    );
                }
            }

            RESTORE_PENDING.store(false, Ordering::Relaxed);
        });
    }

    /// Start the focus guard on a dedicated thread with its own message pump.
    ///
    /// Layer 1: `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` — immediate
    ///          response when another window steals keyboard focus.
    /// Layer 2: `SetTimer` — periodic TOPMOST enforcement that demotes
    ///          foreign TOPMOST windows (e.g. RustDesk overlays) and
    ///          re-asserts our own TOPMOST position.
    pub fn start(hwnd: isize) {
        OWN_HWND.store(hwnd, Ordering::Relaxed);

        std::thread::spawn(move || {
            unsafe {
                // Layer 1: foreground event hook
                let hook = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    0,
                    hook_proc,
                    0, 0,
                    WINEVENT_OUTOFCONTEXT,
                );

                if hook == 0 {
                    eprintln!("[FOCUS_GUARD] Failed to set foreground event hook");
                    super::write_to_log_file_direct(
                        "FOCUS_GUARD",
                        "Failed to set SetWinEventHook for EVENT_SYSTEM_FOREGROUND",
                    );
                    return;
                }

                // Layer 2: periodic TOPMOST enforcement timer
                SetTimer(0, TOPMOST_TIMER_ID, TOPMOST_INTERVAL_MS, 0);

                // Message pump — required for both the event hook and WM_TIMER
                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, 0, 0, 0) > 0 {
                    if msg.message == WM_TIMER && msg.wParam == TOPMOST_TIMER_ID {
                        // Demote all foreign visible TOPMOST windows first
                        EnumWindows(enum_demote_topmost, hwnd as LPARAM);
                        // Then re-assert our own TOPMOST
                        SetWindowPos(
                            hwnd, HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }
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
                        let _ = window.set_fullscreen(true);
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
        .on_window_event(|window, event| {
            // Prevent window from closing — kiosk mode.
            // The app can only be exited via the system tray "終了" menu.
            // FORCE_QUIT が立っている場合(watchdog restart / quit_app)は
            // prevent_close をスキップし、ウィンドウを正常に破棄させる。
            // これにより tao の "cannot move state from Destroyed" パニックを防ぐ。
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if !FORCE_QUIT.load(Ordering::Relaxed) {
                        api.prevent_close();
                    }
                }
                WindowEvent::Focused(true) => {
                    // 最小化から復元した際にフルスクリーンを再適用する
                    if !FORCE_QUIT.load(Ordering::Relaxed) {
                        let _ = window.set_fullscreen(true);
                    }
                }
                _ => {}
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
            sync_video_from_s3,
            sync_assets_from_s3,
            sync_maps_from_s3,
            cleanup_old_hostname_maps,
            get_media_file_path,
            list_media_files,
            quit_app,
            webview_ping,
            pause_watchdog,
            resume_watchdog,
            notify_shop_change,
            minimize_window,
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

    // Start foreground focus guard (Windows only).
    // Detects when another window steals focus and restores the Gido Touch window
    // after a short delay. Prevents stale RustDesk overlays from persisting.
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            match window.hwnd() {
                Ok(hwnd) => {
                    focus_guard::start(hwnd.0 as isize);
                    write_to_log_file_direct("FOCUS_GUARD", "Foreground event hook started");
                }
                Err(e) => {
                    let msg = format!("Failed to get main window HWND: {}", e);
                    eprintln!("[FOCUS_GUARD] {}", msg);
                    write_to_log_file_direct("FOCUS_GUARD", &msg);
                }
            }
        }
    }

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

use std::path::Path;

/// Read any file the user picked (via the dialog) and return its raw bytes.
/// Using `ipc::Response` streams the bytes to the webview as an ArrayBuffer
/// instead of a giant JSON number array.
#[tauri::command]
fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}

/// Recursively list every .epub / .pdf inside a chosen folder.
#[tauri::command]
fn scan_dir(path: String) -> Result<Vec<String>, String> {
    fn walk(dir: &Path, out: &mut Vec<String>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    walk(&p, out);
                } else if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                    let ext = ext.to_lowercase();
                    if ext == "epub" || ext == "pdf" {
                        out.push(p.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    let mut out = Vec::new();
    walk(Path::new(&path), &mut out);
    out.sort();
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, scan_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

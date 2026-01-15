mod commands;

use commands::{files, search};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            files::read_directory,
            files::read_file,
            files::write_file,
            files::create_file,
            files::delete_file,
            files::rename_file,
            search::search_files,
            search::search_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

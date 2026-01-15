use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified: Option<u64>,  // Unix timestamp in milliseconds
    pub created: Option<u64>,   // Unix timestamp in milliseconds
    pub accessed: Option<u64>,  // Unix timestamp in milliseconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
    pub metadata: Option<FileMetadata>,
}

fn system_time_to_millis(time: SystemTime) -> Option<u64> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

fn get_file_metadata(path: &Path) -> Option<FileMetadata> {
    fs::metadata(path).ok().map(|meta| {
        FileMetadata {
            size: meta.len(),
            modified: meta.modified().ok().and_then(system_time_to_millis),
            created: meta.created().ok().and_then(system_time_to_millis),
            accessed: meta.accessed().ok().and_then(system_time_to_millis),
        }
    })
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    
    let mut entries: Vec<FileEntry> = Vec::new();
    
    match fs::read_dir(dir_path) {
        Ok(read_dir) => {
            for entry in read_dir.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                
                // Skip hidden files
                if file_name.starts_with('.') {
                    continue;
                }
                
                let file_path = entry.path();
                let is_dir = file_path.is_dir();
                let metadata = get_file_metadata(&file_path);
                
                entries.push(FileEntry {
                    name: file_name,
                    path: file_path.to_string_lossy().to_string(),
                    is_directory: is_dir,
                    children: if is_dir { Some(Vec::new()) } else { None },
                    metadata,
                });
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn create_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    if file_path.exists() {
        return Err(format!("File already exists: {}", path));
    }
    
    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    fs::write(&path, content).map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command]
pub fn delete_file(path: String, recursive: Option<bool>) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    
    if file_path.is_dir() {
        if recursive.unwrap_or(false) {
            fs::remove_dir_all(&path)
                .map_err(|e| format!("Failed to delete directory: {}", e))
        } else {
            fs::remove_dir(&path)
                .map_err(|e| format!("Failed to delete directory: {}", e))
        }
    } else {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let source = Path::new(&old_path);
    
    if !source.exists() {
        return Err(format!("Source does not exist: {}", old_path));
    }
    
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&new_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename: {}", e))
}

/// Get all markdown files in a directory recursively
pub fn get_all_markdown_files(dir_path: &str) -> Vec<String> {
    let mut files = Vec::new();
    
    for entry in WalkDir::new(dir_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Skip hidden files and directories
        if path
            .file_name()
            .map(|n| n.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
        {
            continue;
        }
        
        if path.is_file() && path.extension().map(|e| e == "md").unwrap_or(false) {
            files.push(path.to_string_lossy().to_string());
        }
    }
    
    files
}

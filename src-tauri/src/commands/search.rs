use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;

use super::files::get_all_markdown_files;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Search for files by name
#[tauri::command]
pub fn search_files(directory: String, query: String) -> Result<Vec<String>, String> {
    let files = get_all_markdown_files(&directory);
    let query_lower = query.to_lowercase();
    
    let results: Vec<String> = files
        .into_iter()
        .filter(|path| {
            path.split('/')
                .last()
                .map(|name| name.to_lowercase().contains(&query_lower))
                .unwrap_or(false)
        })
        .collect();
    
    Ok(results)
}

/// Search for content in files
#[tauri::command]
pub fn search_content(
    directory: String,
    query: String,
    case_sensitive: Option<bool>,
    regex_search: Option<bool>,
) -> Result<Vec<SearchResult>, String> {
    let files = get_all_markdown_files(&directory);
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = regex_search.unwrap_or(false);
    
    let mut results: Vec<SearchResult> = Vec::new();
    
    let pattern: Option<Regex> = if use_regex {
        let pattern_str = if case_sensitive {
            query.clone()
        } else {
            format!("(?i){}", query)
        };
        Regex::new(&pattern_str).ok()
    } else {
        None
    };
    
    for file_path in files {
        let content = match fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        
        let mut matches: Vec<SearchMatch> = Vec::new();
        
        for (line_num, line) in content.lines().enumerate() {
            let line_matches: Vec<(usize, usize)> = if use_regex {
                if let Some(ref re) = pattern {
                    re.find_iter(line)
                        .map(|m| (m.start(), m.end()))
                        .collect()
                } else {
                    vec![]
                }
            } else {
                let search_line = if case_sensitive {
                    line.to_string()
                } else {
                    line.to_lowercase()
                };
                let search_query = if case_sensitive {
                    query.clone()
                } else {
                    query.to_lowercase()
                };
                
                let mut found = vec![];
                let mut start = 0;
                while let Some(pos) = search_line[start..].find(&search_query) {
                    let abs_pos = start + pos;
                    found.push((abs_pos, abs_pos + search_query.len()));
                    start = abs_pos + 1;
                }
                found
            };
            
            for (match_start, match_end) in line_matches {
                matches.push(SearchMatch {
                    line_number: line_num + 1,
                    line_content: line.to_string(),
                    match_start,
                    match_end,
                });
            }
        }
        
        if !matches.is_empty() {
            let name = file_path
                .split('/')
                .last()
                .unwrap_or(&file_path)
                .to_string();
            
            results.push(SearchResult {
                path: file_path,
                name,
                matches,
            });
        }
    }
    
    // Sort by number of matches (most matches first)
    results.sort_by(|a, b| b.matches.len().cmp(&a.matches.len()));
    
    Ok(results)
}

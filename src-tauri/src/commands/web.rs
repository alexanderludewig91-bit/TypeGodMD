use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebSearchResponse {
    pub results: Vec<SearchResult>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearxngResponse {
    results: Option<Vec<SearxngResult>>,
}

#[derive(Debug, Deserialize)]
struct SearxngResult {
    title: Option<String>,
    url: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DdgResponse {
    #[serde(rename = "AbstractText")]
    abstract_text: Option<String>,
    #[serde(rename = "AbstractSource")]
    abstract_source: Option<String>,
    #[serde(rename = "AbstractURL")]
    abstract_url: Option<String>,
    #[serde(rename = "RelatedTopics")]
    related_topics: Option<Vec<DdgRelatedTopic>>,
}

#[derive(Debug, Deserialize)]
struct DdgRelatedTopic {
    #[serde(rename = "Text")]
    text: Option<String>,
    #[serde(rename = "FirstURL")]
    first_url: Option<String>,
}

#[tauri::command]
pub async fn web_search(query: String) -> WebSearchResponse {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TypeGodMD/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let encoded_query = urlencoding::encode(&query);
    
    // List of SearXNG instances to try
    let searxng_instances = vec![
        "https://search.sapti.me",
        "https://searx.be",
        "https://search.ononoki.org",
        "https://searx.tiekoetter.com",
        "https://paulgo.io",
    ];

    // Try SearXNG instances
    for instance in &searxng_instances {
        let url = format!(
            "{}/search?q={}&format=json&categories=general&language=de",
            instance, encoded_query
        );

        match client.get(&url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    if let Ok(data) = response.json::<SearxngResponse>().await {
                        if let Some(results) = data.results {
                            if !results.is_empty() {
                                let search_results: Vec<SearchResult> = results
                                    .into_iter()
                                    .take(8)
                                    .filter_map(|r| {
                                        Some(SearchResult {
                                            title: r.title?,
                                            url: r.url?,
                                            content: r.content.unwrap_or_default(),
                                        })
                                    })
                                    .collect();

                                if !search_results.is_empty() {
                                    return WebSearchResponse {
                                        results: search_results,
                                        error: None,
                                    };
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => continue,
        }
    }

    // Fallback: Try DuckDuckGo Instant Answers API
    let ddg_url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        encoded_query
    );

    match client.get(&ddg_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(data) = response.json::<DdgResponse>().await {
                    let mut results = Vec::new();

                    // Add abstract if available
                    if let Some(abstract_text) = data.abstract_text {
                        if !abstract_text.is_empty() {
                            results.push(SearchResult {
                                title: data.abstract_source.unwrap_or_else(|| "DuckDuckGo".to_string()),
                                url: data.abstract_url.unwrap_or_default(),
                                content: abstract_text,
                            });
                        }
                    }

                    // Add related topics
                    if let Some(topics) = data.related_topics {
                        for topic in topics.into_iter().take(5) {
                            if let (Some(text), Some(url)) = (topic.text, topic.first_url) {
                                results.push(SearchResult {
                                    title: text.chars().take(80).collect::<String>() + "...",
                                    url,
                                    content: text,
                                });
                            }
                        }
                    }

                    if !results.is_empty() {
                        return WebSearchResponse {
                            results,
                            error: None,
                        };
                    }
                }
            }
        }
        Err(e) => {
            return WebSearchResponse {
                results: vec![],
                error: Some(format!("Netzwerkfehler: {}", e)),
            };
        }
    }

    WebSearchResponse {
        results: vec![],
        error: Some("Keine Suchergebnisse gefunden. Alle Suchserver waren nicht erreichbar.".to_string()),
    }
}

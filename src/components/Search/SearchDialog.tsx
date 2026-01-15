import { useState, useEffect, useRef, useCallback } from "react";
import { Search, File, X, Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { searchSemantic, cosineSimilarity, generateEmbedding } from "../../services/openai";
import { readTextFile } from "../../services/fileSystem";

interface SearchResult {
  path: string;
  name: string;
  preview: string;
  score?: number;
  type: "text" | "semantic";
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const { currentProject, fileTree, openFile, apiKey } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<"text" | "semantic">("text");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Get all markdown files
  const getAllMarkdownFiles = useCallback((nodes: typeof fileTree): string[] => {
    const files: string[] = [];
    for (const node of nodes) {
      if (node.isDirectory && node.children) {
        files.push(...getAllMarkdownFiles(node.children));
      } else if (node.name.endsWith(".md")) {
        files.push(node.path);
      }
    }
    return files;
  }, []);

  // Text search
  const searchText = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
      if (!currentProject || !searchQuery.trim()) return [];

      const files = getAllMarkdownFiles(fileTree);
      const results: SearchResult[] = [];
      const queryLower = searchQuery.toLowerCase();

      for (const filePath of files) {
        try {
          const content = await readTextFile(filePath);
          const contentLower = content.toLowerCase();
          const name = filePath.split("/").pop() || filePath;

          // Check filename match
          if (name.toLowerCase().includes(queryLower)) {
            const lines = content.split("\n");
            const preview = lines[0]?.substring(0, 100) || "";
            results.push({
              path: filePath,
              name,
              preview,
              type: "text",
            });
            continue;
          }

          // Check content match
          const matchIndex = contentLower.indexOf(queryLower);
          if (matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 30);
            const end = Math.min(content.length, matchIndex + searchQuery.length + 30);
            const preview = (start > 0 ? "..." : "") + 
              content.substring(start, end) + 
              (end < content.length ? "..." : "");

            results.push({
              path: filePath,
              name,
              preview,
              type: "text",
            });
          }
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }

      return results.slice(0, 20);
    },
    [currentProject, fileTree, getAllMarkdownFiles]
  );

  // Semantic search
  const searchSemanticQuery = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
      if (!currentProject || !searchQuery.trim() || !apiKey) return [];

      const files = getAllMarkdownFiles(fileTree);
      const results: SearchResult[] = [];

      try {
        // Get embedding for query
        const queryEmbedding = await generateEmbedding(searchQuery, apiKey);

        // Compare with all files
        for (const filePath of files) {
          try {
            const content = await readTextFile(filePath);
            const name = filePath.split("/").pop() || filePath;

            // Generate embedding for file content (truncate if too long)
            const truncatedContent = content.substring(0, 8000);
            const fileEmbedding = await generateEmbedding(truncatedContent, apiKey);

            // Calculate similarity
            const similarity = cosineSimilarity(queryEmbedding, fileEmbedding);

            if (similarity > 0.3) {
              const lines = content.split("\n");
              const preview = lines[0]?.substring(0, 100) || "";

              results.push({
                path: filePath,
                name,
                preview,
                score: similarity,
                type: "semantic",
              });
            }
          } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
          }
        }

        // Sort by similarity score
        results.sort((a, b) => (b.score || 0) - (a.score || 0));
        return results.slice(0, 10);
      } catch (error) {
        console.error("Semantic search error:", error);
        return [];
      }
    },
    [currentProject, fileTree, getAllMarkdownFiles, apiKey]
  );

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults =
          searchMode === "text"
            ? await searchText(query)
            : await searchSemanticQuery(query);
        setResults(searchResults);
        setSelectedIndex(0);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchMode, searchText, searchSemanticQuery]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          openFile(results[selectedIndex].path);
          onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab":
        e.preventDefault();
        setSearchMode((m) => (m === "text" ? "semantic" : "text"));
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50">
      <div className="bg-dark-sidebar border border-dark-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
          <Search className="w-5 h-5 text-dark-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              searchMode === "text"
                ? "Datei oder Inhalt suchen..."
                : "Semantische Suche (KI)..."
            }
            className="flex-1 bg-transparent text-dark-text placeholder-dark-text-muted text-lg focus:outline-none"
          />
          {isLoading && <Loader2 className="w-5 h-5 text-dark-accent animate-spin" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Mode Toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-border bg-dark-panel">
          <button
            onClick={() => setSearchMode("text")}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              searchMode === "text"
                ? "bg-dark-accent text-white"
                : "bg-dark-hover text-dark-text-muted hover:text-dark-text"
            }`}
          >
            Textsuche
          </button>
          <button
            onClick={() => setSearchMode("semantic")}
            disabled={!apiKey}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              searchMode === "semantic"
                ? "bg-dark-accent text-white"
                : "bg-dark-hover text-dark-text-muted hover:text-dark-text"
            } ${!apiKey ? "opacity-50 cursor-not-allowed" : ""}`}
            title={!apiKey ? "API-Key erforderlich" : undefined}
          >
            Semantische Suche
          </button>
          <span className="text-xs text-dark-text-muted ml-auto">
            Tab zum Wechseln
          </span>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && query && !isLoading ? (
            <div className="p-8 text-center text-dark-text-muted">
              Keine Ergebnisse gefunden
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.path}
                onClick={() => {
                  openFile(result.path);
                  onClose();
                }}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-dark-active"
                    : "hover:bg-dark-hover"
                }`}
              >
                <File className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-dark-text truncate">
                      {result.name}
                    </span>
                    {result.score && (
                      <span className="text-xs text-dark-accent">
                        {Math.round(result.score * 100)}% Match
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-dark-text-muted truncate">
                    {result.preview}
                  </div>
                  <div className="text-xs text-dark-text-muted opacity-60 truncate">
                    {result.path}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-border bg-dark-panel text-xs text-dark-text-muted flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded">↑↓</kbd> Navigation
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded">Enter</kbd> Öffnen
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-hover rounded">Esc</kbd> Schließen
          </span>
        </div>
      </div>
    </div>
  );
}

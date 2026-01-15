import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Trash2, Bot, User, Loader2, File, Folder, ChevronDown, GitCompare, Zap } from "lucide-react";
import { useAppStore, FileNode } from "../../stores/appStore";
import { sendChatMessage } from "../../services/openai";
import ReactMarkdown from "react-markdown";

// Available GPT models
const AVAILABLE_MODELS = [
  // GPT-5 Modelle
  { id: "gpt-5.2", name: "GPT-5.2", description: "Neuestes & bestes Modell" },
  { id: "gpt-5.2-mini", name: "GPT-5.2 Mini", description: "Schnell & sehr leistungsstark" },
  { id: "gpt-5", name: "GPT-5", description: "Leistungsstärkstes Modell" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Schnell & leistungsstark" },
  // GPT-4.1 Modelle
  { id: "gpt-4.1", name: "GPT-4.1", description: "Neuestes GPT-4 Modell" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Günstig & leistungsstark" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "Schnellstes Modell" },
  // GPT-4o Modelle
  { id: "gpt-4o", name: "GPT-4o", description: "Multimodal, schnell" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Günstig & schnell" },
  // Reasoning Modelle
  { id: "o3-mini", name: "o3 Mini", description: "Neues Reasoning-Modell" },
  { id: "o1", name: "o1", description: "Starkes Reasoning" },
  { id: "o1-mini", name: "o1 Mini", description: "Schnelles Reasoning" },
  // Ältere Modelle
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Bewährt & stabil" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5", description: "Günstigste Option" },
];

interface MentionSuggestion {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
}

export default function Chat() {
  const {
    chatMessages,
    addChatMessage,
    clearChat,
    apiKey,
    selectedModel,
    setSelectedModel,
    currentProject,
    openFile,
    refreshFileTree,
    reloadOpenFiles,
    fileTree,
    addPendingChange,
    diffModeEnabled,
    setDiffModeEnabled,
    openFiles,
    mcpServers,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // @-mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  
  // Model selector dropdown state
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Get all files recursively from file tree
  const getAllFiles = (nodes: FileNode[], basePath: string = ""): MentionSuggestion[] => {
    const files: MentionSuggestion[] = [];
    
    for (const node of nodes) {
      // Skip trash folder
      if (node.name === "_trash") continue;
      
      const relativePath = basePath ? `${basePath}/${node.name}` : node.name;
      
      files.push({
        name: node.name,
        path: node.path,
        relativePath,
        isDirectory: node.isDirectory,
      });
      
      if (node.isDirectory && node.children) {
        files.push(...getAllFiles(node.children, relativePath));
      }
    }
    
    return files;
  };

  const allFiles = useMemo(() => getAllFiles(fileTree), [fileTree]);

  // Filter suggestions based on query
  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) return allFiles.slice(0, 10);
    
    const query = mentionQuery.toLowerCase();
    return allFiles
      .filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.relativePath.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [allFiles, mentionQuery]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionSuggestions]);

  // Scroll selected item into view
  useEffect(() => {
    if (showMentions && mentionListRef.current) {
      const selectedItem = mentionListRef.current.children[selectedMentionIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedMentionIndex, showMentions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      addChatMessage({
        role: "assistant",
        content:
          "Bitte füge deinen OpenAI API-Key in den Einstellungen hinzu, um den Chat zu nutzen.",
      });
      return;
    }

    const userMessage = input.trim();
    setInput("");
    addChatMessage({ role: "user", content: userMessage });
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        messages: [
          ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: userMessage },
        ],
        apiKey,
        model: selectedModel,
        projectPath: currentProject?.path,
        mcpServers: mcpServers.filter(s => s.enabled),
        onFileCreated: async (filePath) => {
          console.log("File created:", filePath);
          await refreshFileTree();
          await openFile(filePath);
        },
        // Called when file is updated directly (without diff mode)
        onFileUpdated: async (filePath, newContent) => {
          console.log("File updated directly:", filePath);
          // Check if file is currently open
          const isFileOpen = openFiles.some(f => f.path === filePath);
          if (isFileOpen) {
            // Close and reopen to force editor refresh with new content
            const { closeFile } = useAppStore.getState();
            closeFile(filePath);
          }
          // Open the file (will load fresh content from disk)
          await openFile(filePath);
        },
        // Only use diff mode if enabled
        onProposedChange: diffModeEnabled ? async (change) => {
          console.log("Proposed change:", change);
          // Add pending change to store
          addPendingChange(change);
          // Open the file so user can see the diff
          await openFile(change.filePath);
        } : undefined,
      });

      addChatMessage({ role: "assistant", content: response });
      
      // Refresh file tree and reload open files in case any files were created/modified
      await refreshFileTree();
      await reloadOpenFiles();
    } catch (error) {
      addChatMessage({
        role: "assistant",
        content: `Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input changes and detect @-mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setInput(newValue);
    
    // Check for @ mention
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Only show mentions if @ is at start or after whitespace and no space after @
      if ((charBefore === " " || charBefore === "\n" || lastAtIndex === 0) && !textAfterAt.includes(" ")) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionQuery("");
  };

  // Insert selected mention into input
  const insertMention = (suggestion: MentionSuggestion) => {
    const beforeMention = input.slice(0, mentionStartPos);
    const afterMention = input.slice(mentionStartPos + mentionQuery.length + 1);
    const mentionText = `@${suggestion.relativePath}`;
    
    setInput(beforeMention + mentionText + " " + afterMention);
    setShowMentions(false);
    setMentionQuery("");
    
    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention navigation
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }
    
    // Normal submit
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-dark-accent" />
          <span className="text-sm font-medium text-dark-text">KI-Assistent</span>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title="Chat löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-dark-text-muted mx-auto mb-4 opacity-50" />
            <p className="text-dark-text-muted text-sm">
              Stelle eine Frage oder bitte mich, eine Notiz zu erstellen.
            </p>
            <div className="mt-4 space-y-2 text-xs text-dark-text-muted opacity-70">
              <p>"Fasse @projekt-ideen.md zusammen"</p>
              <p>"Finde Verknüpfungen in @notizen/meeting.md"</p>
              <p>"Erstelle eine neue Notiz über React Hooks"</p>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-border">
              <p className="text-xs text-dark-text-muted">
                Tippe <kbd className="px-1.5 py-0.5 bg-dark-panel rounded">@</kbd> um Dateien zu erwähnen
              </p>
            </div>
          </div>
        ) : (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === "user" ? "bg-dark-accent" : "bg-dark-panel"
                }`}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-dark-accent" />
                )}
              </div>
              <div
                className={`flex-1 min-w-0 ${
                  message.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`inline-block max-w-full text-left px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-dark-accent text-white"
                      : "bg-dark-panel text-dark-text"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                <div className="text-xs text-dark-text-muted mt-1">
                  {new Date(message.timestamp).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-panel flex items-center justify-center">
              <Bot className="w-4 h-4 text-dark-accent" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-dark-panel rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-dark-accent" />
              <span className="text-sm text-dark-text-muted">Denkt nach...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-dark-border">
        {/* @-Mention Dropdown */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div 
            ref={mentionListRef}
            className="mb-2 bg-dark-sidebar border border-dark-border rounded-lg shadow-xl max-h-[200px] overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-xs text-dark-text-muted border-b border-dark-border">
              Dateien erwähnen
            </div>
            {mentionSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.path}
                type="button"
                onClick={() => insertMention(suggestion)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  index === selectedMentionIndex
                    ? "bg-dark-active text-white"
                    : "text-dark-text hover:bg-dark-hover"
                }`}
              >
                {suggestion.isDirectory ? (
                  <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-dark-text-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{suggestion.name}</div>
                  {suggestion.relativePath !== suggestion.name && (
                    <div className="text-xs text-dark-text-muted truncate">
                      {suggestion.relativePath}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben... (@-Datei erwähnen)"
            rows={1}
            className="flex-1 bg-dark-panel border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder-dark-text-muted resize-none focus:outline-none focus:border-dark-accent transition-colors"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 bg-dark-accent text-white rounded-lg hover:bg-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        {!apiKey && (
          <p className="text-xs text-yellow-500 mt-2">
            API-Key fehlt. Bitte in den Einstellungen hinzufügen.
          </p>
        )}
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border/50">
          {/* Model Selector */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-dark-text-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
            >
              <span className="font-medium">
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
            </button>
            
            {showModelDropdown && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-dark-sidebar border border-dark-border rounded-lg shadow-xl overflow-hidden z-50">
                <div className="px-3 py-1.5 text-xs text-dark-text-muted border-b border-dark-border bg-dark-panel/50">
                  Modell wählen
                </div>
                {AVAILABLE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full flex flex-col px-3 py-2 text-left transition-colors ${
                      selectedModel === model.id
                        ? "bg-dark-active text-white"
                        : "text-dark-text hover:bg-dark-hover"
                    }`}
                  >
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className={`text-xs ${selectedModel === model.id ? "text-white/70" : "text-dark-text-muted"}`}>
                      {model.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Diff Mode Toggle */}
          <button
            type="button"
            onClick={() => setDiffModeEnabled(!diffModeEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
              diffModeEnabled
                ? "text-dark-accent bg-dark-accent/10 hover:bg-dark-accent/20"
                : "text-dark-text-muted hover:text-dark-text hover:bg-dark-hover"
            }`}
            title={diffModeEnabled ? "Diff-Ansicht aktiv: Änderungen müssen bestätigt werden" : "Direkt-Modus: Änderungen werden sofort angewendet"}
          >
            {diffModeEnabled ? (
              <>
                <GitCompare className="w-3.5 h-3.5" />
                <span>Diff</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Direkt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

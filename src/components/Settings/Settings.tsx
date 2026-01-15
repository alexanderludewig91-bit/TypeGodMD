import { useState } from "react";
import { X, Eye, EyeOff, Check, Plus, Trash2, Server, Settings2, Plug } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import type { McpServerConfig } from "../../services/mcp";

type Tab = "general" | "mcp";

export default function Settings() {
  const { 
    apiKey, 
    setApiKey, 
    setShowSettings,
    mcpServers,
    addMcpServer,
    updateMcpServer,
    removeMcpServer,
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  
  // MCP form state
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [newMcpServer, setNewMcpServer] = useState<Partial<McpServerConfig>>({
    name: "",
    type: "sse",
    url: "",
    command: "",
    args: [],
    enabled: true,
  });

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    setShowSettings(false);
  };

  const handleAddMcpServer = () => {
    if (!newMcpServer.name) return;
    
    const server: McpServerConfig = {
      id: `mcp-${Date.now()}`,
      name: newMcpServer.name || "",
      type: newMcpServer.type || "sse",
      url: newMcpServer.type === "sse" ? newMcpServer.url : undefined,
      command: newMcpServer.type === "stdio" ? newMcpServer.command : undefined,
      args: newMcpServer.type === "stdio" ? (newMcpServer.args || []) : undefined,
      enabled: true,
    };
    
    addMcpServer(server);
    setShowAddMcp(false);
    setNewMcpServer({
      name: "",
      type: "sse",
      url: "",
      command: "",
      args: [],
      enabled: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar border border-dark-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-white">Einstellungen</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-border">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "general"
                ? "text-dark-accent border-dark-accent"
                : "text-dark-text-muted border-transparent hover:text-dark-text"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Allgemein
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "mcp"
                ? "text-dark-accent border-dark-accent"
                : "text-dark-text-muted border-transparent hover:text-dark-text"
            }`}
          >
            <Plug className="w-4 h-4" />
            MCP Server
            {mcpServers.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-dark-panel">
                {mcpServers.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* API Key Section */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-dark-panel border border-dark-border rounded-lg px-3 py-2 pr-20 text-sm text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
                      title={showKey ? "Verbergen" : "Anzeigen"}
                    >
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-dark-text-muted mt-2">
                  Dein API-Key wird lokal gespeichert und niemals übertragen.
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-accent hover:underline ml-1"
                  >
                    API-Key erstellen
                  </a>
                </p>
              </div>

              {/* About Section */}
              <div className="pt-4 border-t border-dark-border">
                <h3 className="text-sm font-medium text-dark-text mb-2">Über TypeGodMD</h3>
                <p className="text-xs text-dark-text-muted">
                  TypeGodMD ist ein KI-gestütztes Wissensmanagement-Tool für Markdown-Notizen.
                  Version 0.1.0
                </p>
              </div>
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="space-y-4">
              {/* Info */}
              <div className="p-3 bg-dark-panel/50 rounded-lg">
                <p className="text-xs text-dark-text-muted">
                  MCP (Model Context Protocol) ermöglicht die Anbindung externer Tools wie Websuche, 
                  Datenbanken oder APIs. Der KI-Assistent kann diese Tools nutzen, um bessere Antworten zu geben.
                </p>
              </div>

              {/* Server List */}
              <div className="space-y-2">
                {mcpServers.length === 0 && !showAddMcp ? (
                  <div className="text-center py-8">
                    <Server className="w-12 h-12 text-dark-text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-dark-text-muted mb-4">
                      Noch keine MCP-Server konfiguriert
                    </p>
                    <button
                      onClick={() => setShowAddMcp(true)}
                      className="px-4 py-2 bg-dark-accent text-white text-sm rounded-lg hover:bg-dark-accent-hover transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Server hinzufügen
                    </button>
                  </div>
                ) : (
                  <>
                    {mcpServers.map((server) => (
                      <div
                        key={server.id}
                        className="flex items-center gap-3 p-3 bg-dark-panel rounded-lg border border-dark-border"
                      >
                        <Server className={`w-5 h-5 ${server.enabled ? "text-green-400" : "text-dark-text-muted"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-dark-text">{server.name}</div>
                          <div className="text-xs text-dark-text-muted truncate">
                            {server.type === "sse" ? server.url : `${server.command} ${server.args?.join(" ")}`}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={server.enabled}
                            onChange={(e) => updateMcpServer(server.id, { enabled: e.target.checked })}
                            className="w-4 h-4 rounded border-dark-border bg-dark-panel text-dark-accent focus:ring-dark-accent"
                          />
                          <span className="text-xs text-dark-text-muted">Aktiv</span>
                        </label>
                        <button
                          onClick={() => removeMcpServer(server.id)}
                          className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-red-400 transition-colors"
                          title="Entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {!showAddMcp && (
                      <button
                        onClick={() => setShowAddMcp(true)}
                        className="w-full p-3 border border-dashed border-dark-border rounded-lg text-dark-text-muted hover:text-dark-text hover:border-dark-accent transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Server hinzufügen</span>
                      </button>
                    )}
                  </>
                )}

                {/* Add Server Form */}
                {showAddMcp && (
                  <div className="p-4 bg-dark-panel rounded-lg border border-dark-accent space-y-4">
                    <h4 className="text-sm font-medium text-white">Neuer MCP-Server</h4>
                    
                    <div>
                      <label className="block text-xs text-dark-text-muted mb-1">Name</label>
                      <input
                        type="text"
                        value={newMcpServer.name}
                        onChange={(e) => setNewMcpServer(s => ({ ...s, name: e.target.value }))}
                        placeholder="z.B. Web-Suche"
                        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-dark-text-muted mb-1">Typ</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNewMcpServer(s => ({ ...s, type: "sse" }))}
                          className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                            newMcpServer.type === "sse"
                              ? "bg-dark-accent text-white"
                              : "bg-dark-bg border border-dark-border text-dark-text-muted hover:text-dark-text"
                          }`}
                        >
                          SSE (HTTP)
                        </button>
                        <button
                          onClick={() => setNewMcpServer(s => ({ ...s, type: "stdio" }))}
                          className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                            newMcpServer.type === "stdio"
                              ? "bg-dark-accent text-white"
                              : "bg-dark-bg border border-dark-border text-dark-text-muted hover:text-dark-text"
                          }`}
                        >
                          Stdio (Prozess)
                        </button>
                      </div>
                    </div>

                    {newMcpServer.type === "sse" ? (
                      <div>
                        <label className="block text-xs text-dark-text-muted mb-1">Server URL</label>
                        <input
                          type="text"
                          value={newMcpServer.url}
                          onChange={(e) => setNewMcpServer(s => ({ ...s, url: e.target.value }))}
                          placeholder="http://localhost:3001"
                          className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-dark-text-muted mb-1">Befehl</label>
                          <input
                            type="text"
                            value={newMcpServer.command}
                            onChange={(e) => setNewMcpServer(s => ({ ...s, command: e.target.value }))}
                            placeholder="npx"
                            className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-dark-text-muted mb-1">Argumente (kommagetrennt)</label>
                          <input
                            type="text"
                            value={newMcpServer.args?.join(", ")}
                            onChange={(e) => setNewMcpServer(s => ({ 
                              ...s, 
                              args: e.target.value.split(",").map(a => a.trim()).filter(Boolean)
                            }))}
                            placeholder="-y, @anthropic/mcp-server-filesystem"
                            className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowAddMcp(false)}
                        className="flex-1 px-3 py-2 text-sm text-dark-text-muted hover:text-dark-text transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={handleAddMcpServer}
                        disabled={!newMcpServer.name || (newMcpServer.type === "sse" ? !newMcpServer.url : !newMcpServer.command)}
                        className="flex-1 px-3 py-2 bg-dark-accent text-white text-sm rounded hover:bg-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-dark-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-dark-text-muted hover:text-dark-text transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-dark-accent text-white text-sm rounded-lg hover:bg-dark-accent-hover transition-colors flex items-center gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Gespeichert
              </>
            ) : (
              "Speichern"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

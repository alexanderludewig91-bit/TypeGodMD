import { useState } from "react";
import { X, Eye, EyeOff, Check } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

const AVAILABLE_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", description: "Aktuellstes und leistungsstärkstes Modell" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Schneller und günstiger" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Vorherige Generation" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Schnell und kostengünstig" },
];

export default function Settings() {
  const { apiKey, setApiKey, selectedModel, setSelectedModel, setShowSettings } =
    useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    setShowSettings(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar border border-dark-border rounded-lg shadow-2xl w-full max-w-lg mx-4">
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

        {/* Content */}
        <div className="p-4 space-y-6">
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

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              KI-Modell
            </label>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    selectedModel === model.id
                      ? "border-dark-accent bg-dark-active"
                      : "border-dark-border bg-dark-panel hover:bg-dark-hover"
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-dark-text">
                      {model.name}
                    </div>
                    <div className="text-xs text-dark-text-muted">
                      {model.description}
                    </div>
                  </div>
                  {selectedModel === model.id && (
                    <Check className="w-4 h-4 text-dark-accent" />
                  )}
                </button>
              ))}
            </div>
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

import { useState, useEffect } from "react";
import { Settings, GitGraph, X, Search } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import SearchDialog from "./Search/SearchDialog";

export default function TitleBar() {
  const {
    currentProject,
    setCurrentProject,
    showGraphView,
    setShowGraphView,
    setShowSettings,
  } = useAppStore();
  const [showSearch, setShowSearch] = useState(false);

  const handleCloseProject = () => {
    setCurrentProject(null);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + P for search
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setShowSearch(true);
      }
      // Cmd/Ctrl + G for graph view
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        setShowGraphView(!showGraphView);
      }
      // Cmd/Ctrl + , for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showGraphView, setShowGraphView, setShowSettings]);

  return (
    <>
      <div className="h-10 bg-dark-sidebar border-b border-dark-border flex items-center justify-between px-3 flex-shrink-0">
        {/* Left: Project Name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-dark-text font-medium truncate">
            {currentProject?.name || "TypeGodMD"}
          </span>
          {currentProject && (
            <button
              onClick={handleCloseProject}
              className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
              title="Projekt schließen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center: Search Button */}
        <div className="flex-1 max-w-md mx-4">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-dark-panel rounded border border-dark-border text-dark-text-muted text-sm hover:border-dark-accent transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Suchen...</span>
            <span className="ml-auto text-xs opacity-60">⌘P</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGraphView(!showGraphView)}
            className={`p-2 rounded transition-colors ${
              showGraphView
                ? "bg-dark-active text-white"
                : "hover:bg-dark-hover text-dark-text-muted hover:text-dark-text"
            }`}
            title="Graph-Ansicht (⌘G)"
          >
            <GitGraph className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title="Einstellungen (⌘,)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Dialog */}
      <SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}

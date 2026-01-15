import { useState } from "react";
import { X, FileText, Eye, Edit3, Columns, GitCompare } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import MarkdownEditor from "./MarkdownEditor";
import MarkdownPreview from "./MarkdownPreview";
import DiffView from "../DiffView";

type ViewMode = "edit" | "preview" | "split";

export default function Editor() {
  const { 
    openFiles, 
    activeFile, 
    setActiveFile, 
    closeFile, 
    saveFile,
    getPendingChangeForFile,
    acceptPendingChange,
    rejectPendingChange,
    pendingChanges,
  } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const activeFileData = openFiles.find((f) => f.path === activeFile);
  const pendingChange = activeFile ? getPendingChangeForFile(activeFile) : undefined;

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const file = openFiles.find((f) => f.path === path);
    if (file?.isDirty) {
      const shouldSave = confirm(
        `"${file.name}" wurde geändert. Möchtest du speichern?`
      );
      if (shouldSave) {
        saveFile(path);
      }
    }
    closeFile(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (activeFile) {
        saveFile(activeFile);
      }
    }
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <FileText className="w-16 h-16 text-dark-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-dark-text-muted">
            Wähle eine Datei aus dem Explorer
          </p>
          <p className="text-dark-text-muted text-sm mt-2 opacity-60">
            oder erstelle eine neue mit dem KI-Chat
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col bg-dark-bg"
      onKeyDown={handleKeyDown}
    >
      {/* Tabs */}
      <div className="flex items-center bg-dark-sidebar border-b border-dark-border overflow-x-auto">
        <div className="flex-1 flex items-center">
          {openFiles.map((file) => {
            const hasPendingChange = pendingChanges.some(c => c.filePath === file.path);
            return (
              <button
                key={file.path}
                onClick={() => setActiveFile(file.path)}
                className={`flex items-center gap-2 px-4 py-2 border-r border-dark-border text-sm transition-colors ${
                  activeFile === file.path
                    ? "bg-dark-bg text-white"
                    : "bg-dark-sidebar text-dark-text-muted hover:bg-dark-hover"
                } ${hasPendingChange ? "border-t-2 border-t-yellow-500" : ""}`}
              >
                {hasPendingChange ? (
                  <GitCompare className="w-4 h-4 text-yellow-500" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="truncate max-w-[150px]">{file.name}</span>
                {file.isDirty && !hasPendingChange && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
                {hasPendingChange && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                    Änderung
                  </span>
                )}
                <button
                  onClick={(e) => handleClose(e, file.path)}
                  className="ml-1 p-0.5 rounded hover:bg-dark-panel transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 px-2 border-l border-dark-border">
          <button
            onClick={() => setViewMode("edit")}
            className={`p-1.5 rounded transition-colors ${
              viewMode === "edit"
                ? "bg-dark-active text-white"
                : "text-dark-text-muted hover:bg-dark-hover hover:text-dark-text"
            }`}
            title="Editor"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`p-1.5 rounded transition-colors ${
              viewMode === "split"
                ? "bg-dark-active text-white"
                : "text-dark-text-muted hover:bg-dark-hover hover:text-dark-text"
            }`}
            title="Split-Ansicht"
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`p-1.5 rounded transition-colors ${
              viewMode === "preview"
                ? "bg-dark-active text-white"
                : "text-dark-text-muted hover:bg-dark-hover hover:text-dark-text"
            }`}
            title="Vorschau"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      {activeFileData && (
        <>
          {/* Show DiffView if there are pending changes for this file */}
          {pendingChange ? (
            <DiffView
              change={pendingChange}
              onAccept={() => acceptPendingChange(pendingChange.id)}
              onReject={() => rejectPendingChange(pendingChange.id)}
            />
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {(viewMode === "edit" || viewMode === "split") && (
                <div
                  className={`${
                    viewMode === "split" ? "w-1/2 border-r border-dark-border" : "w-full"
                  } overflow-hidden`}
                >
                  <MarkdownEditor
                    content={activeFileData.content}
                    filePath={activeFileData.path}
                  />
                </div>
              )}

              {(viewMode === "preview" || viewMode === "split") && (
                <div
                  className={`${
                    viewMode === "split" ? "w-1/2" : "w-full"
                  } overflow-auto p-6`}
                >
                  <MarkdownPreview content={activeFileData.content} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

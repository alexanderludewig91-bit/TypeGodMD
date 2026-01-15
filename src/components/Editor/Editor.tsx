import { useState } from "react";
import { X, FileText, Code, BookOpen, GitCompare, Image, FileType2, File, FileSpreadsheet } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import MarkdownEditor from "./MarkdownEditor";
import WysiwygEditor from "./WysiwygEditor";
import ImageViewer from "./ImageViewer";
import PDFViewer from "./PDFViewer";
import OfficeViewer from "./OfficeViewer";
import DiffView from "../DiffView";
import type { FileType } from "../../stores/appStore";

type ViewMode = "wysiwyg" | "source";

// Get icon for file type
function getFileIcon(fileType: FileType, hasPendingChange: boolean) {
  if (hasPendingChange) {
    return <GitCompare className="w-4 h-4 text-yellow-500" />;
  }
  
  switch (fileType) {
    case "markdown":
      return <FileText className="w-4 h-4 text-blue-400" />;
    case "image":
      return <Image className="w-4 h-4 text-green-400" />;
    case "pdf":
      return <FileType2 className="w-4 h-4 text-red-400" />;
    case "office":
      return <FileSpreadsheet className="w-4 h-4 text-blue-500" />;
    case "text":
      return <Code className="w-4 h-4 text-yellow-400" />;
    default:
      return <File className="w-4 h-4 text-dark-text-muted" />;
  }
}

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
  const [viewMode, setViewMode] = useState<ViewMode>("wysiwyg");

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
                {getFileIcon(file.fileType, hasPendingChange)}
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

        {/* View Mode Toggle - only for markdown files */}
        {activeFileData?.fileType === "markdown" && (
          <div className="flex items-center gap-1 px-2 border-l border-dark-border">
            <button
              onClick={() => setViewMode("wysiwyg")}
              className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "wysiwyg"
                  ? "bg-dark-active text-white"
                  : "text-dark-text-muted hover:bg-dark-hover hover:text-dark-text"
              }`}
              title="WYSIWYG Editor (wie Obsidian)"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("source")}
              className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "source"
                  ? "bg-dark-active text-white"
                  : "text-dark-text-muted hover:bg-dark-hover hover:text-dark-text"
              }`}
              title="Quellcode Ansicht"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>
        )}
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
            <div className="flex-1 overflow-hidden">
              {/* Render based on file type */}
              {activeFileData.fileType === "image" && (
                <ImageViewer
                  filePath={activeFileData.path}
                  fileName={activeFileData.name}
                />
              )}
              
              {activeFileData.fileType === "pdf" && (
                <PDFViewer
                  filePath={activeFileData.path}
                  fileName={activeFileData.name}
                />
              )}
              
              {activeFileData.fileType === "office" && (
                <OfficeViewer
                  filePath={activeFileData.path}
                  fileName={activeFileData.name}
                  binaryContent={activeFileData.binaryContent}
                />
              )}
              
              {activeFileData.fileType === "markdown" && (
                viewMode === "wysiwyg" ? (
                  <WysiwygEditor
                    key={activeFileData.path}
                    content={activeFileData.content}
                    filePath={activeFileData.path}
                  />
                ) : (
                  <MarkdownEditor
                    content={activeFileData.content}
                    filePath={activeFileData.path}
                  />
                )
              )}
              
              {(activeFileData.fileType === "text" || activeFileData.fileType === "unknown") && (
                <MarkdownEditor
                  content={activeFileData.content}
                  filePath={activeFileData.path}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { X, File, Folder, Calendar, Clock, HardDrive } from "lucide-react";
import { FileNode } from "../stores/appStore";

interface FileInfoDialogProps {
  node: FileNode;
  onClose: () => void;
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "Unbekannt";
  return new Date(timestamp).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return "Unbekannt";
  if (bytes === 0) return "0 Bytes";
  
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop();
  return ext && ext !== filename ? ext.toUpperCase() : "Keine";
}

export default function FileInfoDialog({ node, onClose }: FileInfoDialogProps) {
  const metadata = node.metadata;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-panel border border-dark-border rounded-lg shadow-xl w-[400px] max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            {node.isDirectory ? (
              <Folder className="w-5 h-5 text-blue-400" />
            ) : (
              <File className="w-5 h-5 text-dark-text-muted" />
            )}
            <h2 className="text-lg font-semibold text-dark-text">Informationen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-dark-text-muted uppercase tracking-wide">Name</label>
            <p className="text-dark-text mt-1 font-medium break-all">{node.name}</p>
          </div>
          
          {/* Path */}
          <div>
            <label className="text-xs text-dark-text-muted uppercase tracking-wide">Pfad</label>
            <p className="text-dark-text-muted mt-1 text-sm break-all font-mono">{node.path}</p>
          </div>
          
          {/* Type */}
          <div>
            <label className="text-xs text-dark-text-muted uppercase tracking-wide">Typ</label>
            <p className="text-dark-text mt-1">
              {node.isDirectory ? "Ordner" : `${getFileExtension(node.name)} Datei`}
            </p>
          </div>
          
          {/* Size - only for files */}
          {!node.isDirectory && (
            <div className="flex items-start gap-3">
              <HardDrive className="w-4 h-4 text-dark-text-muted mt-0.5" />
              <div>
                <label className="text-xs text-dark-text-muted uppercase tracking-wide">Größe</label>
                <p className="text-dark-text mt-1">{formatSize(metadata?.size)}</p>
              </div>
            </div>
          )}
          
          {/* Dates */}
          <div className="border-t border-dark-border pt-4 space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-dark-text-muted mt-0.5" />
              <div>
                <label className="text-xs text-dark-text-muted uppercase tracking-wide">Erstellt</label>
                <p className="text-dark-text mt-1">{formatDate(metadata?.created)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-dark-text-muted mt-0.5" />
              <div>
                <label className="text-xs text-dark-text-muted uppercase tracking-wide">Geändert</label>
                <p className="text-dark-text mt-1">{formatDate(metadata?.modified)}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-dark-text-muted mt-0.5" />
              <div>
                <label className="text-xs text-dark-text-muted uppercase tracking-wide">Letzter Zugriff</label>
                <p className="text-dark-text mt-1">{formatDate(metadata?.accessed)}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-dark-active text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

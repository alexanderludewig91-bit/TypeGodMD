import { useState } from "react";
import { X, AlertTriangle, Replace, Pencil } from "lucide-react";

interface MoveConflictDialogProps {
  isOpen: boolean;
  fileName: string;
  onCancel: () => void;
  onReplace: () => void;
  onRename: (newName: string) => void;
}

function generateNewName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return `${fileName} (Kopie)`;
  }
  const name = fileName.substring(0, lastDot);
  const ext = fileName.substring(lastDot);
  return `${name} (Kopie)${ext}`;
}

export default function MoveConflictDialog({
  isOpen,
  fileName,
  onCancel,
  onReplace,
  onRename,
}: MoveConflictDialogProps) {
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [newName, setNewName] = useState(generateNewName(fileName));

  if (!isOpen) return null;

  const handleRenameClick = () => {
    setNewName(generateNewName(fileName));
    setShowRenameInput(true);
  };

  const handleRenameConfirm = () => {
    if (newName.trim() && newName !== fileName) {
      onRename(newName.trim());
    }
  };

  const handleCancel = () => {
    setShowRenameInput(false);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar border border-dark-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-medium text-white">Datei existiert bereits</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-dark-text mb-4">
            Am Zielort existiert bereits eine Datei mit dem Namen <strong className="text-white">"{fileName}"</strong>.
          </p>
          <p className="text-dark-text-muted text-sm">
            Was möchtest du tun?
          </p>
        </div>

        {/* Rename Input (conditional) */}
        {showRenameInput && (
          <div className="px-4 pb-4">
            <label className="text-sm text-dark-text-muted mb-2 block">Neuer Name:</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-3 py-2 text-dark-text placeholder-dark-text-muted focus:outline-none focus:border-dark-accent transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape") setShowRenameInput(false);
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-dark-border space-y-2">
          {!showRenameInput ? (
            <>
              {/* Rename Option */}
              <button
                onClick={handleRenameClick}
                className="w-full flex items-center gap-3 px-4 py-3 bg-dark-panel hover:bg-dark-hover rounded-lg transition-colors text-left"
              >
                <Pencil className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-dark-text font-medium">Umbenennen</p>
                  <p className="text-dark-text-muted text-sm">Datei unter neuem Namen verschieben</p>
                </div>
              </button>

              {/* Replace Option */}
              <button
                onClick={onReplace}
                className="w-full flex items-center gap-3 px-4 py-3 bg-dark-panel hover:bg-red-900/30 rounded-lg transition-colors text-left group"
              >
                <Replace className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-dark-text font-medium group-hover:text-red-300">Ersetzen</p>
                  <p className="text-dark-text-muted text-sm">Vorhandene Datei überschreiben</p>
                </div>
              </button>

              {/* Cancel */}
              <button
                onClick={handleCancel}
                className="w-full px-4 py-2 text-dark-text-muted hover:text-dark-text transition-colors text-center mt-2"
              >
                Abbrechen
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRenameInput(false)}
                className="px-4 py-2 text-sm text-dark-text-muted hover:text-dark-text transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={handleRenameConfirm}
                disabled={!newName.trim() || newName === fileName}
                className="px-4 py-2 bg-dark-accent text-white text-sm rounded-lg hover:bg-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Umbenennen & Verschieben
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

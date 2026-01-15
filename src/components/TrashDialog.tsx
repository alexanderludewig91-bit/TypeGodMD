import { useState, useEffect } from "react";
import { X, Trash2, RotateCcw, AlertTriangle, File, Folder, Loader2 } from "lucide-react";
import { FileNode } from "../stores/appStore";
import { getTrashContents, restoreFromTrash, emptyTrash, permanentlyDelete } from "../services/trash";
import ConfirmDialog from "./ConfirmDialog";

interface TrashDialogProps {
  isOpen: boolean;
  projectPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TrashDialog({
  isOpen,
  projectPath,
  onClose,
  onRefresh,
}: TrashDialogProps) {
  const [trashContents, setTrashContents] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileNode | null>(null);

  const loadTrashContents = async () => {
    setIsLoading(true);
    try {
      const contents = await getTrashContents(projectPath);
      setTrashContents(contents);
    } catch (error) {
      console.error("Error loading trash contents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrashContents();
    }
  }, [isOpen, projectPath]);

  const handleRestore = async (item: FileNode) => {
    try {
      await restoreFromTrash(item.path, projectPath);
      await loadTrashContents();
      onRefresh();
    } catch (error) {
      console.error("Error restoring file:", error);
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await permanentlyDelete(itemToDelete.path, itemToDelete.isDirectory);
      await loadTrashContents();
      onRefresh();
    } catch (error) {
      console.error("Error permanently deleting:", error);
    }
    setItemToDelete(null);
  };

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash(projectPath);
      await loadTrashContents();
      onRefresh();
    } catch (error) {
      console.error("Error emptying trash:", error);
    }
    setShowEmptyConfirm(false);
  };

  if (!isOpen) return null;

  // Show confirm dialogs
  if (showEmptyConfirm) {
    return (
      <ConfirmDialog
        isOpen={true}
        title="Papierkorb leeren"
        message={`Möchtest du den Papierkorb wirklich leeren? ${trashContents.length} Element(e) werden endgültig gelöscht. Dies kann nicht rückgängig gemacht werden!`}
        confirmText="Papierkorb leeren"
        danger={true}
        onConfirm={handleEmptyTrash}
        onCancel={() => setShowEmptyConfirm(false)}
      />
    );
  }

  if (itemToDelete) {
    return (
      <ConfirmDialog
        isOpen={true}
        title="Endgültig löschen"
        message={`Möchtest du "${itemToDelete.name}" endgültig löschen? Dies kann nicht rückgängig gemacht werden!`}
        confirmText="Endgültig löschen"
        danger={true}
        onConfirm={handlePermanentDelete}
        onCancel={() => setItemToDelete(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-panel border border-dark-border rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-dark-text-muted" />
            <h2 className="text-lg font-semibold text-dark-text">Papierkorb</h2>
            <span className="text-sm text-dark-text-muted">
              ({trashContents.length} Element{trashContents.length !== 1 ? "e" : ""})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-dark-text-muted" />
            </div>
          ) : trashContents.length === 0 ? (
            <div className="text-center py-8">
              <Trash2 className="w-12 h-12 text-dark-text-muted mx-auto mb-4 opacity-30" />
              <p className="text-dark-text-muted">Der Papierkorb ist leer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trashContents.map((item) => (
                <div
                  key={item.path}
                  className="flex items-center gap-3 p-3 bg-dark-sidebar rounded-lg hover:bg-dark-hover transition-colors group"
                >
                  {item.isDirectory ? (
                    <Folder className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-dark-text-muted flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-dark-text truncate">{item.name}</p>
                    {item.metadata?.modified && (
                      <p className="text-xs text-dark-text-muted">
                        Gelöscht: {new Date(item.metadata.modified).toLocaleString("de-DE")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(item)}
                      className="p-2 rounded hover:bg-dark-active text-dark-text-muted hover:text-green-400 transition-colors"
                      title="Wiederherstellen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setItemToDelete(item)}
                      className="p-2 rounded hover:bg-dark-active text-dark-text-muted hover:text-red-400 transition-colors"
                      title="Endgültig löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-dark-text-muted hover:text-dark-text transition-colors"
          >
            Schließen
          </button>
          
          {trashContents.length > 0 && (
            <button
              onClick={() => setShowEmptyConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Papierkorb leeren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

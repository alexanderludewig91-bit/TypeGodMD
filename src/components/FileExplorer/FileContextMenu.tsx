import { useEffect, useRef, useState } from "react";
import {
  File,
  FolderPlus,
  Pencil,
  Trash2,
  Info,
  FolderOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { FileNode, useAppStore } from "../../stores/appStore";
import {
  createFile,
  createDirectory,
  renameFile,
  fileExists,
} from "../../services/fileSystem";
import { moveToTrash, isInTrash, permanentlyDelete } from "../../services/trash";
import InputDialog from "../InputDialog";
import ConfirmDialog from "../ConfirmDialog";
import FileInfoDialog from "../FileInfoDialog";

interface FileContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  onClose: () => void;
}

type DialogType = "none" | "newFile" | "newFolder" | "rename" | "delete" | "info";

export default function FileContextMenu({
  x,
  y,
  node,
  onClose,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentProject, refreshFileTree, closeFile, openFile } = useAppStore();
  const [activeDialog, setActiveDialog] = useState<DialogType>("none");
  const [dialogError, setDialogError] = useState<string | undefined>();
  const dialogRef = useRef<DialogType>("none");

  // Keep ref in sync with state
  useEffect(() => {
    dialogRef.current = activeDialog;
  }, [activeDialog]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if a dialog is open
      if (dialogRef.current !== "none") {
        return;
      }
      
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dialogRef.current !== "none") {
          setActiveDialog("none");
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current && activeDialog === "none") {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedX = Math.min(x, window.innerWidth - rect.width - 10);
      const adjustedY = Math.min(y, window.innerHeight - rect.height - 10);
      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y, activeDialog]);

  const getBasePath = () => {
    return node?.isDirectory
      ? node.path
      : node?.path.substring(0, node.path.lastIndexOf("/")) ||
        currentProject?.path || "";
  };

  const handleCreateFile = async (fileName: string) => {
    const basePath = getBasePath();
    if (!basePath) return;

    const filePath = `${basePath}/${fileName}`;
    
    // Check if file already exists
    const exists = await fileExists(filePath);
    if (exists) {
      setDialogError(`Eine Datei mit dem Namen "${fileName}" existiert bereits.`);
      return;
    }
    
    const title = fileName.replace(".md", "").replace(/-/g, " ");
    
    try {
      await createFile(filePath, `# ${title}\n\n`);
      await refreshFileTree();
      await openFile(filePath);
      setDialogError(undefined);
      setActiveDialog("none");
      onClose();
    } catch (error) {
      console.error("Error creating file:", error);
      setDialogError("Fehler beim Erstellen der Datei.");
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    const basePath = getBasePath();
    if (!basePath) return;

    const folderPath = `${basePath}/${folderName}`;
    
    // Check if folder already exists
    const exists = await fileExists(folderPath);
    if (exists) {
      setDialogError(`Ein Ordner mit dem Namen "${folderName}" existiert bereits.`);
      return;
    }
    
    try {
      await createDirectory(folderPath);
      await refreshFileTree();
      setDialogError(undefined);
      setActiveDialog("none");
      onClose();
    } catch (error) {
      console.error("Error creating folder:", error);
      setDialogError("Fehler beim Erstellen des Ordners.");
    }
  };

  const handleRename = async (newName: string) => {
    if (!node || newName === node.name) {
      setActiveDialog("none");
      setDialogError(undefined);
      onClose();
      return;
    }

    const parentPath = node.path.substring(0, node.path.lastIndexOf("/"));
    const newPath = `${parentPath}/${newName}`;
    
    // Check if target already exists
    const exists = await fileExists(newPath);
    if (exists) {
      setDialogError(`"${newName}" existiert bereits.`);
      return;
    }

    try {
      await renameFile(node.path, newPath);
      await refreshFileTree();
      setDialogError(undefined);
      setActiveDialog("none");
      onClose();
    } catch (error) {
      console.error("Error renaming:", error);
      setDialogError("Fehler beim Umbenennen.");
    }
  };

  const handleDelete = async () => {
    if (!node || !currentProject) return;

    try {
      // Check if already in trash - if so, permanently delete
      if (isInTrash(node.path, currentProject.path)) {
        await permanentlyDelete(node.path, node.isDirectory);
      } else {
        // Move to trash
        await moveToTrash(node.path, currentProject.path);
      }
      
      // Close file if it was open
      if (!node.isDirectory) {
        closeFile(node.path);
      }
      
      await refreshFileTree();
    } catch (error) {
      console.error("Error deleting:", error);
    }
    
    setActiveDialog("none");
    onClose();
  };

  const handleCancel = () => {
    setActiveDialog("none");
    setDialogError(undefined);
    onClose();
  };

  const handleRevealInFinder = async () => {
    const pathToReveal = node?.path || currentProject?.path;
    if (!pathToReveal) return;

    try {
      // Use Tauri command to reveal in Finder
      await invoke("reveal_in_finder", { path: pathToReveal });
    } catch (error) {
      console.error("Error opening Finder:", error);
    }
    onClose();
  };

  // Render dialogs
  if (activeDialog === "newFile") {
    return (
      <InputDialog
        isOpen={true}
        title="Neue Datei erstellen"
        placeholder="dateiname.md"
        defaultValue="neue-notiz.md"
        error={dialogError}
        onConfirm={handleCreateFile}
        onCancel={handleCancel}
      />
    );
  }

  if (activeDialog === "newFolder") {
    return (
      <InputDialog
        isOpen={true}
        title="Neuen Ordner erstellen"
        placeholder="Ordnername"
        defaultValue=""
        error={dialogError}
        onConfirm={handleCreateFolder}
        onCancel={handleCancel}
      />
    );
  }

  if (activeDialog === "rename" && node) {
    return (
      <InputDialog
        isOpen={true}
        title="Umbenennen"
        placeholder="Neuer Name"
        defaultValue={node.name}
        error={dialogError}
        confirmText="Umbenennen"
        onConfirm={handleRename}
        onCancel={handleCancel}
      />
    );
  }

  if (activeDialog === "delete" && node && currentProject) {
    const inTrash = isInTrash(node.path, currentProject.path);
    return (
      <ConfirmDialog
        isOpen={true}
        title={inTrash ? "Endgültig löschen" : "In Papierkorb verschieben"}
        message={inTrash 
          ? `Möchtest du "${node.name}" endgültig löschen? Dies kann nicht rückgängig gemacht werden!`
          : `Möchtest du "${node.name}" in den Papierkorb verschieben?`
        }
        confirmText={inTrash ? "Endgültig löschen" : "In Papierkorb"}
        danger={inTrash}
        onConfirm={handleDelete}
        onCancel={handleCancel}
      />
    );
  }

  if (activeDialog === "info" && node) {
    return (
      <FileInfoDialog
        node={node}
        onClose={handleCancel}
      />
    );
  }

  // Build menu items based on whether a node is selected
  const menuItems: Array<{
    icon: typeof File;
    label: string;
    onClick: () => void;
    danger?: boolean;
  } | { divider: true }> = [
    {
      icon: File,
      label: "Neue Datei",
      onClick: () => setActiveDialog("newFile"),
    },
    {
      icon: FolderPlus,
      label: "Neuer Ordner",
      onClick: () => setActiveDialog("newFolder"),
    },
  ];

  // Add rename/delete/info options only if a node is selected
  if (node) {
    menuItems.push({ divider: true });
    menuItems.push({
      icon: FolderOpen,
      label: "Im Finder zeigen",
      onClick: handleRevealInFinder,
    });
    menuItems.push({
      icon: Info,
      label: "Information",
      onClick: () => setActiveDialog("info"),
    });
    menuItems.push({
      icon: Pencil,
      label: "Umbenennen",
      onClick: () => setActiveDialog("rename"),
    });
    menuItems.push({
      icon: Trash2,
      label: "Löschen",
      onClick: () => setActiveDialog("delete"),
      danger: true,
    });
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-dark-panel border border-dark-border rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) =>
        "divider" in item ? (
          <div key={index} className="border-t border-dark-border my-1" />
        ) : (
          <button
            key={index}
            onClick={item.onClick}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-dark-hover transition-colors ${
              item.danger
                ? "text-red-400 hover:text-red-300"
                : "text-dark-text"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

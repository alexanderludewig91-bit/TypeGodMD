import { useEffect, useState, useRef, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  RefreshCw,
  Move,
  ArrowUpAZ,
  ArrowDownAZ,
  Clock,
  FileType,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { useAppStore, FileNode } from "../../stores/appStore";
import { loadDirectoryChildren, createFile, createDirectory, renameFile, fileExists } from "../../services/fileSystem";
import { isTrashFolder } from "../../services/trash";
import FileContextMenu from "./FileContextMenu";
import InputDialog from "../InputDialog";
import MoveConflictDialog from "../MoveConflictDialog";
import TrashDialog from "../TrashDialog";

type SortType = "name-asc" | "name-desc" | "date-desc" | "date-asc" | "type";

const SORT_OPTIONS: { value: SortType; label: string; icon: typeof ArrowUpAZ }[] = [
  { value: "name-asc", label: "Name (A-Z)", icon: ArrowUpAZ },
  { value: "name-desc", label: "Name (Z-A)", icon: ArrowDownAZ },
  { value: "date-desc", label: "Datum (Neueste)", icon: Clock },
  { value: "date-asc", label: "Datum (Älteste)", icon: Clock },
  { value: "type", label: "Typ", icon: FileType },
];

export default function FileExplorer() {
  const { currentProject, fileTree, refreshFileTree, openFile, selectedFile } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [fileDialogError, setFileDialogError] = useState<string | undefined>();
  const [folderDialogError, setFolderDialogError] = useState<string | undefined>();
  const [moveConflict, setMoveConflict] = useState<{
    node: FileNode;
    targetPath: string;
    newPath: string;
  } | null>(null);
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortType, setSortType] = useState<SortType>(() => {
    const saved = localStorage.getItem("explorer-sort-type");
    return (saved as SortType) || "name-asc";
  });
  
  // Save sort preference
  useEffect(() => {
    localStorage.setItem("explorer-sort-type", sortType);
  }, [sortType]);
  
  // Custom drag state
  const [draggedNode, setDraggedNode] = useState<FileNode | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentProject) {
      refreshFileTree();
    }
  }, [currentProject, refreshFileTree]);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortMenu]);

  // Sort function for file nodes (also filters out trash folder)
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    // Filter out the trash folder from the tree
    const filtered = currentProject 
      ? nodes.filter(node => !isTrashFolder(node.path, currentProject.path))
      : nodes;
    
    const sorted = [...filtered].sort((a, b) => {
      // Folders always first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      switch (sortType) {
        case "name-asc":
          return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
        case "name-desc":
          return b.name.localeCompare(a.name, "de", { sensitivity: "base" });
        case "date-desc": {
          // Sort by modified date, newest first
          const dateA = a.metadata?.modified ?? 0;
          const dateB = b.metadata?.modified ?? 0;
          if (dateA !== dateB) return dateB - dateA;
          return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
        }
        case "date-asc": {
          // Sort by modified date, oldest first
          const dateA = a.metadata?.modified ?? 0;
          const dateB = b.metadata?.modified ?? 0;
          if (dateA !== dateB) return dateA - dateB;
          return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
        }
        case "type": {
          const extA = a.name.includes(".") ? a.name.split(".").pop() || "" : "";
          const extB = b.name.includes(".") ? b.name.split(".").pop() || "" : "";
          if (extA !== extB) return extA.localeCompare(extB);
          return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
        }
        default:
          return 0;
      }
    });
    
    // Recursively sort children
    return sorted.map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined,
    }));
  };

  const sortedFileTree = useMemo(() => sortNodes(fileTree), [fileTree, sortType]);

  // Global mouse move and mouse up handlers for drag
  useEffect(() => {
    if (!draggedNode) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
      
      // Find element under cursor
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      let foundTarget: string | null = null;
      
      for (const el of elementsUnder) {
        const path = el.getAttribute('data-folder-path');
        if (path && path !== draggedNode.path && !path.startsWith(draggedNode.path + "/")) {
          foundTarget = path;
          break;
        }
      }
      
      // Check if over root area
      if (!foundTarget && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (currentProject && currentProject.path !== draggedNode.path.substring(0, draggedNode.path.lastIndexOf("/"))) {
            foundTarget = currentProject.path;
          }
        }
      }
      
      setDropTarget(foundTarget);
    };

    const handleMouseUp = async () => {
      if (dropTarget && draggedNode) {
        await moveToFolder(draggedNode, dropTarget);
      }
      setDraggedNode(null);
      setDropTarget(null);
      setDragPosition(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNode, dropTarget, currentProject]);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const closeContextMenu = () => setContextMenu(null);

  const getBasePath = (): string => {
    if (!currentProject) return "";
    
    if (selectedFile) {
      const findNode = (nodes: FileNode[], path: string): FileNode | null => {
        for (const node of nodes) {
          if (node.path === path) return node;
          if (node.children) {
            const found = findNode(node.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      
      const selectedNode = findNode(fileTree, selectedFile);
      if (selectedNode) {
        if (selectedNode.isDirectory) {
          return selectedNode.path;
        } else {
          return selectedNode.path.substring(0, selectedNode.path.lastIndexOf("/"));
        }
      }
    }
    
    return currentProject.path;
  };

  const handleCreateFile = async (fileName: string) => {
    if (!currentProject) return;
    
    const basePath = getBasePath();
    const filePath = `${basePath}/${fileName}`;
    
    // Check if file already exists
    const exists = await fileExists(filePath);
    if (exists) {
      setFileDialogError(`Eine Datei mit dem Namen "${fileName}" existiert bereits.`);
      return;
    }
    
    const title = fileName.replace(".md", "").replace(/-/g, " ");
    
    try {
      await createFile(filePath, `# ${title}\n\n`);
      await refreshFileTree();
      await openFile(filePath);
      setShowNewFileDialog(false);
      setFileDialogError(undefined);
    } catch (error) {
      console.error("Error creating file:", error);
      setFileDialogError("Fehler beim Erstellen der Datei.");
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!currentProject) return;
    
    const basePath = getBasePath();
    const folderPath = `${basePath}/${folderName}`;
    
    // Check if folder already exists
    const exists = await fileExists(folderPath);
    if (exists) {
      setFolderDialogError(`Ein Ordner mit dem Namen "${folderName}" existiert bereits.`);
      return;
    }
    
    try {
      await createDirectory(folderPath);
      await refreshFileTree();
      setShowNewFolderDialog(false);
      setFolderDialogError(undefined);
    } catch (error) {
      console.error("Error creating folder:", error);
      setFolderDialogError("Fehler beim Erstellen des Ordners.");
    }
  };

  const getLocationHint = (): string => {
    if (!currentProject) return "";
    const basePath = getBasePath();
    if (basePath === currentProject.path) {
      return "im Projektroot";
    }
    const folderName = basePath.split("/").pop() || "";
    return `in "${folderName}"`;
  };

  const moveToFolder = async (node: FileNode, targetPath: string, forceOverwrite = false) => {
    if (!currentProject) return;
    
    // Can't drop on itself or its children
    if (node.path === targetPath || targetPath.startsWith(node.path + "/")) {
      return;
    }
    
    const fileName = node.name;
    const newPath = `${targetPath}/${fileName}`;
    
    // Don't move if it's the same location
    const currentParent = node.path.substring(0, node.path.lastIndexOf("/"));
    if (currentParent === targetPath) {
      return;
    }
    
    // Check if target already exists (unless we're forcing overwrite)
    if (!forceOverwrite) {
      const exists = await fileExists(newPath);
      if (exists) {
        // Show conflict dialog
        setMoveConflict({ node, targetPath, newPath });
        return;
      }
    }
    
    try {
      console.log("Moving", node.path, "to", newPath);
      await renameFile(node.path, newPath);
      await refreshFileTree();
    } catch (error) {
      console.error("Error moving file:", error);
    }
  };
  
  const handleMoveConflictCancel = () => {
    setMoveConflict(null);
  };
  
  const handleMoveConflictReplace = async () => {
    if (!moveConflict) return;
    
    try {
      // Delete the existing file/folder first
      if (moveConflict.node.isDirectory) {
        const { deleteDirectory } = await import("../../services/fileSystem");
        await deleteDirectory(moveConflict.newPath);
      } else {
        const { deleteFile } = await import("../../services/fileSystem");
        await deleteFile(moveConflict.newPath);
      }
      
      // Now move
      await renameFile(moveConflict.node.path, moveConflict.newPath);
      await refreshFileTree();
    } catch (error) {
      console.error("Error replacing file:", error);
    }
    
    setMoveConflict(null);
  };
  
  const handleMoveConflictRename = async (newName: string) => {
    if (!moveConflict) return;
    
    const renamedPath = `${moveConflict.targetPath}/${newName}`;
    
    // Check if the new name also exists
    const exists = await fileExists(renamedPath);
    if (exists) {
      // Update the conflict with the new attempted name
      setMoveConflict({
        ...moveConflict,
        node: { ...moveConflict.node, name: newName },
        newPath: renamedPath,
      });
      return;
    }
    
    try {
      await renameFile(moveConflict.node.path, renamedPath);
      await refreshFileTree();
    } catch (error) {
      console.error("Error moving with rename:", error);
    }
    
    setMoveConflict(null);
  };

  const startDrag = (node: FileNode, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedNode(node);
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <span className="text-xs font-medium text-dark-text-muted uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          {/* Sort Button */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`p-1 rounded transition-colors ${
                showSortMenu 
                  ? "bg-dark-active text-white" 
                  : "hover:bg-dark-hover text-dark-text-muted hover:text-dark-text"
              }`}
              title="Sortierung"
            >
              {sortType === "name-asc" && <ArrowUpAZ className="w-4 h-4" />}
              {sortType === "name-desc" && <ArrowDownAZ className="w-4 h-4" />}
              {(sortType === "date-desc" || sortType === "date-asc") && <Clock className="w-4 h-4" />}
              {sortType === "type" && <FileType className="w-4 h-4" />}
            </button>
            
            {/* Sort Dropdown */}
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 bg-dark-panel border border-dark-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortType(option.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      sortType === option.value
                        ? "bg-dark-active text-white"
                        : "text-dark-text hover:bg-dark-hover"
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                    {sortType === option.value && (
                      <ChevronUp className="w-3 h-3 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={() => refreshFileTree()}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewFileDialog(true)}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title={`Neue Datei ${getLocationHint()}`}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewFolderDialog(true)}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title={`Neuer Ordner ${getLocationHint()}`}
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTrashDialog(true)}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
            title="Papierkorb"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div
        ref={containerRef}
        data-folder-path={currentProject?.path}
        className={`flex-1 overflow-y-auto py-1 ${
          dropTarget === currentProject?.path ? "bg-dark-accent/20" : ""
        }`}
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {sortedFileTree.length === 0 ? (
          <div className="p-4 text-dark-text-muted text-sm text-center">
            Keine Dateien gefunden
          </div>
        ) : (
          sortedFileTree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onContextMenu={handleContextMenu}
              draggedNode={draggedNode}
              dropTarget={dropTarget}
              onStartDrag={startDrag}
              sortType={sortType}
            />
          ))
        )}
      </div>

      {/* Drag Preview */}
      {draggedNode && dragPosition && (
        <div
          className="fixed pointer-events-none z-50 bg-dark-panel border border-dark-accent rounded px-2 py-1 text-sm text-dark-text flex items-center gap-2 shadow-lg"
          style={{
            left: dragPosition.x + 10,
            top: dragPosition.y + 10,
          }}
        >
          <Move className="w-3 h-3 text-dark-accent" />
          {draggedNode.name}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={closeContextMenu}
        />
      )}

      {/* New File Dialog */}
      <InputDialog
        isOpen={showNewFileDialog}
        title={`Neue Datei erstellen ${getLocationHint()}`}
        placeholder="dateiname.md"
        defaultValue="neue-notiz.md"
        error={fileDialogError}
        onConfirm={handleCreateFile}
        onCancel={() => {
          setShowNewFileDialog(false);
          setFileDialogError(undefined);
        }}
      />

      {/* New Folder Dialog */}
      <InputDialog
        isOpen={showNewFolderDialog}
        title={`Neuen Ordner erstellen ${getLocationHint()}`}
        placeholder="Ordnername"
        defaultValue=""
        error={folderDialogError}
        onConfirm={handleCreateFolder}
        onCancel={() => {
          setShowNewFolderDialog(false);
          setFolderDialogError(undefined);
        }}
      />

      {/* Move Conflict Dialog */}
      <MoveConflictDialog
        isOpen={moveConflict !== null}
        fileName={moveConflict?.node.name ?? ""}
        onCancel={handleMoveConflictCancel}
        onReplace={handleMoveConflictReplace}
        onRename={handleMoveConflictRename}
      />

      {/* Trash Dialog */}
      {currentProject && (
        <TrashDialog
          isOpen={showTrashDialog}
          projectPath={currentProject.path}
          onClose={() => setShowTrashDialog(false)}
          onRefresh={refreshFileTree}
        />
      )}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  draggedNode: FileNode | null;
  dropTarget: string | null;
  onStartDrag: (node: FileNode, e: React.MouseEvent) => void;
  sortType: SortType;
}

function FileTreeNode({
  node,
  depth,
  onContextMenu,
  draggedNode,
  dropTarget,
  onStartDrag,
  sortType,
}: FileTreeNodeProps) {
  const { selectedFile, openFile, toggleDirectory, setFileTree, fileTree, setSelectedFile } =
    useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  const isSelected = selectedFile === node.path;
  const isMarkdown = node.name.endsWith(".md");
  const isBeingDragged = draggedNode?.path === node.path;
  const isDropTarget = dropTarget === node.path && node.isDirectory;

  const handleClick = async () => {
    if (draggedNode) return; // Don't click while dragging
    
    setSelectedFile(node.path);
    
    if (node.isDirectory) {
      if (node.children?.length === 0 && !node.isExpanded) {
        setIsLoading(true);
        try {
          const children = await loadDirectoryChildren(node.path);
          const updateTree = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((n) => {
              if (n.path === node.path) {
                return { ...n, children, isExpanded: true };
              }
              if (n.children) {
                return { ...n, children: updateTree(n.children) };
              }
              return n;
            });
          };
          setFileTree(updateTree(fileTree));
        } finally {
          setIsLoading(false);
        }
      } else {
        toggleDirectory(node.path);
      }
    } else {
      openFile(node.path);
    }
  };

  const handleDoubleClick = () => {
    if (!node.isDirectory) {
      openFile(node.path);
    }
  };

  const handleContextMenuEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag on left mouse button
    if (e.button !== 0) return;
    
    // Start drag after a small delay to distinguish from click
    const startX = e.clientX;
    const startY = e.clientY;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      
      // Only start drag if moved more than 5 pixels
      if (dx > 5 || dy > 5) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onStartDrag(node, e);
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div>
      <div
        data-folder-path={node.isDirectory ? node.path : undefined}
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors select-none ${
          isSelected ? "bg-dark-active" : "hover:bg-dark-hover"
        } ${isBeingDragged ? "opacity-40" : ""} ${
          isDropTarget ? "bg-dark-accent/30 outline outline-2 outline-dashed outline-dark-accent -outline-offset-2" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenuEvent}
        onMouseDown={handleMouseDown}
      >
        {/* Expand/Collapse Icon */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {node.isDirectory ? (
            isLoading ? (
              <RefreshCw className="w-3 h-3 text-dark-text-muted animate-spin" />
            ) : node.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-dark-text-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-dark-text-muted" />
            )
          ) : null}
        </span>

        {/* File/Folder Icon */}
        <span className="flex-shrink-0">
          {node.isDirectory ? (
            node.isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-500" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-500" />
            )
          ) : (
            <File
              className={`w-4 h-4 ${
                isMarkdown ? "text-blue-400" : "text-dark-text-muted"
              }`}
            />
          )}
        </span>

        {/* Name */}
        <span
          className={`text-sm truncate ${
            isSelected ? "text-white" : "text-dark-text"
          }`}
        >
          {node.name}
        </span>
      </div>

      {/* Children */}
      {node.isDirectory && node.isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              draggedNode={draggedNode}
              dropTarget={dropTarget}
              onStartDrag={onStartDrag}
              sortType={sortType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

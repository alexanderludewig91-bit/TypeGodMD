import { FileNode, FileMetadata } from "../stores/appStore";

// Check if we're running in Tauri
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI__" in window;
};

async function getFileMetadata(filePath: string): Promise<FileMetadata | undefined> {
  if (!isTauri()) return undefined;
  
  try {
    const { stat } = await import("@tauri-apps/plugin-fs");
    const stats = await stat(filePath);
    
    return {
      size: stats.size,
      modified: stats.mtime ? new Date(stats.mtime).getTime() : null,
      created: stats.birthtime ? new Date(stats.birthtime).getTime() : null,
      accessed: stats.atime ? new Date(stats.atime).getTime() : null,
    };
  } catch (error) {
    console.warn("Could not get metadata for", filePath, error);
    return undefined;
  }
}

export async function readDirectory(dirPath: string): Promise<FileNode[]> {
  if (isTauri()) {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    
    const processEntries = async (basePath: string): Promise<FileNode[]> => {
      const entries = await readDir(basePath);
      const nodes: FileNode[] = [];
      
      for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.name.startsWith(".")) continue;
        
        const fullPath = `${basePath}/${entry.name}`;
        const isDir = entry.isDirectory;
        const metadata = await getFileMetadata(fullPath);
        
        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          isDirectory: isDir,
          isExpanded: false,
          metadata,
        };
        
        // Only load children for directories when expanded (lazy loading)
        if (isDir) {
          node.children = [];
        }
        
        nodes.push(node);
      }
      
      // Sort: directories first, then alphabetically
      return nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    };
    
    return processEntries(dirPath);
  }
  
  // Fallback for development without Tauri
  console.warn("Tauri not available, using mock data");
  return [
    {
      name: "notes",
      path: `${dirPath}/notes`,
      isDirectory: true,
      isExpanded: false,
      children: [],
    },
    {
      name: "README.md",
      path: `${dirPath}/README.md`,
      isDirectory: false,
    },
  ];
}

// Export getFileMetadata for use in other components
export { getFileMetadata };

export async function readDirectoryRecursive(dirPath: string): Promise<FileNode[]> {
  if (isTauri()) {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    
    const processEntries = async (basePath: string): Promise<FileNode[]> => {
      const entries = await readDir(basePath);
      const nodes: FileNode[] = [];
      
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        
        const fullPath = `${basePath}/${entry.name}`;
        const isDir = entry.isDirectory;
        const metadata = await getFileMetadata(fullPath);
        
        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          isDirectory: isDir,
          isExpanded: false,
          metadata,
        };
        
        if (isDir) {
          node.children = await processEntries(fullPath);
        }
        
        nodes.push(node);
      }
      
      return nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    };
    
    return processEntries(dirPath);
  }
  
  return readDirectory(dirPath);
}

export async function loadDirectoryChildren(dirPath: string): Promise<FileNode[]> {
  return readDirectory(dirPath);
}

export async function readTextFile(filePath: string): Promise<string> {
  if (isTauri()) {
    const { readTextFile: tauriRead } = await import("@tauri-apps/plugin-fs");
    return tauriRead(filePath);
  }
  
  // Fallback
  console.warn("Tauri not available, returning mock content");
  return `# Welcome to TypeGodMD\n\nThis is a placeholder file.`;
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  if (isTauri()) {
    const { writeTextFile: tauriWrite } = await import("@tauri-apps/plugin-fs");
    await tauriWrite(filePath, content);
    return;
  }
  
  console.warn("Tauri not available, cannot write file");
}

export async function createFile(filePath: string, content: string = ""): Promise<void> {
  // Ensure parent directory exists
  const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (parentDir) {
    try {
      await createDirectory(parentDir);
    } catch {
      // Directory might already exist, ignore error
    }
  }
  await writeTextFile(filePath, content);
}

export async function createDirectory(dirPath: string): Promise<void> {
  if (isTauri()) {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(dirPath, { recursive: true });
    return;
  }
  
  console.warn("Tauri not available, cannot create directory");
}

export async function deleteFile(filePath: string): Promise<void> {
  console.log("deleteFile called:", filePath);
  if (isTauri()) {
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(filePath);
      console.log("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
    return;
  }
  
  console.warn("Tauri not available, cannot delete file");
}

export async function deleteDirectory(dirPath: string): Promise<void> {
  console.log("deleteDirectory called:", dirPath);
  if (isTauri()) {
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(dirPath, { recursive: true });
      console.log("Directory deleted successfully");
    } catch (error) {
      console.error("Error deleting directory:", error);
      throw error;
    }
    return;
  }
  
  console.warn("Tauri not available, cannot delete directory");
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  console.log("renameFile called:", oldPath, "->", newPath);
  if (isTauri()) {
    try {
      const { rename } = await import("@tauri-apps/plugin-fs");
      await rename(oldPath, newPath);
      console.log("File renamed successfully");
    } catch (error) {
      console.error("Error renaming file:", error);
      throw error;
    }
    return;
  }
  
  console.warn("Tauri not available, cannot rename file");
}

export async function fileExists(filePath: string): Promise<boolean> {
  if (isTauri()) {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return exists(filePath);
  }
  
  return false;
}

export async function selectDirectory(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Projektordner auswählen",
      });
      return selected as string | null;
    } catch (error) {
      console.error("Error opening directory dialog:", error);
      return null;
    }
  }
  
  console.warn("Tauri not available, cannot open dialog");
  return null;
}

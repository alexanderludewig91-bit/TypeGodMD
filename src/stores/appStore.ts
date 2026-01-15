import { create } from "zustand";

export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
}

export interface FileMetadata {
  size: number;
  modified: number | null;  // Unix timestamp in milliseconds
  created: number | null;   // Unix timestamp in milliseconds
  accessed: number | null;  // Unix timestamp in milliseconds
}

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
  metadata?: FileMetadata;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface PendingChange {
  id: string;
  filePath: string;
  fileName: string;
  originalContent: string;
  newContent: string;
  timestamp: Date;
}

interface AppState {
  // Initialization
  initialized: boolean;
  initialize: () => Promise<void>;

  // Projects
  currentProject: Project | null;
  recentProjects: Project[];
  setCurrentProject: (project: Project | null) => void;
  addRecentProject: (project: Project) => void;
  loadRecentProjects: () => Promise<void>;

  // File Explorer
  fileTree: FileNode[];
  selectedFile: string | null;
  setFileTree: (tree: FileNode[]) => void;
  setSelectedFile: (path: string | null) => void;
  toggleDirectory: (path: string) => void;
  refreshFileTree: () => Promise<void>;

  // Editor
  openFiles: OpenFile[];
  activeFile: string | null;
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  reloadOpenFiles: () => Promise<void>;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearChat: () => void;

  // Pending Changes (AI suggestions)
  pendingChanges: PendingChange[];
  addPendingChange: (change: Omit<PendingChange, "id" | "timestamp">) => void;
  acceptPendingChange: (id: string) => Promise<void>;
  rejectPendingChange: (id: string) => void;
  getPendingChangeForFile: (filePath: string) => PendingChange | undefined;

  // UI State
  sidebarWidth: number;
  chatWidth: number;
  setSidebarWidth: (width: number) => void;
  setChatWidth: (width: number) => void;
  showGraphView: boolean;
  setShowGraphView: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initialization
  initialized: false,
  initialize: async () => {
    // Load recent projects from storage
    await get().loadRecentProjects();
    
    // Load settings
    const storedApiKey = localStorage.getItem("openai_api_key") || "";
    const storedModel = localStorage.getItem("selected_model") || "gpt-4o";
    
    set({ 
      initialized: true,
      apiKey: storedApiKey,
      selectedModel: storedModel,
    });
  },

  // Projects
  currentProject: null,
  recentProjects: [],
  setCurrentProject: (project) => {
    set({ currentProject: project });
    if (project) {
      get().addRecentProject(project);
      get().refreshFileTree();
    }
  },
  addRecentProject: (project) => {
    const recent = get().recentProjects.filter((p) => p.path !== project.path);
    const updated = [project, ...recent].slice(0, 10);
    set({ recentProjects: updated });
    localStorage.setItem("recent_projects", JSON.stringify(updated));
  },
  loadRecentProjects: async () => {
    const stored = localStorage.getItem("recent_projects");
    if (stored) {
      try {
        const projects = JSON.parse(stored);
        set({ recentProjects: projects });
      } catch {
        set({ recentProjects: [] });
      }
    }
  },

  // File Explorer
  fileTree: [],
  selectedFile: null,
  setFileTree: (tree) => set({ fileTree: tree }),
  setSelectedFile: (path) => set({ selectedFile: path }),
  toggleDirectory: (path) => {
    const toggle = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.path === path && node.isDirectory) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: toggle(node.children) };
        }
        return node;
      });
    };
    set({ fileTree: toggle(get().fileTree) });
  },
  refreshFileTree: async () => {
    const project = get().currentProject;
    if (!project) return;
    
    // Collect currently expanded paths before refresh
    const collectExpandedPaths = (nodes: FileNode[]): Set<string> => {
      const paths = new Set<string>();
      const traverse = (nodeList: FileNode[]) => {
        for (const node of nodeList) {
          if (node.isDirectory && node.isExpanded) {
            paths.add(node.path);
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      };
      traverse(nodes);
      return paths;
    };
    
    try {
      const expandedPaths = collectExpandedPaths(get().fileTree);
      const { readDirectory } = await import("../services/fileSystem");
      
      // Restore expanded state and load children for expanded folders
      const restoreExpandedState = async (nodes: FileNode[]): Promise<FileNode[]> => {
        const result: FileNode[] = [];
        for (const node of nodes) {
          const isExpanded = node.isDirectory && expandedPaths.has(node.path);
          let children = node.children;
          
          // Load children for expanded directories
          if (isExpanded && node.isDirectory) {
            try {
              children = await readDirectory(node.path);
              // Recursively restore expanded state for children
              children = await restoreExpandedState(children);
            } catch (error) {
              console.error("Failed to load children for", node.path, error);
              children = [];
            }
          }
          
          result.push({
            ...node,
            isExpanded,
            children,
          });
        }
        return result;
      };
      
      const tree = await readDirectory(project.path);
      const treeWithExpandedState = await restoreExpandedState(tree);
      set({ fileTree: treeWithExpandedState });
    } catch (error) {
      console.error("Failed to read directory:", error);
    }
  },

  // Editor
  openFiles: [],
  activeFile: null,
  openFile: async (path) => {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFile: path });
      return;
    }

    try {
      const { readTextFile } = await import("../services/fileSystem");
      const content = await readTextFile(path);
      const name = path.split("/").pop() || path;
      
      set({
        openFiles: [...get().openFiles, { path, name, content, isDirty: false }],
        activeFile: path,
        selectedFile: path,
      });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  },
  closeFile: (path) => {
    const files = get().openFiles.filter((f) => f.path !== path);
    let newActive = get().activeFile;
    
    if (get().activeFile === path) {
      newActive = files.length > 0 ? files[files.length - 1].path : null;
    }
    
    set({ openFiles: files, activeFile: newActive });
  },
  setActiveFile: (path) => set({ activeFile: path, selectedFile: path }),
  updateFileContent: (path, content) => {
    set({
      openFiles: get().openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    });
  },
  saveFile: async (path) => {
    const file = get().openFiles.find((f) => f.path === path);
    if (!file) return;

    try {
      const { writeTextFile } = await import("../services/fileSystem");
      await writeTextFile(path, file.content);
      
      set({
        openFiles: get().openFiles.map((f) =>
          f.path === path ? { ...f, isDirty: false } : f
        ),
      });
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  },
  reloadOpenFiles: async () => {
    const { readTextFile } = await import("../services/fileSystem");
    const openFiles = get().openFiles;
    
    const reloadedFiles = await Promise.all(
      openFiles.map(async (file) => {
        // Don't reload files with unsaved changes
        if (file.isDirty) {
          return file;
        }
        
        try {
          const content = await readTextFile(file.path);
          return { ...file, content };
        } catch (error) {
          console.error("Failed to reload file:", file.path, error);
          return file;
        }
      })
    );
    
    set({ openFiles: reloadedFiles });
  },

  // Chat
  chatMessages: [],
  addChatMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    set({ chatMessages: [...get().chatMessages, newMessage] });
  },
  clearChat: () => set({ chatMessages: [] }),

  // Pending Changes
  pendingChanges: [],
  addPendingChange: (change) => {
    // Remove any existing pending change for the same file
    const filtered = get().pendingChanges.filter(c => c.filePath !== change.filePath);
    const newChange: PendingChange = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    set({ pendingChanges: [...filtered, newChange] });
  },
  acceptPendingChange: async (id) => {
    const change = get().pendingChanges.find(c => c.id === id);
    if (!change) return;
    
    try {
      const { writeTextFile } = await import("../services/fileSystem");
      await writeTextFile(change.filePath, change.newContent);
      
      // Update open file if it exists
      const openFiles = get().openFiles.map(f => 
        f.path === change.filePath 
          ? { ...f, content: change.newContent, isDirty: false }
          : f
      );
      
      // Remove the pending change
      const pendingChanges = get().pendingChanges.filter(c => c.id !== id);
      
      set({ openFiles, pendingChanges });
    } catch (error) {
      console.error("Failed to accept change:", error);
    }
  },
  rejectPendingChange: (id) => {
    set({ pendingChanges: get().pendingChanges.filter(c => c.id !== id) });
  },
  getPendingChangeForFile: (filePath) => {
    return get().pendingChanges.find(c => c.filePath === filePath);
  },

  // UI State
  sidebarWidth: 250,
  chatWidth: 350,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),
  setChatWidth: (width) => set({ chatWidth: Math.max(280, Math.min(600, width)) }),
  showGraphView: false,
  setShowGraphView: (show) => set({ showGraphView: show }),
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),

  // Settings
  apiKey: "",
  setApiKey: (key) => {
    localStorage.setItem("openai_api_key", key);
    set({ apiKey: key });
  },
  selectedModel: "gpt-4o",
  setSelectedModel: (model) => {
    localStorage.setItem("selected_model", model);
    set({ selectedModel: model });
  },
}));

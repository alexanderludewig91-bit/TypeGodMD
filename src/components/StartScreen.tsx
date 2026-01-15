import { FolderOpen, Plus, Clock, Trash2 } from "lucide-react";
import { useAppStore, Project } from "../stores/appStore";
import { selectDirectory } from "../services/fileSystem";

export default function StartScreen() {
  const { recentProjects, setCurrentProject } = useAppStore();

  const handleOpenProject = async () => {
    try {
      const path = await selectDirectory();
      if (path) {
        const name = path.split("/").pop() || "Projekt";
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          path,
          lastOpened: new Date(),
        };
        setCurrentProject(project);
      }
    } catch (error) {
      console.error("Error opening project:", error);
    }
  };

  const handleOpenRecent = (project: Project) => {
    setCurrentProject({
      ...project,
      lastOpened: new Date(),
    });
  };

  const handleRemoveRecent = (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation();
    const { recentProjects } = useAppStore.getState();
    const updated = recentProjects.filter((p) => p.path !== projectPath);
    localStorage.setItem("recent_projects", JSON.stringify(updated));
    useAppStore.setState({ recentProjects: updated });
  };

  return (
    <div className="h-screen w-screen bg-dark-bg flex items-center justify-center">
      <div className="max-w-2xl w-full px-8">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">TypeGodMD</h1>
          <p className="text-dark-text-muted">
            KI-gestütztes Wissensmanagement
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleOpenProject}
            className="flex flex-col items-center gap-3 p-6 bg-dark-sidebar rounded-lg border border-dark-border hover:border-dark-accent hover:bg-dark-hover transition-all group"
          >
            <FolderOpen className="w-10 h-10 text-dark-text-muted group-hover:text-dark-accent transition-colors" />
            <div>
              <div className="font-medium text-white">Projekt öffnen</div>
              <div className="text-sm text-dark-text-muted">
                Vorhandenen Ordner öffnen
              </div>
            </div>
          </button>

          <button
            onClick={handleOpenProject}
            className="flex flex-col items-center gap-3 p-6 bg-dark-sidebar rounded-lg border border-dark-border hover:border-dark-accent hover:bg-dark-hover transition-all group"
          >
            <Plus className="w-10 h-10 text-dark-text-muted group-hover:text-dark-accent transition-colors" />
            <div>
              <div className="font-medium text-white">Neues Projekt</div>
              <div className="text-sm text-dark-text-muted">
                Neuen Ordner auswählen
              </div>
            </div>
          </button>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-dark-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Zuletzt geöffnet
            </h2>
            <div className="bg-dark-sidebar rounded-lg border border-dark-border divide-y divide-dark-border">
              {recentProjects.map((project) => (
                <div
                  key={project.path}
                  onClick={() => handleOpenRecent(project)}
                  className="w-full flex items-center justify-between p-4 hover:bg-dark-hover transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderOpen className="w-5 h-5 text-dark-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">
                        {project.name}
                      </div>
                      <div className="text-sm text-dark-text-muted truncate">
                        {project.path}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(e, project.path)}
                    className="p-1.5 rounded hover:bg-dark-panel text-dark-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Aus Liste entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-8 text-center text-sm text-dark-text-muted">
          <kbd className="px-2 py-1 bg-dark-panel rounded text-xs">⌘</kbd>
          {" + "}
          <kbd className="px-2 py-1 bg-dark-panel rounded text-xs">O</kbd>
          {" zum Öffnen eines Projekts"}
        </div>
      </div>
    </div>
  );
}

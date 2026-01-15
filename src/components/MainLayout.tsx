import { useRef, useCallback } from "react";
import { useAppStore } from "../stores/appStore";
import FileExplorer from "./FileExplorer/FileExplorer";
import Editor from "./Editor/Editor";
import Chat from "./Chat/Chat";
import TitleBar from "./TitleBar";
import GraphView from "./GraphView/GraphView";
import Settings from "./Settings/Settings";

export default function MainLayout() {
  const {
    sidebarWidth,
    chatWidth,
    setSidebarWidth,
    setChatWidth,
    showGraphView,
    showSettings,
  } = useAppStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSidebar = useRef(false);
  const isDraggingChat = useRef(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDraggingSidebar.current) {
        const newWidth = e.clientX - containerRect.left;
        setSidebarWidth(newWidth);
      }

      if (isDraggingChat.current) {
        const newWidth = containerRect.right - e.clientX;
        setChatWidth(newWidth);
      }
    },
    [setSidebarWidth, setChatWidth]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingSidebar.current = false;
    isDraggingChat.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const startSidebarResize = () => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const startChatResize = () => {
    isDraggingChat.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg overflow-hidden">
      <TitleBar />

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* File Explorer Sidebar */}
        <div
          className="flex-shrink-0 bg-dark-sidebar border-r border-dark-border"
          style={{ width: sidebarWidth }}
        >
          <FileExplorer />
        </div>

        {/* Sidebar Resize Handle */}
        <div
          className="resize-handle flex-shrink-0"
          onMouseDown={startSidebarResize}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {showGraphView ? <GraphView /> : <Editor />}
        </div>

        {/* Chat Resize Handle */}
        <div
          className="resize-handle flex-shrink-0"
          onMouseDown={startChatResize}
        />

        {/* Chat Panel */}
        <div
          className="flex-shrink-0 bg-dark-sidebar border-l border-dark-border"
          style={{ width: chatWidth }}
        >
          <Chat />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && <Settings />}
    </div>
  );
}

import { FileText, ExternalLink } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PDFViewerProps {
  filePath: string;
  fileName: string;
}

export default function PDFViewer({ filePath, fileName }: PDFViewerProps) {
  // Convert file path to asset URL for Tauri
  const pdfUrl = convertFileSrc(filePath);
  
  const handleOpenExternal = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      // Use file:// URL for opening local files
      const fileUrl = `file://${filePath}`;
      await open(fileUrl);
    } catch (error) {
      console.error("Failed to open PDF externally:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-dark-border bg-dark-sidebar">
        <FileText className="w-4 h-4 text-red-400" />
        <span className="text-sm text-dark-text flex-1">{fileName}</span>
        <button
          onClick={handleOpenExternal}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors text-sm"
          title="In externem Programm öffnen"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Extern öffnen</span>
        </button>
      </div>
      
      {/* PDF Embed */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0"
          title={fileName}
        />
      </div>
    </div>
  );
}

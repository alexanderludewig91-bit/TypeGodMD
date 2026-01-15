import { useState, useEffect } from "react";
import { FileText, Table, Presentation, ExternalLink, Loader2 } from "lucide-react";
import { getOfficeType } from "../../stores/appStore";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

interface OfficeViewerProps {
  filePath: string;
  fileName: string;
  binaryContent?: Uint8Array;
}

export default function OfficeViewer({ filePath, fileName, binaryContent }: OfficeViewerProps) {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const officeType = getOfficeType(fileName);
  
  useEffect(() => {
    const loadContent = async () => {
      if (!binaryContent) {
        setError("Datei konnte nicht geladen werden");
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        if (officeType === "word") {
          // Convert Word document to HTML using mammoth
          // Create a proper ArrayBuffer from the Uint8Array
          const arrayBuffer = binaryContent.buffer.slice(
            binaryContent.byteOffset,
            binaryContent.byteOffset + binaryContent.byteLength
          ) as ArrayBuffer;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setContent(result.value);
        } else if (officeType === "excel") {
          // Parse Excel file using xlsx
          const workbook = XLSX.read(binaryContent, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const html = XLSX.utils.sheet_to_html(worksheet, { editable: false });
          setContent(html);
        } else {
          setError("Dieses Dateiformat kann nicht direkt angezeigt werden");
        }
      } catch (err) {
        console.error("Failed to parse office file:", err);
        setError("Fehler beim Laden der Datei. Bitte extern öffnen.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadContent();
  }, [binaryContent, officeType]);
  
  const handleOpenExternal = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      // Use file:// URL for opening local files
      const fileUrl = `file://${filePath}`;
      await open(fileUrl);
    } catch (error) {
      console.error("Failed to open file externally:", error);
    }
  };
  
  const getIcon = () => {
    switch (officeType) {
      case "word":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "excel":
        return <Table className="w-5 h-5 text-green-500" />;
      case "powerpoint":
        return <Presentation className="w-5 h-5 text-orange-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };
  
  const getTypeName = () => {
    switch (officeType) {
      case "word": return "Word-Dokument";
      case "excel": return "Excel-Tabelle";
      case "powerpoint": return "PowerPoint-Präsentation";
      default: return "Office-Datei";
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-dark-border bg-dark-sidebar">
        {getIcon()}
        <div className="flex-1">
          <div className="text-sm font-medium text-dark-text">{fileName}</div>
          <div className="text-xs text-dark-text-muted">{getTypeName()}</div>
        </div>
        <button
          onClick={handleOpenExternal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-dark-panel hover:bg-dark-hover text-dark-text text-sm transition-colors"
          title="In externem Programm öffnen"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Extern öffnen</span>
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-dark-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            {getIcon()}
            <p className="mt-4 text-dark-text-muted text-center">{error}</p>
            <button
              onClick={handleOpenExternal}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded bg-dark-accent hover:bg-dark-accent-hover text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mit Standard-App öffnen</span>
            </button>
          </div>
        ) : (
          <div 
            className="office-content p-6"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </div>
  );
}

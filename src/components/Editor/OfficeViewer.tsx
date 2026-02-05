import { useState, useEffect, useRef } from "react";
import { FileText, Table, Presentation, ExternalLink, Loader, ChevronLeft, ChevronRight } from "lucide-react";
import { getOfficeType } from "../../stores/appStore";
import * as XLSX from "xlsx";

// Dynamic import for docx-preview to avoid SSR issues
let docxPreviewModule: typeof import("docx-preview") | null = null;

interface OfficeViewerProps {
  filePath: string;
  fileName: string;
  binaryContent?: Uint8Array;
}

export default function OfficeViewer({ filePath, fileName, binaryContent }: OfficeViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excelHtml, setExcelHtml] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const officeType = getOfficeType(fileName);
  
  // Callback ref to detect when container is mounted
  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) {
      setContainerReady(true);
    }
  };
  
  // Load Excel and PowerPoint content
  useEffect(() => {
    const loadNonWordContent = async () => {
      if (!binaryContent) {
        setError("Datei konnte nicht geladen werden");
        setIsLoading(false);
        return;
      }
      
      if (officeType === "word") {
        // Word is handled separately when container is ready
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        if (officeType === "excel") {
          // Parse Excel file using xlsx
          const wb = XLSX.read(binaryContent, { type: "array", cellStyles: true });
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          setCurrentSheet(0);
          
          // Render first sheet
          renderExcelSheet(wb, 0);
        } else if (officeType === "powerpoint") {
          // PowerPoint doesn't have a good JS viewer - show preview with external option
          setError("powerpoint");
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
    
    loadNonWordContent();
  }, [binaryContent, officeType]);
  
  // Load Word content when container is ready
  useEffect(() => {
    const loadWordContent = async () => {
      if (!binaryContent || officeType !== "word" || !containerReady || !containerRef.current) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Clear previous content
        containerRef.current.innerHTML = "";
        
        // Dynamically import docx-preview
        if (!docxPreviewModule) {
          docxPreviewModule = await import("docx-preview");
        }
        
        // Create a proper ArrayBuffer from the Uint8Array
        const arrayBuffer = binaryContent.buffer.slice(
          binaryContent.byteOffset,
          binaryContent.byteOffset + binaryContent.byteLength
        );
        
        // Use docx-preview for high-fidelity rendering
        await docxPreviewModule.renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
      } catch (err) {
        console.error("Failed to parse Word file:", err);
        setError("Fehler beim Laden der Datei. Bitte extern öffnen.");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWordContent();
  }, [binaryContent, officeType, containerReady]);
  
  const renderExcelSheet = (wb: XLSX.WorkBook, sheetIndex: number) => {
    const sheetName = wb.SheetNames[sheetIndex];
    const worksheet = wb.Sheets[sheetName];
    
    // Get range
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    
    // Build custom HTML table with Excel-like styling
    let html = '<table class="excel-table">';
    
    // Header row with column letters
    html += '<thead><tr><th class="excel-corner"></th>';
    for (let c = range.s.c; c <= range.e.c; c++) {
      html += `<th class="excel-col-header">${XLSX.utils.encode_col(c)}</th>`;
    }
    html += '</tr></thead><tbody>';
    
    // Data rows
    for (let r = range.s.r; r <= range.e.r; r++) {
      html += `<tr><td class="excel-row-header">${r + 1}</td>`;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellRef];
        const value = cell ? (cell.w || cell.v || "") : "";
        
        // Get cell styling if available
        let style = "";
        if (cell && cell.s) {
          const cellStyle = cell.s;
          if (cellStyle.font?.bold) style += "font-weight: bold;";
          if (cellStyle.font?.italic) style += "font-style: italic;";
          if (cellStyle.font?.color?.rgb) style += `color: #${cellStyle.font.color.rgb};`;
          if (cellStyle.fill?.fgColor?.rgb) style += `background-color: #${cellStyle.fill.fgColor.rgb};`;
          if (cellStyle.alignment?.horizontal) style += `text-align: ${cellStyle.alignment.horizontal};`;
        }
        
        html += `<td class="excel-cell" style="${style}">${escapeHtml(String(value))}</td>`;
      }
      html += '</tr>';
    }
    
    html += '</tbody></table>';
    setExcelHtml(html);
  };
  
  const handleSheetChange = (index: number) => {
    if (workbook && index >= 0 && index < sheetNames.length) {
      setCurrentSheet(index);
      renderExcelSheet(workbook, index);
    }
  };
  
  const handleOpenExternal = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
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

  // PowerPoint preview card
  if (error === "powerpoint") {
    return (
      <div className="h-full flex flex-col bg-dark-bg">
        <div className="flex items-center gap-3 p-3 border-b border-dark-border bg-dark-sidebar">
          {getIcon()}
          <div className="flex-1">
            <div className="text-sm font-medium text-dark-text">{fileName}</div>
            <div className="text-xs text-dark-text-muted">{getTypeName()}</div>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-orange-900/20 to-dark-bg">
          <div className="bg-dark-panel rounded-xl p-8 shadow-2xl border border-dark-border max-w-md w-full">
            <div className="flex items-center justify-center mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <Presentation className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white text-center mb-2">
              {fileName}
            </h3>
            <p className="text-dark-text-muted text-center text-sm mb-6">
              PowerPoint-Präsentationen können nicht im Browser angezeigt werden.
              Öffne die Datei in Microsoft PowerPoint für die beste Darstellung.
            </p>
            
            <button
              onClick={handleOpenExternal}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium transition-all shadow-lg"
            >
              <ExternalLink className="w-5 h-5" />
              In PowerPoint öffnen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-dark-border bg-dark-sidebar">
        {getIcon()}
        <div className="flex-1">
          <div className="text-sm font-medium text-dark-text">{fileName}</div>
          <div className="text-xs text-dark-text-muted">{getTypeName()}</div>
        </div>
        
        {/* Sheet selector for Excel */}
        {officeType === "excel" && sheetNames.length > 1 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-dark-panel rounded-lg">
            <button
              onClick={() => handleSheetChange(currentSheet - 1)}
              disabled={currentSheet === 0}
              className="p-1 rounded hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={currentSheet}
              onChange={(e) => handleSheetChange(Number(e.target.value))}
              className="bg-transparent text-sm text-dark-text px-2 py-0.5 focus:outline-none"
            >
              {sheetNames.map((name, idx) => (
                <option key={idx} value={idx} className="bg-dark-panel">
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleSheetChange(currentSheet + 1)}
              disabled={currentSheet === sheetNames.length - 1}
              className="p-1 rounded hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <button
          onClick={handleOpenExternal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-dark-panel hover:bg-dark-hover text-dark-text text-sm transition-colors"
          title="In externem Programm öffnen"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Bearbeiten</span>
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto relative">
        {/* Word container - always render so ref is available */}
        {officeType === "word" && (
          <div 
            ref={setContainerRef}
            className="docx-container bg-gray-100 min-h-full"
          />
        )}
        
        {/* Excel container */}
        {officeType === "excel" && !isLoading && !error && (
          <div 
            className="excel-container"
            dangerouslySetInnerHTML={{ __html: excelHtml }}
          />
        )}
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/80">
            <Loader className="w-8 h-8 text-dark-accent animate-spin" />
          </div>
        )}
        
        {/* Error state */}
        {error && error !== "powerpoint" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-dark-bg">
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
        )}
      </div>
    </div>
  );
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

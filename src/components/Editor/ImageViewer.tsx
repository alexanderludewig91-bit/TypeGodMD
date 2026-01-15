import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ImageViewerProps {
  filePath: string;
  fileName: string;
}

export default function ImageViewer({ filePath, fileName }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  
  // Convert file path to asset URL for Tauri
  const imageUrl = convertFileSrc(filePath);
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-dark-border bg-dark-sidebar">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          title="Verkleinern"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-sm text-dark-text-muted min-w-[60px] text-center">
          {zoom}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          title="Vergrößern"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-dark-border mx-1" />
        <button
          onClick={handleRotate}
          className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          title="Drehen"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          title="Zurücksetzen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <span className="text-xs text-dark-text-muted">{fileName}</span>
      </div>
      
      {/* Image Container */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#1a1a1a]">
        <div 
          className="transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-none shadow-2xl"
            style={{ imageRendering: zoom > 100 ? "pixelated" : "auto" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%232d2d2d' width='200' height='200'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EBild nicht gefunden%3C/text%3E%3C/svg%3E";
            }}
          />
        </div>
      </div>
    </div>
  );
}

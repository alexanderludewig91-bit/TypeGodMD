import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { PendingChange } from "../../stores/appStore";

interface InlineDiffEditorProps {
  content: string;
  pendingChange: PendingChange;
  filePath: string;
  onContentChange: (content: string) => void;
  onAcceptChange: () => void;
  onRejectChange: () => void;
  onAcceptWithContent: (content: string) => void;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
}

// A segment is either unchanged text or a change block (hunk)
interface UnchangedSegment {
  type: "unchanged";
  id: string;
  lines: string[];
}

interface HunkSegment {
  type: "hunk";
  id: string;
  removedLines: string[];
  addedLines: string[];
  status: "pending" | "accepted" | "rejected";
  editedLines?: string[]; // If user manually edited
}

type Segment = UnchangedSegment | HunkSegment;

function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  
  const m = originalLines.length;
  const n = modifiedLines.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === modifiedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  let i = m, j = n;
  const result: DiffLine[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      result.unshift({ type: "unchanged", content: originalLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: modifiedLines[j - 1] });
      j--;
    } else if (i > 0) {
      result.unshift({ type: "removed", content: originalLines[i - 1] });
      i--;
    }
  }
  
  return result;
}

// Convert diff lines into segments
function createSegments(diffLines: DiffLine[]): Segment[] {
  const segments: Segment[] = [];
  let segmentId = 0;
  let currentUnchanged: string[] = [];
  let currentHunk: { removed: string[], added: string[] } | null = null;

  const flushUnchanged = () => {
    if (currentUnchanged.length > 0) {
      segments.push({
        type: "unchanged",
        id: `unchanged-${segmentId++}`,
        lines: [...currentUnchanged],
      });
      currentUnchanged = [];
    }
  };

  const flushHunk = () => {
    if (currentHunk) {
      segments.push({
        type: "hunk",
        id: `hunk-${segmentId++}`,
        removedLines: currentHunk.removed,
        addedLines: currentHunk.added,
        status: "pending",
      });
      currentHunk = null;
    }
  };

  for (const line of diffLines) {
    if (line.type === "unchanged") {
      flushHunk();
      currentUnchanged.push(line.content);
    } else {
      flushUnchanged();
      if (!currentHunk) {
        currentHunk = { removed: [], added: [] };
      }
      if (line.type === "removed") {
        currentHunk.removed.push(line.content);
      } else {
        currentHunk.added.push(line.content);
      }
    }
  }

  flushHunk();
  flushUnchanged();

  return segments;
}

export default function InlineDiffEditor({
  content,
  pendingChange,
  filePath,
  onContentChange,
  onAcceptChange,
  onRejectChange,
  onAcceptWithContent,
}: InlineDiffEditorProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentHunkIndex, setCurrentHunkIndex] = useState(0);
  const hunkRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize segments from diff
  useEffect(() => {
    const diffLines = computeDiff(pendingChange.originalContent, pendingChange.newContent);
    const initialSegments = createSegments(diffLines);
    setSegments(initialSegments);
    setCurrentHunkIndex(0);
  }, [pendingChange.id, pendingChange.originalContent, pendingChange.newContent]);

  const stats = useMemo(() => {
    const diffLines = computeDiff(pendingChange.originalContent, pendingChange.newContent);
    const added = diffLines.filter(l => l.type === "added").length;
    const removed = diffLines.filter(l => l.type === "removed").length;
    return { added, removed };
  }, [pendingChange.originalContent, pendingChange.newContent]);

  const hunks = segments.filter((s): s is HunkSegment => s.type === "hunk");
  const pendingHunks = hunks.filter(h => h.status === "pending");

  // Build final content from segments
  const buildFinalContent = useCallback((): string => {
    const lines: string[] = [];
    
    for (const segment of segments) {
      if (segment.type === "unchanged") {
        lines.push(...segment.lines);
      } else {
        // Hunk segment
        if (segment.editedLines) {
          lines.push(...segment.editedLines);
        } else if (segment.status === "rejected") {
          // Use original (removed) lines
          lines.push(...segment.removedLines);
        } else {
          // Pending or accepted: use added lines
          lines.push(...segment.addedLines);
        }
      }
    }
    
    return lines.join("\n");
  }, [segments]);

  const handleAcceptHunk = useCallback((hunkId: string) => {
    setSegments(prev => prev.map(s => 
      s.type === "hunk" && s.id === hunkId 
        ? { ...s, status: "accepted" as const, editedLines: undefined }
        : s
    ));
  }, []);

  const handleRejectHunk = useCallback((hunkId: string) => {
    setSegments(prev => prev.map(s => 
      s.type === "hunk" && s.id === hunkId 
        ? { ...s, status: "rejected" as const, editedLines: undefined }
        : s
    ));
  }, []);

  const handleEditHunkLine = useCallback((hunkId: string, lineIndex: number, newValue: string) => {
    setSegments(prev => prev.map(s => {
      if (s.type === "hunk" && s.id === hunkId) {
        const currentLines = s.editedLines || [...s.addedLines];
        const newLines = [...currentLines];
        newLines[lineIndex] = newValue;
        return { ...s, editedLines: newLines, status: "pending" as const };
      }
      return s;
    }));
  }, []);

  const handleEditUnchangedLine = useCallback((segmentId: string, lineIndex: number, newValue: string) => {
    setSegments(prev => prev.map(s => {
      if (s.type === "unchanged" && s.id === segmentId) {
        const newLines = [...s.lines];
        newLines[lineIndex] = newValue;
        return { ...s, lines: newLines };
      }
      return s;
    }));
  }, []);

  const handleSave = useCallback(() => {
    const finalContent = buildFinalContent();
    onAcceptWithContent(finalContent);
  }, [buildFinalContent, onAcceptWithContent]);

  const handleAcceptAll = useCallback(() => {
    setSegments(prev => prev.map(s => 
      s.type === "hunk" && s.status === "pending"
        ? { ...s, status: "accepted" as const }
        : s
    ));
  }, []);

  const handleRejectAll = useCallback(() => {
    onRejectChange();
  }, [onRejectChange]);

  const navigateToHunk = useCallback((direction: "prev" | "next") => {
    if (pendingHunks.length === 0) return;
    
    let newIndex = currentHunkIndex;
    if (direction === "next") {
      newIndex = (currentHunkIndex + 1) % pendingHunks.length;
    } else {
      newIndex = (currentHunkIndex - 1 + pendingHunks.length) % pendingHunks.length;
    }
    setCurrentHunkIndex(newIndex);
    
    const hunk = pendingHunks[newIndex];
    const el = hunkRefs.current.get(hunk.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentHunkIndex, pendingHunks]);

  // Calculate line numbers
  const renderContent = () => {
    const elements: JSX.Element[] = [];
    let lineNumber = 1;

    for (const segment of segments) {
      if (segment.type === "unchanged") {
        // Render unchanged lines
        for (let i = 0; i < segment.lines.length; i++) {
          const line = segment.lines[i];
          elements.push(
            <div key={`${segment.id}-${i}`} className="flex group">
              <span className="w-12 text-right pr-3 text-dark-text-muted select-none text-xs py-0.5 shrink-0">
                {lineNumber++}
              </span>
              <input
                type="text"
                value={line}
                onChange={(e) => handleEditUnchangedLine(segment.id, i, e.target.value)}
                className="flex-1 bg-transparent text-dark-text py-0.5 px-2 focus:outline-none focus:bg-dark-hover/30"
                spellCheck={false}
              />
            </div>
          );
        }
      } else {
        // Render hunk
        const isPending = segment.status === "pending";
        const isAccepted = segment.status === "accepted";
        const isRejected = segment.status === "rejected";
        const displayLines = segment.editedLines || segment.addedLines;
        const originalLines = segment.removedLines;

        elements.push(
          <div
            key={segment.id}
            ref={el => el && hunkRefs.current.set(segment.id, el)}
            className={`relative border-l-4 ${
              isPending ? "border-yellow-500" :
              isAccepted ? "border-green-500" :
              "border-dark-border"
            }`}
          >
            {/* Action buttons - always visible for pending */}
            {isPending && (
              <div className="absolute -left-1 top-0 flex flex-col gap-0.5 -translate-x-full pr-1 z-10">
                <button
                  onClick={() => handleAcceptHunk(segment.id)}
                  className="p-1 rounded bg-green-600 hover:bg-green-500 text-white transition-colors shadow-lg"
                  title="Änderung annehmen"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRejectHunk(segment.id)}
                  className="p-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg"
                  title="Änderung ablehnen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Status indicator for resolved hunks */}
            {!isPending && (
              <div className="flex items-center gap-2 px-2 py-0.5 bg-dark-sidebar/50 text-xs">
                <span className={isAccepted ? "text-green-400" : "text-dark-text-muted"}>
                  {isAccepted ? "✓ Angenommen" : "✗ Abgelehnt"}
                </span>
                <button
                  onClick={() => setSegments(prev => prev.map(s => 
                    s.id === segment.id ? { ...s, status: "pending" as const } : s
                  ))}
                  className="text-dark-text-muted hover:text-white ml-auto"
                >
                  Rückgängig
                </button>
              </div>
            )}

            {/* Removed lines - show for pending, hide for accepted/rejected */}
            {isPending && originalLines.length > 0 && (
              <div className="bg-red-900/20">
                {originalLines.map((line, idx) => (
                  <div key={`removed-${idx}`} className="flex">
                    <span className="w-12 text-right pr-3 text-red-400/60 select-none text-xs py-0.5 shrink-0">
                      −
                    </span>
                    <span className="flex-1 text-red-300/70 line-through py-0.5 px-2 select-none">
                      {line || " "}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Added/Current lines - editable for pending and accepted */}
            {!isRejected && (
              <div className={isPending ? "bg-green-900/20" : ""}>
                {displayLines.map((line, idx) => (
                  <div key={`added-${idx}`} className="flex">
                    <span className={`w-12 text-right pr-3 select-none text-xs py-0.5 shrink-0 ${
                      isPending ? "text-green-400/60" : "text-dark-text-muted"
                    }`}>
                      {isPending ? "+" : lineNumber++}
                    </span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => handleEditHunkLine(segment.id, idx, e.target.value)}
                      className={`flex-1 bg-transparent py-0.5 px-2 focus:outline-none focus:bg-dark-hover/30 ${
                        isPending ? "text-green-300" : "text-dark-text"
                      }`}
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Show original lines for rejected */}
            {isRejected && (
              <div>
                {originalLines.map((line, idx) => (
                  <div key={`original-${idx}`} className="flex">
                    <span className="w-12 text-right pr-3 text-dark-text-muted select-none text-xs py-0.5 shrink-0">
                      {lineNumber++}
                    </span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => {
                        // Update the removed lines for rejected hunks
                        setSegments(prev => prev.map(s => {
                          if (s.type === "hunk" && s.id === segment.id) {
                            const newRemoved = [...s.removedLines];
                            newRemoved[idx] = e.target.value;
                            return { ...s, removedLines: newRemoved };
                          }
                          return s;
                        }));
                      }}
                      className="flex-1 bg-transparent text-dark-text py-0.5 px-2 focus:outline-none focus:bg-dark-hover/30"
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

        // Update line number for non-pending hunks
        if (!isPending) {
          // Lines already counted in the render
        } else {
          // For pending hunks, we don't count lines yet (they have + prefix)
        }
      }
    }

    return elements;
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-yellow-900/20 border-b border-yellow-500/30">
        <div className="flex items-center gap-3">
          <span className="text-sm text-yellow-400">
            {pendingHunks.length} {pendingHunks.length === 1 ? "Änderung" : "Änderungen"} ausstehend
          </span>
          <span className="text-xs text-dark-text-muted">
            +{stats.added} / -{stats.removed}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Navigation */}
          {pendingHunks.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => navigateToHunk("prev")}
                className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-white transition-colors"
                title="Vorherige Änderung"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-xs text-dark-text-muted">
                {Math.min(currentHunkIndex + 1, pendingHunks.length)}/{pendingHunks.length}
              </span>
              <button
                onClick={() => navigateToHunk("next")}
                className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-white transition-colors"
                title="Nächste Änderung"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <button
            onClick={handleRejectAll}
            className="flex items-center gap-1 px-2 py-1 text-xs text-dark-text-muted hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Verwerfen
          </button>
          
          {pendingHunks.length > 0 && (
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-dark-text-muted hover:text-green-400 hover:bg-green-900/20 rounded transition-colors"
            >
              <Check className="w-3 h-3" />
              Alle annehmen
            </button>
          )}
          
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white hover:bg-green-500 rounded transition-colors"
          >
            <Check className="w-3 h-3" />
            Speichern
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto font-mono text-sm pl-8">
        {renderContent()}
      </div>
    </div>
  );
}

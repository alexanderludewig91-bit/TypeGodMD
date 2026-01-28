import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Check, X, File } from "lucide-react";
import { PendingChange } from "../stores/appStore";

interface DiffViewProps {
  change: PendingChange;
  onAccept: () => void;
  onReject: () => void;
  onAcceptWithContent?: (newContent: string) => void;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  originalIndex?: number;
  newIndex?: number;
}

interface DiffHunk {
  id: number;
  lines: DiffLine[];
  startLine: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  
  const m = originalLines.length;
  const n = modifiedLines.length;
  
  // Build LCS table
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
  
  // Backtrack to build diff
  let i = m, j = n;
  const result: DiffLine[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === modifiedLines[j - 1]) {
      result.unshift({
        type: "unchanged",
        content: originalLines[i - 1],
        originalIndex: i - 1,
        newIndex: j - 1,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: "added",
        content: modifiedLines[j - 1],
        newIndex: j - 1,
      });
      j--;
    } else if (i > 0) {
      result.unshift({
        type: "removed",
        content: originalLines[i - 1],
        originalIndex: i - 1,
      });
      i--;
    }
  }
  
  return result;
}

// Group consecutive changes into hunks
function groupIntoHunks(diffLines: DiffLine[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffLine[] = [];
  let hunkId = 0;
  let lineNumber = 1;
  let hunkStartLine = 1;
  
  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    const isChange = line.type !== "unchanged";
    const prevIsChange = i > 0 && diffLines[i - 1].type !== "unchanged";
    
    if (isChange) {
      if (!prevIsChange && currentHunk.length === 0) {
        hunkStartLine = lineNumber;
      }
      currentHunk.push(line);
    } else {
      if (currentHunk.length > 0) {
        hunks.push({
          id: hunkId++,
          lines: currentHunk,
          startLine: hunkStartLine,
        });
        currentHunk = [];
      }
      lineNumber++;
    }
  }
  
  // Don't forget the last hunk
  if (currentHunk.length > 0) {
    hunks.push({
      id: hunkId++,
      lines: currentHunk,
      startLine: hunkStartLine,
    });
  }
  
  return hunks;
}

export default function DiffView({ change, onAccept, onReject, onAcceptWithContent }: DiffViewProps) {
  const [acceptedHunks, setAcceptedHunks] = useState<Set<number>>(new Set());
  const [rejectedHunks, setRejectedHunks] = useState<Set<number>>(new Set());
  const [editedContent, setEditedContent] = useState<Map<number, string>>(new Map());
  const editorRef = useRef<HTMLDivElement>(null);

  const diffLines = useMemo(() => 
    computeDiff(change.originalContent, change.newContent),
    [change.originalContent, change.newContent]
  );

  const hunks = useMemo(() => 
    groupIntoHunks(diffLines),
    [diffLines]
  );

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === "added").length;
    const removed = diffLines.filter(l => l.type === "removed").length;
    return { added, removed };
  }, [diffLines]);

  // Build the final content based on decisions and edits
  const buildFinalContent = useCallback(() => {
    const result: string[] = [];
    let hunkIndex = 0;
    let currentHunk = hunks[hunkIndex];
    let diffIndex = 0;
    
    while (diffIndex < diffLines.length) {
      const line = diffLines[diffIndex];
      
      // Check if we're at a hunk
      if (currentHunk && line.type !== "unchanged") {
        const hunkId = currentHunk.id;
        
        // Check if this hunk has custom edits
        if (editedContent.has(hunkId)) {
          result.push(editedContent.get(hunkId)!);
        } else if (acceptedHunks.has(hunkId)) {
          // Add only the "added" lines
          for (const hunkLine of currentHunk.lines) {
            if (hunkLine.type === "added") {
              result.push(hunkLine.content);
            }
          }
        } else if (rejectedHunks.has(hunkId)) {
          // Keep only the "removed" lines (original)
          for (const hunkLine of currentHunk.lines) {
            if (hunkLine.type === "removed") {
              result.push(hunkLine.content);
            }
          }
        } else {
          // Default: use new content (added lines)
          for (const hunkLine of currentHunk.lines) {
            if (hunkLine.type === "added") {
              result.push(hunkLine.content);
            }
          }
        }
        
        // Skip all lines in this hunk
        while (diffIndex < diffLines.length && diffLines[diffIndex].type !== "unchanged") {
          diffIndex++;
        }
        
        hunkIndex++;
        currentHunk = hunks[hunkIndex];
      } else {
        // Unchanged line
        result.push(line.content);
        diffIndex++;
      }
    }
    
    return result.join("\n");
  }, [diffLines, hunks, acceptedHunks, rejectedHunks, editedContent]);

  const handleAcceptHunk = (hunkId: number) => {
    setAcceptedHunks(prev => new Set([...prev, hunkId]));
    setRejectedHunks(prev => {
      const next = new Set(prev);
      next.delete(hunkId);
      return next;
    });
    setEditedContent(prev => {
      const next = new Map(prev);
      next.delete(hunkId);
      return next;
    });
  };

  const handleRejectHunk = (hunkId: number) => {
    setRejectedHunks(prev => new Set([...prev, hunkId]));
    setAcceptedHunks(prev => {
      const next = new Set(prev);
      next.delete(hunkId);
      return next;
    });
    setEditedContent(prev => {
      const next = new Map(prev);
      next.delete(hunkId);
      return next;
    });
  };

  const handleHunkEdit = (hunkId: number, content: string) => {
    setEditedContent(prev => new Map(prev).set(hunkId, content));
    // Clear accept/reject state when manually editing
    setAcceptedHunks(prev => {
      const next = new Set(prev);
      next.delete(hunkId);
      return next;
    });
    setRejectedHunks(prev => {
      const next = new Set(prev);
      next.delete(hunkId);
      return next;
    });
  };

  const handleSaveAll = () => {
    const finalContent = buildFinalContent();
    if (onAcceptWithContent) {
      onAcceptWithContent(finalContent);
    } else {
      onAccept();
    }
  };

  const handleAcceptAll = () => {
    // Accept all hunks
    const allHunkIds = new Set(hunks.map(h => h.id));
    setAcceptedHunks(allHunkIds);
    setRejectedHunks(new Set());
    setEditedContent(new Map());
  };

  const handleRejectAll = () => {
    onReject();
  };

  const getHunkStatus = (hunkId: number): "pending" | "accepted" | "rejected" | "edited" => {
    if (editedContent.has(hunkId)) return "edited";
    if (acceptedHunks.has(hunkId)) return "accepted";
    if (rejectedHunks.has(hunkId)) return "rejected";
    return "pending";
  };

  // Render the diff with inline editing
  const renderContent = () => {
    const elements: JSX.Element[] = [];
    let hunkIndex = 0;
    let currentHunk = hunks[hunkIndex];
    let lineNumber = 1;
    let diffIndex = 0;

    while (diffIndex < diffLines.length) {
      const line = diffLines[diffIndex];
      
      // Check if we're at a hunk
      if (currentHunk && line.type !== "unchanged") {
        const hunk = currentHunk;
        const status = getHunkStatus(hunk.id);
        
        elements.push(
          <HunkBlock
            key={`hunk-${hunk.id}`}
            hunk={hunk}
            status={status}
            onAccept={() => handleAcceptHunk(hunk.id)}
            onReject={() => handleRejectHunk(hunk.id)}
            onEdit={(content) => handleHunkEdit(hunk.id, content)}
            editedContent={editedContent.get(hunk.id)}
          />
        );
        
        // Skip all lines in this hunk
        while (diffIndex < diffLines.length && diffLines[diffIndex].type !== "unchanged") {
          diffIndex++;
        }
        
        hunkIndex++;
        currentHunk = hunks[hunkIndex];
      } else {
        // Unchanged line
        elements.push(
          <div key={`line-${diffIndex}`} className="flex">
            <span className="w-12 px-2 py-0.5 text-right text-dark-text-muted select-none text-xs border-r border-dark-border/30 shrink-0">
              {lineNumber}
            </span>
            <span className="px-3 py-0.5 text-dark-text whitespace-pre-wrap flex-1">
              {line.content || " "}
            </span>
          </div>
        );
        lineNumber++;
        diffIndex++;
      }
    }

    return elements;
  };

  const pendingCount = hunks.filter(h => getHunkStatus(h.id) === "pending").length;
  const hasChanges = acceptedHunks.size > 0 || rejectedHunks.size > 0 || editedContent.size > 0;

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-sidebar">
        <div className="flex items-center gap-3">
          <File className="w-5 h-5 text-dark-accent" />
          <div>
            <h3 className="text-sm font-medium text-white">
              Vorgeschlagene Änderungen
            </h3>
            <p className="text-xs text-dark-text-muted">
              {change.fileName} • {hunks.length} {hunks.length === 1 ? "Änderung" : "Änderungen"}
              {pendingCount > 0 && ` • ${pendingCount} ausstehend`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-text-muted hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Verwerfen
            </button>
            {pendingCount > 0 && (
              <button
                onClick={handleAcceptAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-text-muted hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Alle annehmen
              </button>
            )}
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={editorRef} className="flex-1 overflow-auto font-mono text-sm">
        {renderContent()}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-dark-border bg-dark-sidebar">
        <p className="text-xs text-dark-text-muted text-center">
          Klicke ✓ oder ✗ bei jeder Änderung • Bearbeite direkt im grünen Bereich • Speichern übernimmt alle Entscheidungen
        </p>
      </div>
    </div>
  );
}

// Individual Hunk Block Component
interface HunkBlockProps {
  hunk: DiffHunk;
  status: "pending" | "accepted" | "rejected" | "edited";
  onAccept: () => void;
  onReject: () => void;
  onEdit: (content: string) => void;
  editedContent?: string;
}

function HunkBlock({ hunk, status, onAccept, onReject, onEdit, editedContent }: HunkBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const removedLines = hunk.lines.filter(l => l.type === "removed");
  const addedLines = hunk.lines.filter(l => l.type === "added");
  
  const addedContent = addedLines.map(l => l.content).join("\n");
  const removedContent = removedLines.map(l => l.content).join("\n");
  
  const displayContent = editedContent !== undefined ? editedContent : addedContent;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [displayContent]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onEdit(e.target.value);
  };

  // Show based on status
  if (status === "rejected") {
    // Show only the original (removed) content as normal text
    return (
      <div className="border-l-4 border-dark-border/50 bg-dark-bg/50">
        <div className="flex items-center gap-2 px-2 py-1 bg-dark-sidebar/30">
          <span className="text-xs text-dark-text-muted">Abgelehnt - Original beibehalten</span>
          <button
            onClick={onAccept}
            className="ml-auto text-xs text-dark-text-muted hover:text-green-400 px-2 py-0.5 rounded hover:bg-green-900/20"
          >
            Rückgängig
          </button>
        </div>
        {removedLines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="w-12 px-2 py-0.5 text-right text-dark-text-muted select-none text-xs border-r border-dark-border/30 shrink-0">
              
            </span>
            <span className="px-3 py-0.5 text-dark-text whitespace-pre-wrap flex-1">
              {line.content || " "}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (status === "accepted" && editedContent === undefined) {
    // Show only the new (added) content as normal text
    return (
      <div className="border-l-4 border-green-500/50 bg-green-900/10">
        <div className="flex items-center gap-2 px-2 py-1 bg-green-900/20">
          <span className="text-xs text-green-400">Angenommen</span>
          <button
            onClick={onReject}
            className="ml-auto text-xs text-dark-text-muted hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-900/20"
          >
            Rückgängig
          </button>
        </div>
        {addedLines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="w-12 px-2 py-0.5 text-right text-dark-text-muted select-none text-xs border-r border-dark-border/30 shrink-0">
              
            </span>
            <span className="px-3 py-0.5 text-dark-text whitespace-pre-wrap flex-1">
              {line.content || " "}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Pending or Edited state - show full diff with editable area
  return (
    <div className="border-l-4 border-yellow-500/50">
      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2 py-1 bg-dark-sidebar/50 border-b border-dark-border/30">
        <button
          onClick={onAccept}
          className="flex items-center gap-1 text-xs text-dark-text-muted hover:text-green-400 px-2 py-0.5 rounded hover:bg-green-900/20 transition-colors"
          title="Änderung annehmen"
        >
          <Check className="w-3 h-3" />
          Annehmen
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1 text-xs text-dark-text-muted hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-900/20 transition-colors"
          title="Änderung ablehnen"
        >
          <X className="w-3 h-3" />
          Ablehnen
        </button>
        {status === "edited" && (
          <span className="ml-2 text-xs text-yellow-400">Bearbeitet</span>
        )}
      </div>

      {/* Removed lines (original) */}
      {removedLines.length > 0 && (
        <div className="bg-red-900/20">
          {removedLines.map((line, idx) => (
            <div key={`removed-${idx}`} className="flex">
              <span className="w-12 px-2 py-0.5 text-right text-red-400/70 select-none text-xs border-r border-red-900/30 shrink-0">
                -
              </span>
              <span className="px-3 py-0.5 text-red-300 whitespace-pre-wrap flex-1 line-through opacity-70">
                {line.content || " "}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Added lines (editable) */}
      {(addedLines.length > 0 || editedContent !== undefined) && (
        <div className="bg-green-900/20 relative">
          <div className="flex">
            <span className="w-12 px-2 py-0.5 text-right text-green-400/70 select-none text-xs border-r border-green-900/30 shrink-0">
              +
            </span>
            <textarea
              ref={textareaRef}
              value={displayContent}
              onChange={handleTextChange}
              className="flex-1 px-3 py-0.5 bg-transparent text-green-300 whitespace-pre-wrap resize-none focus:outline-none focus:ring-1 focus:ring-green-500/50 min-h-[1.5em]"
              spellCheck={false}
              rows={1}
            />
          </div>
        </div>
      )}
    </div>
  );
}

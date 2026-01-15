import { useMemo } from "react";
import { Check, X, File } from "lucide-react";
import { PendingChange } from "../stores/appStore";

interface DiffViewProps {
  change: PendingChange;
  onAccept: () => void;
  onReject: () => void;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  
  // Simple line-by-line diff using LCS algorithm
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
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: "added",
        content: modifiedLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0) {
      result.unshift({
        type: "removed",
        content: originalLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }
  
  return result;
}

export default function DiffView({ change, onAccept, onReject }: DiffViewProps) {
  const diffLines = useMemo(() => 
    computeDiff(change.originalContent, change.newContent),
    [change.originalContent, change.newContent]
  );

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === "added").length;
    const removed = diffLines.filter(l => l.type === "removed").length;
    return { added, removed };
  }, [diffLines]);

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
              {change.fileName}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400">+{stats.added} hinzugefügt</span>
            <span className="text-red-400">-{stats.removed} entfernt</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-text-muted hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Ablehnen
            </button>
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Übernehmen
            </button>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto font-mono text-sm">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, index) => (
              <tr 
                key={index}
                className={`
                  ${line.type === "added" ? "bg-green-900/30" : ""}
                  ${line.type === "removed" ? "bg-red-900/30" : ""}
                `}
              >
                {/* Old line number */}
                <td className="w-12 px-2 py-0.5 text-right text-dark-text-muted select-none border-r border-dark-border">
                  {line.type !== "added" ? line.oldLineNumber : ""}
                </td>
                
                {/* New line number */}
                <td className="w-12 px-2 py-0.5 text-right text-dark-text-muted select-none border-r border-dark-border">
                  {line.type !== "removed" ? line.newLineNumber : ""}
                </td>
                
                {/* Change indicator */}
                <td className={`w-6 px-1 py-0.5 text-center select-none ${
                  line.type === "added" ? "text-green-400" : ""
                } ${
                  line.type === "removed" ? "text-red-400" : ""
                }`}>
                  {line.type === "added" && "+"}
                  {line.type === "removed" && "-"}
                </td>
                
                {/* Content */}
                <td className={`px-2 py-0.5 whitespace-pre ${
                  line.type === "added" ? "text-green-300" : ""
                } ${
                  line.type === "removed" ? "text-red-300" : ""
                } ${
                  line.type === "unchanged" ? "text-dark-text" : ""
                }`}>
                  {line.content || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-dark-border bg-dark-sidebar">
        <p className="text-xs text-dark-text-muted text-center">
          Überprüfe die Änderungen und klicke auf "Übernehmen" um sie zu speichern
        </p>
      </div>
    </div>
  );
}

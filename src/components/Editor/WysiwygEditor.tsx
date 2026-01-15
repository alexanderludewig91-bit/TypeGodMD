import { useEffect, useRef } from "react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { useAppStore } from "../../stores/appStore";

interface WysiwygEditorProps {
  content: string;
  filePath: string;
}

export default function WysiwygEditor({ content, filePath }: WysiwygEditorProps) {
  const { updateFileContent, saveFile } = useAppStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const initializedForPathRef = useRef<string | null>(null);
  const contentRef = useRef(content);
  const filePathRef = useRef(filePath);

  // Keep refs updated
  contentRef.current = content;
  filePathRef.current = filePath;

  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;

    // Skip if already initialized for this file
    if (initializedForPathRef.current === filePath && editorInstanceRef.current) {
      return;
    }

    // Clean up previous editor instance
    if (editorInstanceRef.current) {
      editorInstanceRef.current.destroy();
      editorInstanceRef.current = null;
    }

    // Clear the container completely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Mark as initializing for this path
    initializedForPathRef.current = filePath;

    // Create new editor
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, contentRef.current);
        
        // Listen for changes
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          updateFileContent(filePathRef.current, markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .create()
      .then((editor) => {
        // Only assign if still for the same file
        if (initializedForPathRef.current === filePath) {
          editorInstanceRef.current = editor;
        } else {
          // File changed while creating, destroy
          editor.destroy();
        }
      })
      .catch((error) => {
        console.error("Failed to create editor:", error);
        initializedForPathRef.current = null;
      });

    return () => {
      // Only cleanup if this effect's filePath matches
      if (initializedForPathRef.current === filePath) {
        initializedForPathRef.current = null;
        if (editorInstanceRef.current) {
          editorInstanceRef.current.destroy();
          editorInstanceRef.current = null;
        }
      }
    };
  }, [filePath, updateFileContent]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      saveFile(filePath);
    }
  };

  return (
    <div 
      className="wysiwyg-editor h-full overflow-auto"
      onKeyDown={handleKeyDown}
    >
      <div 
        ref={editorRef} 
        className="milkdown-editor"
      />
    </div>
  );
}

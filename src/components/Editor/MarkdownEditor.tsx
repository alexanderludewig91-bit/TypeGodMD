import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { useAppStore } from "../../stores/appStore";

interface MarkdownEditorProps {
  content: string;
  filePath: string;
}

export default function MarkdownEditor({
  content,
  filePath,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const { updateFileContent, saveFile } = useAppStore();

  const handleChange = useCallback(
    (newContent: string) => {
      updateFileContent(filePath, newContent);
    },
    [filePath, updateFileContent]
  );

  const handleSave = useCallback(() => {
    saveFile(filePath);
  }, [filePath, saveFile]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing editor
    if (editorRef.current) {
      editorRef.current.destroy();
    }

    // Create custom keymap for save
    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          handleSave();
          return true;
        },
      },
    ]);

    // Create editor state
    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown(),
        oneDark,
        saveKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-content": {
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            padding: "16px 0",
          },
          ".cm-gutters": {
            backgroundColor: "#1e1e1e",
            borderRight: "1px solid #3c3c3c",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "#2d2d2d",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
        }),
      ],
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorRef.current = view;

    return () => {
      view.destroy();
    };
  }, [filePath]); // Only recreate when file changes

  // Update content when it changes externally
  useEffect(() => {
    if (editorRef.current) {
      const currentContent = editorRef.current.state.doc.toString();
      if (currentContent !== content) {
        editorRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
    }
  }, [content]);

  return <div ref={containerRef} className="h-full w-full" />;
}

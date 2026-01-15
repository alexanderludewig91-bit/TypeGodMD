import OpenAI from "openai";
import { readTextFile, writeTextFile, fileExists, readDirectory } from "./fileSystem";
import { FileNode } from "../stores/appStore";

interface ProposedChange {
  filePath: string;
  fileName: string;
  originalContent: string;
  newContent: string;
}

interface ChatOptions {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  apiKey: string;
  model: string;
  projectPath?: string;
  onFileCreated?: (path: string) => void;
  onProposedChange?: (change: ProposedChange) => void;
}

// Define the tools/functions the AI can use
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Liest den Inhalt einer Markdown-Datei aus dem Projekt",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Der relative Pfad zur Datei (z.B. 'notizen/ideen.md' oder 'README.md')",
          },
        },
        required: ["file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Erstellt eine neue Markdown-Datei im Projekt",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Der relative Pfad für die neue Datei (z.B. 'notizen/neue-idee.md')",
          },
          content: {
            type: "string",
            description: "Der Markdown-Inhalt der Datei",
          },
        },
        required: ["file_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_file",
      description: "Aktualisiert den Inhalt einer bestehenden Markdown-Datei",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Der relative Pfad zur Datei",
          },
          content: {
            type: "string",
            description: "Der neue Markdown-Inhalt der Datei",
          },
        },
        required: ["file_path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Listet alle Dateien und Ordner im Projekt oder einem Unterordner auf",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Optionaler relativer Pfad zum Unterordner. Leer lassen für Projekt-Root.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Durchsucht alle Markdown-Dateien nach einem Suchbegriff",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Der Suchbegriff",
          },
        },
        required: ["query"],
      },
    },
  },
];

const SYSTEM_PROMPT = `Du bist ein hilfreicher KI-Assistent für Wissensmanagement. Du hilfst dem Benutzer beim Erstellen, Bearbeiten und Organisieren von Markdown-Notizen.

Du hast Zugriff auf folgende Funktionen:
- read_file: Liest den Inhalt einer Datei
- create_file: Erstellt eine neue Markdown-Datei
- update_file: Aktualisiert eine bestehende Datei
- list_files: Listet Dateien im Projekt auf
- search_content: Durchsucht Dateien nach Inhalten

WICHTIG:
- Wenn der Benutzer dich bittet, eine Datei zu erstellen, nutze IMMER die create_file Funktion
- Wenn der Benutzer nach Dateien fragt, nutze list_files oder read_file
- Verwende aussagekräftige Dateinamen in kebab-case (z.B. meine-notiz.md)
- Beginne jede neue Datei mit einem H1-Titel
- Antworte auf Deutsch, es sei denn, der Benutzer schreibt in einer anderen Sprache`;

// Helper to get all files recursively
async function getAllFiles(dirPath: string, basePath: string = ""): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readDirectory(dirPath);
    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isDirectory && entry.children !== undefined) {
        const subFiles = await getAllFiles(entry.path, relativePath);
        files.push(...subFiles);
      } else if (entry.name.endsWith(".md")) {
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error("Error reading directory:", error);
  }
  return files;
}

// Process function calls
async function processToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  projectPath: string,
  options: ChatOptions
): Promise<string> {
  const { name, arguments: argsString } = toolCall.function;
  const args = JSON.parse(argsString);

  console.log(`Processing tool call: ${name}`, args);

  switch (name) {
    case "read_file": {
      const filePath = `${projectPath}/${args.file_path}`;
      try {
        const exists = await fileExists(filePath);
        if (!exists) {
          return `Fehler: Datei "${args.file_path}" nicht gefunden.`;
        }
        const content = await readTextFile(filePath);
        return `Inhalt von "${args.file_path}":\n\n${content}`;
      } catch (error) {
        return `Fehler beim Lesen der Datei: ${error}`;
      }
    }

    case "create_file": {
      const filePath = `${projectPath}/${args.file_path}`;
      try {
        const exists = await fileExists(filePath);
        if (exists) {
          return `Fehler: Datei "${args.file_path}" existiert bereits. Verwende update_file zum Aktualisieren.`;
        }
        await writeTextFile(filePath, args.content);
        return `Datei "${args.file_path}" wurde erfolgreich erstellt.`;
      } catch (error) {
        return `Fehler beim Erstellen der Datei: ${error}`;
      }
    }

    case "update_file": {
      const filePath = `${projectPath}/${args.file_path}`;
      try {
        const exists = await fileExists(filePath);
        if (!exists) {
          return `Fehler: Datei "${args.file_path}" nicht gefunden. Verwende create_file zum Erstellen.`;
        }
        
        // Read original content for diff
        const originalContent = await readTextFile(filePath);
        const fileName = args.file_path.split("/").pop() || args.file_path;
        
        // If callback provided, propose change instead of writing directly
        if (options.onProposedChange) {
          options.onProposedChange({
            filePath,
            fileName,
            originalContent,
            newContent: args.content,
          });
          return `Änderungen für "${args.file_path}" wurden vorgeschlagen. Der Benutzer muss die Änderungen bestätigen.`;
        }
        
        // Fallback: write directly if no callback
        await writeTextFile(filePath, args.content);
        return `Datei "${args.file_path}" wurde erfolgreich aktualisiert.`;
      } catch (error) {
        return `Fehler beim Aktualisieren der Datei: ${error}`;
      }
    }

    case "list_files": {
      const dirPath = args.directory 
        ? `${projectPath}/${args.directory}` 
        : projectPath;
      try {
        const files = await getAllFiles(dirPath, args.directory || "");
        if (files.length === 0) {
          return "Keine Markdown-Dateien gefunden.";
        }
        return `Gefundene Dateien:\n${files.map(f => `- ${f}`).join("\n")}`;
      } catch (error) {
        return `Fehler beim Auflisten der Dateien: ${error}`;
      }
    }

    case "search_content": {
      try {
        const allFiles = await getAllFiles(projectPath);
        const results: string[] = [];
        const query = args.query.toLowerCase();

        for (const relativePath of allFiles) {
          const filePath = `${projectPath}/${relativePath}`;
          const content = await readTextFile(filePath);
          if (content.toLowerCase().includes(query)) {
            const lines = content.split("\n");
            const matchingLines = lines
              .map((line, i) => ({ line, num: i + 1 }))
              .filter(({ line }) => line.toLowerCase().includes(query))
              .slice(0, 3);
            
            results.push(`**${relativePath}**:\n${matchingLines.map(
              ({ line, num }) => `  Zeile ${num}: ${line.substring(0, 100)}${line.length > 100 ? "..." : ""}`
            ).join("\n")}`);
          }
        }

        if (results.length === 0) {
          return `Keine Treffer für "${args.query}" gefunden.`;
        }
        return `Suchergebnisse für "${args.query}":\n\n${results.join("\n\n")}`;
      } catch (error) {
        return `Fehler bei der Suche: ${error}`;
      }
    }

    default:
      return `Unbekannte Funktion: ${name}`;
  }
}

export async function sendChatMessage(options: ChatOptions): Promise<string> {
  const { messages, apiKey, model, projectPath, onFileCreated } = options;
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  let contextInfo = "";
  if (projectPath) {
    contextInfo = `\n\nAktuelles Projektverzeichnis: ${projectPath}`;
  }

  const systemMessage = SYSTEM_PROMPT + contextInfo;

  // Initial request with tools
  let response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      ...messages,
    ],
    tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 2000,
  });

  let assistantMessage = response.choices[0]?.message;
  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
    ...messages,
  ];

  // Process tool calls in a loop
  while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
    console.log("Processing tool calls:", assistantMessage.tool_calls.length);
    
    // Add assistant message with tool calls
    conversationMessages.push(assistantMessage);

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const result = await processToolCall(toolCall, projectPath || "", options);
      
      // Check if a file was created and notify
      if (toolCall.function.name === "create_file" && result.includes("erfolgreich erstellt")) {
        const args = JSON.parse(toolCall.function.arguments);
        if (onFileCreated) {
          onFileCreated(`${projectPath}/${args.file_path}`);
        }
      }

      // Add tool result
      conversationMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Get next response
    response = await openai.chat.completions.create({
      model,
      messages: conversationMessages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2000,
    });

    assistantMessage = response.choices[0]?.message;
  }

  return assistantMessage?.content || "Keine Antwort erhalten.";
}

export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

// Cosine similarity calculation
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

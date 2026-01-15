import OpenAI from "openai";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile, fileExists, readDirectory, renameFile, createDirectory } from "./fileSystem";
import { moveToTrash } from "./trash";
import { getAllTools, callTool, parseMcpToolCall, mcpToolsToOpenAI, type McpServerConfig } from "./mcp";

// Types for web search
interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

interface WebSearchResponse {
  results: WebSearchResult[];
  error: string | null;
}

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
  mcpServers?: McpServerConfig[];
  onFileCreated?: (path: string) => void;
  onFileUpdated?: (path: string, newContent: string) => void;
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
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Benennt eine Datei oder einen Ordner um (ändert nur den Namen, nicht den Inhalt)",
      parameters: {
        type: "object",
        properties: {
          old_path: {
            type: "string",
            description: "Der aktuelle relative Pfad zur Datei (z.B. 'notizen/alte-notiz.md')",
          },
          new_name: {
            type: "string",
            description: "Der neue Dateiname (nur der Name, nicht der ganze Pfad, z.B. 'neue-notiz.md')",
          },
        },
        required: ["old_path", "new_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Löscht eine Datei (verschiebt sie in den Papierkorb)",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Der relative Pfad zur Datei die gelöscht werden soll",
          },
        },
        required: ["file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Erstellt einen neuen Ordner im Projekt",
      parameters: {
        type: "object",
        properties: {
          folder_path: {
            type: "string",
            description: "Der relative Pfad für den neuen Ordner (z.B. 'notizen/archiv' oder 'projekte')",
          },
        },
        required: ["folder_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Verschiebt eine Datei oder einen Ordner an einen anderen Ort",
      parameters: {
        type: "object",
        properties: {
          source_path: {
            type: "string",
            description: "Der aktuelle relative Pfad zur Datei/Ordner (z.B. 'alte-notiz.md')",
          },
          destination_folder: {
            type: "string",
            description: "Der Zielordner (z.B. 'archiv' oder 'notizen/alt'). Leer lassen für Projekt-Root.",
          },
        },
        required: ["source_path", "destination_folder"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Sucht im Internet nach Informationen. Nutze dies um aktuelle Informationen zu finden oder Fakten zu überprüfen.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Der Suchbegriff oder die Frage für die Internet-Suche",
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
- create_folder: Erstellt einen neuen Ordner
- update_file: Aktualisiert eine bestehende Datei (Inhalt ändern)
- rename_file: Benennt eine Datei um (nur Name ändern, nicht Inhalt)
- move_file: Verschiebt eine Datei/Ordner an einen anderen Ort
- delete_file: Löscht eine Datei (verschiebt in Papierkorb)
- list_files: Listet Dateien im Projekt auf
- search_content: Durchsucht Dateien nach Inhalten
- web_search: Sucht im Internet nach aktuellen Informationen

WICHTIG:
- Wenn der Benutzer dich bittet, eine Datei zu erstellen, nutze IMMER die create_file Funktion
- Wenn der Benutzer einen ORDNER erstellen will, nutze create_folder
- Wenn der Benutzer eine Datei UMBENENNEN will, nutze rename_file (NICHT update_file!)
- Wenn der Benutzer eine Datei VERSCHIEBEN will, nutze move_file
- Wenn der Benutzer den INHALT einer Datei ändern will, nutze update_file
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

  // Check if this is an MCP tool call
  const mcpCall = parseMcpToolCall(name);
  if (mcpCall) {
    try {
      const result = await callTool(mcpCall.serverId, mcpCall.toolName, args);
      return typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (error) {
      return `MCP-Tool Fehler: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
        
        // Direct mode: write and notify
        await writeTextFile(filePath, args.content);
        
        // Notify that file was updated so UI can refresh
        if (options.onFileUpdated) {
          options.onFileUpdated(filePath, args.content);
        }
        
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

    case "rename_file": {
      const oldFilePath = `${projectPath}/${args.old_path}`;
      try {
        const exists = await fileExists(oldFilePath);
        if (!exists) {
          return `Fehler: Datei "${args.old_path}" nicht gefunden.`;
        }
        
        // Build new path: keep directory, change name
        const pathParts = args.old_path.split("/");
        pathParts[pathParts.length - 1] = args.new_name;
        const newRelativePath = pathParts.join("/");
        const newFilePath = `${projectPath}/${newRelativePath}`;
        
        // Check if target already exists
        const targetExists = await fileExists(newFilePath);
        if (targetExists) {
          return `Fehler: Eine Datei mit dem Namen "${args.new_name}" existiert bereits an dieser Stelle.`;
        }
        
        await renameFile(oldFilePath, newFilePath);
        return `Datei wurde erfolgreich von "${args.old_path}" zu "${newRelativePath}" umbenannt.`;
      } catch (error) {
        return `Fehler beim Umbenennen der Datei: ${error}`;
      }
    }

    case "delete_file": {
      const filePath = `${projectPath}/${args.file_path}`;
      try {
        const exists = await fileExists(filePath);
        if (!exists) {
          return `Fehler: Datei "${args.file_path}" nicht gefunden.`;
        }
        
        await moveToTrash(filePath, projectPath);
        return `Datei "${args.file_path}" wurde in den Papierkorb verschoben.`;
      } catch (error) {
        return `Fehler beim Löschen der Datei: ${error}`;
      }
    }

    case "create_folder": {
      const folderPath = `${projectPath}/${args.folder_path}`;
      try {
        const exists = await fileExists(folderPath);
        if (exists) {
          return `Ordner "${args.folder_path}" existiert bereits.`;
        }
        
        await createDirectory(folderPath);
        return `Ordner "${args.folder_path}" wurde erfolgreich erstellt.`;
      } catch (error) {
        return `Fehler beim Erstellen des Ordners: ${error}`;
      }
    }

    case "move_file": {
      const sourcePath = `${projectPath}/${args.source_path}`;
      try {
        const exists = await fileExists(sourcePath);
        if (!exists) {
          return `Fehler: "${args.source_path}" nicht gefunden.`;
        }
        
        // Get filename from source path
        const fileName = args.source_path.split("/").pop() || args.source_path;
        
        // Build destination path
        const destFolder = args.destination_folder || "";
        const destPath = destFolder 
          ? `${projectPath}/${destFolder}/${fileName}`
          : `${projectPath}/${fileName}`;
        const destRelative = destFolder ? `${destFolder}/${fileName}` : fileName;
        
        // Check if destination folder exists, create if not
        if (destFolder) {
          const destFolderPath = `${projectPath}/${destFolder}`;
          const folderExists = await fileExists(destFolderPath);
          if (!folderExists) {
            await createDirectory(destFolderPath);
          }
        }
        
        // Check if target already exists
        const targetExists = await fileExists(destPath);
        if (targetExists) {
          return `Fehler: "${destRelative}" existiert bereits am Zielort.`;
        }
        
        await renameFile(sourcePath, destPath);
        return `"${args.source_path}" wurde erfolgreich nach "${destRelative}" verschoben.`;
      } catch (error) {
        return `Fehler beim Verschieben: ${error}`;
      }
    }

    case "web_search": {
      try {
        // Use Tauri backend for web search to avoid CORS issues
        const response = await invoke<WebSearchResponse>("web_search", { query: args.query });
        
        if (response.error) {
          return `Web-Suche Fehler: ${response.error}`;
        }
        
        if (response.results.length === 0) {
          return `Keine Suchergebnisse für "${args.query}" gefunden.`;
        }
        
        // Format results nicely
        let result = `**Web-Suchergebnisse für "${args.query}":**\n\n`;
        
        for (const item of response.results) {
          result += `### ${item.title}\n`;
          if (item.content) {
            result += `${item.content}\n`;
          }
          result += `🔗 ${item.url}\n\n`;
        }
        
        return result;
      } catch (error) {
        return `Fehler bei der Web-Suche: ${error instanceof Error ? error.message : String(error)}`;
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

  // Get MCP tools if any servers are connected
  const mcpTools = getAllTools();
  const mcpToolsForOpenAI = mcpToolsToOpenAI(mcpTools);
  
  // Combine built-in tools with MCP tools
  const allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    ...tools, 
    ...mcpToolsForOpenAI as OpenAI.Chat.Completions.ChatCompletionTool[]
  ];
  
  // Add MCP tools info to system message if available
  let mcpInfo = "";
  if (mcpTools.length > 0) {
    const serverNames = [...new Set(mcpTools.map(t => t.serverName))];
    mcpInfo = `\n\nVerfügbare externe Tools (MCP): ${serverNames.join(", ")}`;
  }

  const systemMessage = SYSTEM_PROMPT + contextInfo + mcpInfo;

  // Initial request with tools
  let response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      ...messages,
    ],
    tools: allTools.length > 0 ? allTools : undefined,
    tool_choice: allTools.length > 0 ? "auto" : undefined,
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

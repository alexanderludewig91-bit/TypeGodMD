/**
 * MCP (Model Context Protocol) Service
 * Allows connecting to MCP servers and using their tools
 */

import { Command } from "@tauri-apps/plugin-shell";

// MCP Types
export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string;  // For stdio: command to run
  args?: string[];   // For stdio: command arguments
  url?: string;      // For SSE: server URL
  enabled: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpServerConnection {
  config: McpServerConfig;
  tools: McpTool[];
  resources: McpResource[];
  process?: ReturnType<typeof Command.create> extends Promise<infer T> ? T : never;
  isConnected: boolean;
}

// Store for active connections
const connections = new Map<string, McpServerConnection>();

/**
 * Connect to an MCP server
 */
export async function connectToServer(config: McpServerConfig): Promise<McpTool[]> {
  if (!config.enabled) {
    throw new Error("Server ist deaktiviert");
  }

  if (config.type === "stdio") {
    return connectStdioServer(config);
  } else if (config.type === "sse") {
    return connectSseServer(config);
  }

  throw new Error(`Unbekannter Server-Typ: ${config.type}`);
}

/**
 * Connect to a stdio-based MCP server
 */
async function connectStdioServer(config: McpServerConfig): Promise<McpTool[]> {
  if (!config.command) {
    throw new Error("Kein Befehl für stdio-Server angegeben");
  }

  try {
    // Create the command
    const command = Command.create(config.command, config.args || []);
    
    // Track the connection
    const connection: McpServerConnection = {
      config,
      tools: [],
      resources: [],
      isConnected: false,
    };

    // Spawn the process
    const process = await command.spawn();
    
    // Set up communication
    // Note: Full MCP protocol implementation would require JSON-RPC over stdio
    // For now, we'll use a simplified approach
    
    connection.isConnected = true;
    connections.set(config.id, connection);

    // Initialize the server and get tools
    const tools = await initializeServer(config.id);
    connection.tools = tools;

    return tools;
  } catch (error) {
    console.error("Failed to connect to stdio server:", error);
    throw new Error(`Verbindung zu ${config.name} fehlgeschlagen: ${error}`);
  }
}

/**
 * Connect to an SSE-based MCP server
 */
async function connectSseServer(config: McpServerConfig): Promise<McpTool[]> {
  if (!config.url) {
    throw new Error("Keine URL für SSE-Server angegeben");
  }

  try {
    // For SSE servers, we make HTTP requests
    const response = await fetch(`${config.url}/tools`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const tools: McpTool[] = data.tools || [];

    const connection: McpServerConnection = {
      config,
      tools,
      resources: [],
      isConnected: true,
    };

    connections.set(config.id, connection);
    return tools;
  } catch (error) {
    console.error("Failed to connect to SSE server:", error);
    throw new Error(`Verbindung zu ${config.name} fehlgeschlagen: ${error}`);
  }
}

/**
 * Initialize an MCP server and get available tools
 */
async function initializeServer(serverId: string): Promise<McpTool[]> {
  const connection = connections.get(serverId);
  if (!connection) {
    return [];
  }

  // For stdio servers, send initialize request via JSON-RPC
  // This is a simplified implementation
  // Full MCP would use proper JSON-RPC over stdin/stdout

  return connection.tools;
}

/**
 * Disconnect from an MCP server
 */
export async function disconnectFromServer(serverId: string): Promise<void> {
  const connection = connections.get(serverId);
  if (!connection) {
    return;
  }

  try {
    // For stdio servers, kill the process
    if (connection.config.type === "stdio" && connection.process) {
      // Kill process
    }

    connections.delete(serverId);
  } catch (error) {
    console.error("Failed to disconnect from server:", error);
  }
}

/**
 * Get all tools from all connected servers
 */
export function getAllTools(): { serverId: string; serverName: string; tool: McpTool }[] {
  const allTools: { serverId: string; serverName: string; tool: McpTool }[] = [];

  for (const [serverId, connection] of connections) {
    if (connection.isConnected) {
      for (const tool of connection.tools) {
        allTools.push({
          serverId,
          serverName: connection.config.name,
          tool,
        });
      }
    }
  }

  return allTools;
}

/**
 * Call a tool on an MCP server
 */
export async function callTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const connection = connections.get(serverId);
  if (!connection || !connection.isConnected) {
    throw new Error(`Server ${serverId} ist nicht verbunden`);
  }

  if (connection.config.type === "sse") {
    // For SSE servers, make HTTP request
    const response = await fetch(`${connection.config.url}/tools/${toolName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ arguments: args }),
    });

    if (!response.ok) {
      throw new Error(`Tool-Aufruf fehlgeschlagen: HTTP ${response.status}`);
    }

    return response.json();
  } else {
    // For stdio servers, send JSON-RPC request
    // This would require proper stdin/stdout communication
    throw new Error("Stdio-Tool-Aufrufe sind noch nicht implementiert");
  }
}

/**
 * Check if any servers are connected
 */
export function hasConnectedServers(): boolean {
  for (const connection of connections.values()) {
    if (connection.isConnected) {
      return true;
    }
  }
  return false;
}

/**
 * Get connection status for all servers
 */
export function getConnectionStatus(): { id: string; name: string; connected: boolean }[] {
  const status: { id: string; name: string; connected: boolean }[] = [];
  
  for (const [id, connection] of connections) {
    status.push({
      id,
      name: connection.config.name,
      connected: connection.isConnected,
    });
  }

  return status;
}

/**
 * Convert MCP tools to OpenAI function format
 */
export function mcpToolsToOpenAI(tools: { serverId: string; serverName: string; tool: McpTool }[]): {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}[] {
  return tools.map(({ serverId, tool }) => ({
    type: "function" as const,
    function: {
      name: `mcp_${serverId}_${tool.name}`,
      description: `[MCP] ${tool.description}`,
      parameters: {
        type: "object" as const,
        properties: tool.inputSchema.properties || {},
        required: tool.inputSchema.required,
      },
    },
  }));
}

/**
 * Parse MCP tool call from OpenAI function name
 */
export function parseMcpToolCall(functionName: string): { serverId: string; toolName: string } | null {
  if (!functionName.startsWith("mcp_")) {
    return null;
  }

  const parts = functionName.slice(4).split("_");
  if (parts.length < 2) {
    return null;
  }

  const serverId = parts[0];
  const toolName = parts.slice(1).join("_");

  return { serverId, toolName };
}

// Example MCP server configurations
// These are examples that users can add manually in settings
export const EXAMPLE_MCP_SERVERS: McpServerConfig[] = [
  // SSE (HTTP) based servers
  {
    id: "brave-search",
    name: "Brave Search",
    type: "sse",
    url: "http://localhost:3001",
    enabled: false,
  },
  // Stdio (process) based servers
  {
    id: "mcp-filesystem",
    name: "MCP Filesystem",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
    enabled: false,
  },
  {
    id: "mcp-github",
    name: "GitHub",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    enabled: false,
  },
  {
    id: "mcp-sqlite",
    name: "SQLite Database",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/path/to/db.sqlite"],
    enabled: false,
  },
];

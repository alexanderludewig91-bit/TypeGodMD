import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "../../stores/appStore";
import { readTextFile } from "../../services/fileSystem";

interface GraphNode {
  id: string;
  name: string;
  path: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function GraphView() {
  const { currentProject, fileTree, openFile } = useAppStore();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Get all markdown files recursively
  const getAllMarkdownFiles = useCallback((nodes: typeof fileTree): string[] => {
    const files: string[] = [];
    for (const node of nodes) {
      if (node.isDirectory && node.children) {
        files.push(...getAllMarkdownFiles(node.children));
      } else if (node.name.endsWith(".md")) {
        files.push(node.path);
      }
    }
    return files;
  }, []);

  // Extract links from markdown content
  const extractLinks = (content: string, basePath: string): string[] => {
    const links: string[] = [];
    
    // Match standard markdown links: [text](path.md)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    let match;
    
    while ((match = mdLinkRegex.exec(content)) !== null) {
      const linkPath = match[2];
      // Resolve relative paths
      if (!linkPath.startsWith("/") && !linkPath.startsWith("http")) {
        const dir = basePath.substring(0, basePath.lastIndexOf("/"));
        links.push(`${dir}/${linkPath}`);
      } else if (!linkPath.startsWith("http")) {
        links.push(linkPath);
      }
    }
    
    return links;
  };

  // Build graph data
  useEffect(() => {
    const buildGraph = async () => {
      if (!currentProject) return;
      
      setLoading(true);
      
      const files = getAllMarkdownFiles(fileTree);
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const nodeMap = new Map<string, boolean>();

      // Create nodes for all files
      for (const filePath of files) {
        const name = filePath.split("/").pop()?.replace(".md", "") || filePath;
        nodes.push({
          id: filePath,
          name,
          path: filePath,
          val: 1,
        });
        nodeMap.set(filePath, true);
      }

      // Find links between files
      for (const filePath of files) {
        try {
          const content = await readTextFile(filePath);
          const fileLinks = extractLinks(content, filePath);
          
          for (const targetPath of fileLinks) {
            if (nodeMap.has(targetPath) && targetPath !== filePath) {
              links.push({
                source: filePath,
                target: targetPath,
              });
              
              // Increase node value for connected nodes
              const targetNode = nodes.find((n) => n.id === targetPath);
              if (targetNode) {
                targetNode.val += 1;
              }
            }
          }
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }

      setGraphData({ nodes, links });
      setLoading(false);
    };

    buildGraph();
  }, [currentProject, fileTree, getAllMarkdownFiles]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleNodeClick = (node: GraphNode) => {
    openFile(node.path);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-dark-text-muted">Graph wird erstellt...</div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <p className="text-dark-text-muted mb-2">Keine Notizen gefunden</p>
          <p className="text-dark-text-muted text-sm opacity-60">
            Erstelle Markdown-Dateien, um den Graph zu sehen
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full bg-dark-bg relative overflow-hidden">
      {/* Simple SVG-based graph visualization */}
      <svg width={dimensions.width} height={dimensions.height} className="absolute inset-0">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#4a5568" />
          </marker>
        </defs>

        {/* Links */}
        <g>
          {graphData.links.map((link, i) => {
            const sourceNode = graphData.nodes.find((n) => n.id === link.source);
            const targetNode = graphData.nodes.find((n) => n.id === link.target);
            if (!sourceNode || !targetNode) return null;

            // Simple force-directed layout simulation
            const sourceIndex = graphData.nodes.indexOf(sourceNode);
            const targetIndex = graphData.nodes.indexOf(targetNode);
            const angle1 = (sourceIndex / graphData.nodes.length) * 2 * Math.PI;
            const angle2 = (targetIndex / graphData.nodes.length) * 2 * Math.PI;
            const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
            const cx = dimensions.width / 2;
            const cy = dimensions.height / 2;

            const x1 = cx + Math.cos(angle1) * radius;
            const y1 = cy + Math.sin(angle1) * radius;
            const x2 = cx + Math.cos(angle2) * radius;
            const y2 = cy + Math.sin(angle2) * radius;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#4a5568"
                strokeWidth="1"
                opacity="0.5"
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {graphData.nodes.map((node, i) => {
            const angle = (i / graphData.nodes.length) * 2 * Math.PI;
            const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
            const cx = dimensions.width / 2;
            const cy = dimensions.height / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const nodeRadius = Math.min(8 + node.val * 2, 20);

            return (
              <g
                key={node.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => handleNodeClick(node)}
                className="cursor-pointer"
              >
                <circle
                  r={nodeRadius}
                  fill="#0e639c"
                  stroke="#1177bb"
                  strokeWidth="2"
                  className="hover:fill-[#1177bb] transition-colors"
                />
                <text
                  dy={nodeRadius + 14}
                  textAnchor="middle"
                  fill="#cccccc"
                  fontSize="11"
                  className="pointer-events-none"
                >
                  {node.name.length > 15 ? node.name.slice(0, 15) + "..." : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-dark-panel p-3 rounded-lg text-xs text-dark-text-muted">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-dark-accent"></div>
          <span>Notiz (Größe = Verknüpfungen)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-gray-600"></div>
          <span>Verknüpfung</span>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 bg-dark-panel p-3 rounded-lg text-xs text-dark-text-muted">
        <div>{graphData.nodes.length} Notizen</div>
        <div>{graphData.links.length} Verknüpfungen</div>
      </div>
    </div>
  );
}

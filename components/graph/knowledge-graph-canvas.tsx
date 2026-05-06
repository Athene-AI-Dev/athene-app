"use client";

import { useCallback, useEffect, useState, useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GraphSearch } from "./graph-search";
import { NodeDetailPanel } from "./node-detail-panel";
import { Loader2, Network, RefreshCw, Filter } from "lucide-react";

// ── Entity colour map ───────────────────────────────────────
export const ENTITY_COLORS: Record<string, string> = {
  service: "#3b82f6",   // blue
  person: "#22c55e",    // green
  project: "#f97316",   // orange
  concept: "#a855f7",   // purple
  team: "#14b8a6",      // teal
  technology: "#ec4899", // pink
  process: "#eab308",   // yellow
  organization: "#6366f1", // indigo
  product: "#ef4444",   // red
};
export type EntityColorKey = keyof typeof ENTITY_COLORS;

// ── Types ───────────────────────────────────────────────────

/** Shape of a node coming from the API */
interface APINode {
  id: string;
  label: string;
  entity_type: string;
  description?: string | null;
  department_ids?: string[];
  source_documents?: string[];
  visibility?: string;
  community?: string;
  updated_at?: string;
}

/** Shape of an edge coming from the API */
interface APIEdge {
  id: string;
  source_node: string;
  target_node: string;
  relation: string;
  provenance: string;
  confidence: number;
}

interface NeighborInfo {
  id: string;
  label: string;
  entity_type: string;
  relation: string;
  direction: "outbound" | "inbound";
}

interface KnowledgeGraphCanvasProps {
  userRole: string;
}

// ── React Flow node data shape ──────────────────────────────
type GraphNodeData = Record<string, unknown> & {
  label: string;
  entity_type: string;
};

type GraphNode = Node<GraphNodeData>;

// We store the edge's relation text in data.relation so we can
// access it type-safely (Edge.label is ReactNode, not string).
type GraphEdgeData = Record<string, unknown> & {
  relation: string;
};

type GraphEdge = Edge<GraphEdgeData>;

// ── Edge style by provenance ────────────────────────────────
const EDGE_STYLES: Record<string, React.CSSProperties> = {
  EXTRACTED: { stroke: "#6b7280", strokeWidth: 1.5 },
  INFERRED: { stroke: "#6b7280", strokeWidth: 1, strokeDasharray: "6,3" },
  AMBIGUOUS: { stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "2,2" },
};

// ── Layout helpers ──────────────────────────────────────────

/** Simple grid-based layout grouped by community clusters */
function layoutNodes(apiNodes: APINode[]): GraphNode[] {
  const communities = new Map<string, APINode[]>();
  apiNodes.forEach((n) => {
    const key = n.community ?? "__none__";
    if (!communities.has(key)) communities.set(key, []);
    communities.get(key)!.push(n);
  });

  const rfNodes: GraphNode[] = [];
  let communityIdx = 0;
  const cols = Math.ceil(Math.sqrt(communities.size));

  communities.forEach((members) => {
    const cx = (communityIdx % cols) * 500;
    const cy = Math.floor(communityIdx / cols) * 500;

    const innerCols = Math.ceil(Math.sqrt(members.length));
    members.forEach((n, i) => {
      const ix = i % innerCols;
      const iy = Math.floor(i / innerCols);
      const bgColor = ENTITY_COLORS[n.entity_type] ?? ENTITY_COLORS.concept;

      rfNodes.push({
        id: n.id,
        type: "default",
        position: {
          x: cx + ix * 160 + (Math.random() - 0.5) * 30,
          y: cy + iy * 120 + (Math.random() - 0.5) * 30,
        },
        data: {
          label: n.label,
          entity_type: n.entity_type,
          description: n.description ?? null,
          department_ids: n.department_ids ?? [],
          source_documents: n.source_documents ?? [],
          visibility: n.visibility ?? "public",
          community: n.community ?? null,
          updated_at: n.updated_at ?? null,
        },
        style: {
          backgroundColor: bgColor,
          color: "#fff",
          border: "none",
          borderRadius: "999px",
          padding: "8px 16px",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: `0 2px 8px ${bgColor}40`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          minWidth: "40px",
          textAlign: "center" as const,
        },
      });
    });

    communityIdx++;
  });

  return rfNodes;
}

function buildEdges(apiEdges: APIEdge[]): GraphEdge[] {
  return apiEdges.map((e): GraphEdge => {
    const style = EDGE_STYLES[e.provenance] ?? EDGE_STYLES.EXTRACTED;
    const relationLabel = e.relation.replace(/_/g, " ");
    return {
      id: e.id,
      source: e.source_node,
      target: e.target_node,
      label: relationLabel,
      type: "default",
      animated: e.provenance === "INFERRED",
      style,
      labelStyle: { fontSize: 10, fill: "#9ca3af", fontWeight: 500 },
      labelBgStyle: { fill: "#0a0a0f", fillOpacity: 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#6b7280" },
      data: { relation: e.relation },
    };
  });
}

// ── Main Component ──────────────────────────────────────────

export function KnowledgeGraphCanvas({ userRole }: KnowledgeGraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);
  const [apiNodes, setApiNodes] = useState<APINode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<APINode | null>(null);
  const [neighbors, setNeighbors] = useState<NeighborInfo[]>([]);
  const [neighborsLoading, setNeighborsLoading] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | null>(null);
  const [communities, setCommunities] = useState<string[]>([]);
  const [loadedCommunities, setLoadedCommunities] = useState<Set<string>>(new Set());
  const [totalNodes, setTotalNodes] = useState(0);
  const [isBuildingGraph, setIsBuildingGraph] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const initRef = useRef(false);

  // ── Fetch nodes ──────────────────────────────────────────
  const fetchNodes = useCallback(
    async (page = 1, community?: string, append = false) => {
      setIsLoading(true);
      try {
        let url = `/api/graph/nodes?page=${page}&limit=200`;
        if (community) url += `&community=${encodeURIComponent(community)}`;
        if (departmentFilter) url += `&departmentId=${encodeURIComponent(departmentFilter)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch nodes");
        const data = await res.json();

        const newNodes: APINode[] = data.nodes ?? [];
        setTotalNodes(data.total ?? 0);
        setCommunities(data.communities ?? []);

        if (newNodes.length === 0 && !append) {
          setIsEmpty(true);
          setApiNodes([]);
          setNodes([]);
          setEdges([]);
          return;
        }

        setIsEmpty(false);
        const mergedNodes = append
          ? [...apiNodes, ...newNodes.filter((n) => !apiNodes.some((e) => e.id === n.id))]
          : newNodes;

        setApiNodes(mergedNodes);
        setNodes(layoutNodes(mergedNodes));

        // Fetch edges for the node set
        const nodeIds = mergedNodes.map((n) => n.id);
        if (nodeIds.length > 0) {
          const params = nodeIds.map((id) => `nodeIds[]=${id}`).join("&");
          const edgeRes = await fetch(`/api/graph/edges?${params}`);
          if (edgeRes.ok) {
            const edgeData = await edgeRes.json();
            setEdges(buildEdges(edgeData.edges ?? []));
          }
        }
      } catch (err) {
        console.error("[graph] Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [apiNodes, departmentFilter, setNodes, setEdges]
  );

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    fetchNodes(1);
  }, [fetchNodes]);

  // ── Node click → side panel ───────────────────────────────
  const handleNodeClick: NodeMouseHandler<GraphNode> = useCallback(
    (_event, rfNode) => {
      const node = apiNodes.find((n) => n.id === rfNode.id);
      if (!node) return;

      setSelectedNode(node);
      setNeighborsLoading(true);
      setNeighbors([]);

      // Find neighbors from current edge set
      const neighborList: NeighborInfo[] = [];

      edges.forEach((e) => {
        // Get the relation string from the data bag (type-safe)
        const relation = (e.data as GraphEdgeData | undefined)?.relation ?? "RELATED_TO";

        if (e.source === node.id) {
          const targetNode = apiNodes.find((n) => n.id === e.target);
          if (targetNode) {
            neighborList.push({
              id: targetNode.id,
              label: targetNode.label,
              entity_type: targetNode.entity_type,
              relation,
              direction: "outbound",
            });
          }
        } else if (e.target === node.id) {
          const sourceNode = apiNodes.find((n) => n.id === e.source);
          if (sourceNode) {
            neighborList.push({
              id: sourceNode.id,
              label: sourceNode.label,
              entity_type: sourceNode.entity_type,
              relation,
              direction: "inbound",
            });
          }
        }
      });

      setNeighbors(neighborList);
      setNeighborsLoading(false);
    },
    [apiNodes, edges]
  );

  // ── Search highlight ──────────────────────────────────────
  const handleSearchResults = useCallback(
    (nodeIds: string[]) => {
      setHighlightedIds(new Set(nodeIds));
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          style: {
            ...n.style,
            opacity: nodeIds.includes(n.id) ? 1 : 0.15,
            transform: nodeIds.includes(n.id) ? "scale(1.15)" : "scale(1)",
          },
        }))
      );
    },
    [setNodes]
  );

  const handleSearchClear = useCallback(() => {
    setHighlightedIds(null);
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: 1,
          transform: "scale(1)",
        },
      }))
    );
  }, [setNodes]);

  // ── Load more communities ─────────────────────────────────
  const handleLoadMore = useCallback(() => {
    const unloaded = communities.filter((c) => !loadedCommunities.has(c));
    if (unloaded.length === 0) return;

    const next = unloaded[0];
    setLoadedCommunities((prev) => new Set([...prev, next]));
    fetchNodes(1, next, true);
  }, [communities, loadedCommunities, fetchNodes]);

  // ── Navigate to node ──────────────────────────────────────
  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      const node = apiNodes.find((n) => n.id === nodeId);
      if (node) setSelectedNode(node);
    },
    [apiNodes]
  );

  // ── Build graph (empty state) ─────────────────────────────
  const handleBuildGraph = useCallback(async () => {
    setIsBuildingGraph(true);
    try {
      const res = await fetch("/api/worker/graph-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: "full" }),
      });
      if (!res.ok) throw new Error("Build request failed");
      setTimeout(() => fetchNodes(1), 5000);
    } catch (err) {
      console.error("[graph] Build failed:", err);
    } finally {
      setIsBuildingGraph(false);
    }
  }, [fetchNodes]);

  // ── MiniMap node colour ───────────────────────────────────
  const miniMapNodeColor = useCallback((node: GraphNode) => {
    const entityType = node.data?.entity_type as string | undefined;
    return (entityType && ENTITY_COLORS[entityType]) ?? "#6b7280";
  }, []);

  // ── Empty state ───────────────────────────────────────────
  if (!isLoading && isEmpty) {
    return (
      <div className="graph-empty-state" id="graph-empty-state">
        <div className="graph-empty-state__icon">
          <Network className="h-16 w-16" />
        </div>
        <h3 className="graph-empty-state__title">No Knowledge Graph Yet</h3>
        <p className="graph-empty-state__desc">
          Build your organization&apos;s knowledge map from connected documents.
        </p>
        <button
          onClick={handleBuildGraph}
          disabled={isBuildingGraph}
          className="graph-empty-state__btn"
          id="build-graph-btn"
        >
          {isBuildingGraph ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Building…
            </>
          ) : (
            <>
              <Network className="h-4 w-4 mr-2" />
              Build Knowledge Graph
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────
  if (isLoading && apiNodes.length === 0) {
    return (
      <div className="graph-loading" id="graph-loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading knowledge graph…</p>
      </div>
    );
  }

  // ── Canvas ────────────────────────────────────────────────
  const hasMoreCommunities = communities.some((c) => !loadedCommunities.has(c));

  return (
    <div className="graph-canvas-wrapper" id="graph-canvas-wrapper">
      {/* Toolbar */}
      <div className="graph-toolbar" id="graph-toolbar">
        <GraphSearch
          onSearchResults={handleSearchResults}
          onClear={handleSearchClear}
        />

        {/* Department filter (admin only) */}
        {userRole === "admin" && (
          <div className="graph-toolbar__filter">
            <Filter className="h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Department ID…"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="graph-toolbar__filter-input"
              id="dept-filter-input"
            />
          </div>
        )}

        <button
          onClick={() => fetchNodes(1)}
          className="graph-toolbar__refresh"
          aria-label="Refresh graph"
          id="refresh-graph-btn"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <span className="graph-toolbar__count">
          {apiNodes.length} / {totalNodes} nodes
        </span>
      </div>

      {/* React Flow Canvas */}
      <div className="graph-canvas" id="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "default",
          }}
        >
          <Background color="#1e1e2e" gap={20} size={1} />
          <Controls
            showInteractive={false}
            position="bottom-left"
            className="graph-controls"
          />
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor="rgba(10, 10, 15, 0.7)"
            className="graph-minimap"
            position="bottom-right"
          />
        </ReactFlow>
      </div>

      {/* Load more */}
      {hasMoreCommunities && (
        <button
          onClick={handleLoadMore}
          className="graph-load-more"
          id="load-more-btn"
        >
          Load more communities
        </button>
      )}

      {/* Legend */}
      <div className="graph-legend" id="graph-legend">
        {Object.entries(ENTITY_COLORS).map(([type, color]) => (
          <div key={type} className="graph-legend__item">
            <span
              className="graph-legend__dot"
              style={{ backgroundColor: color }}
            />
            <span className="graph-legend__label">{type}</span>
          </div>
        ))}
      </div>

      {/* Node detail panel */}
      <NodeDetailPanel
        node={selectedNode}
        neighbors={neighbors}
        isLoading={neighborsLoading}
        onClose={() => setSelectedNode(null)}
        onNavigateToNode={handleNavigateToNode}
      />
    </div>
  );
}

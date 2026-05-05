// ============================================================
// lib/langgraph/nodes/retrieval-agent.ts — Hybrid retrieval (ATH-63)
//
// Runs vector search AND knowledge graph traversal in parallel.
// The graph adds "what is connected?" context (dependency chains,
// impact paths, connected teams) that vector search alone misses.
//
// Merge strategy:
//   - Vector chunks → { type: 'chunk', ... }
//   - Graph results → { type: 'graph', raw, relationships, boundaryReached }
//
// Graceful fallback: if graphQueryTool returns the empty-graph
// sentinel string or throws, we log and continue with vector-only.
// Retrieval never fails because the knowledge graph is empty.
// ============================================================

import { vectorSearchTool } from "../tools/registry";
import { graphQueryTool } from "../tools/graph-query";
import { AtheneStateType } from "../state";
import { HumanMessage } from "@langchain/core/messages";

// ---- Constants ----------------------------------------------

/** Sentinel strings from graphQueryTool that indicate "no data" */
const GRAPH_EMPTY_SENTINELS = [
  "No knowledge graph data available yet.",
  "No entities found in your question to look up in the knowledge graph.",
  "Knowledge graph unavailable: missing org context.",
];

// ---- Helpers ------------------------------------------------

/**
 * Extracts the user's latest query text from the messages array.
 * Falls back to empty string if no human message is found.
 */
function extractQueryText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (
      m instanceof HumanMessage ||
      m?.constructor?.name === "HumanMessage" ||
      m?._getType?.() === "human"
    ) {
      return typeof m.content === "string" ? m.content : String(m.content);
    }
  }
  return "";
}

/**
 * Parses the vector search tool output into typed chunk objects.
 * Always returns an array — never throws.
 */
function parseVectorResults(
  raw: string
): Array<{
  type: "chunk";
  chunk_id?: string;
  document_id: string;
  score?: number;
  content_preview: string;
  chunk_index: number;
  source_type: string;
  external_url?: string | null;
  department_id?: string | null;
  similarity?: number;
}> {
  try {
    const parsed = JSON.parse(raw);
    const results = parsed.results ?? parsed;
    if (!Array.isArray(results)) return [];

    return results.map((r: any) => ({
      type: "chunk" as const,
      chunk_id: r.chunk_id ?? r.id,
      document_id: r.document_id,
      score: r.similarity ?? r.score,
      content_preview: r.content_preview ?? r.content ?? "",
      chunk_index: r.chunk_index ?? 0,
      source_type: r.source_type ?? "unknown",
      external_url: r.external_url ?? null,
      department_id: r.department_id ?? null,
      similarity: r.similarity ?? r.score,
    }));
  } catch {
    return [];
  }
}

/**
 * Parses the graph query tool output into a structured object.
 * Returns null if the output is a sentinel (empty graph).
 */
function parseGraphResults(raw: string): {
  type: "graph";
  raw: string;
  relationships: string[];
  boundaryReached: boolean;
} | null {
  if (!raw || GRAPH_EMPTY_SENTINELS.includes(raw.trim())) {
    return null;
  }

  const lines = raw.split("\n");
  const relationships: string[] = [];
  let boundaryReached = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Note: boundary reached")) {
      boundaryReached = true;
    } else if (trimmed.includes("→") && line.startsWith(" ")) {
      // Relationship line: "  PaymentService → depends_on → AWS EKS [...]"
      relationships.push(trimmed);
    }
  }

  return {
    type: "graph",
    raw,
    relationships,
    boundaryReached,
  };
}

// ---- Main node function -------------------------------------

/**
 * Hybrid retrieval agent: runs vector search and graph traversal
 * in parallel, merges results into state.retrieved_chunks.
 *
 * State contract:
 *   IN:  state.messages, state.orgId, state.userId, state.role
 *   OUT: state.retrieved_chunks (merged vector + graph results)
 */
export async function retrievalAgent(
  state: AtheneStateType,
  config: any
): Promise<Partial<AtheneStateType>> {
  const { orgId, userId, role, messages } = state;
  const query = extractQueryText(messages);

  if (!query) {
    console.warn("[retrieval] No query text found in messages");
    return {
      retrieved_chunks: [],
    };
  }

  // Build the security context for tool calls
  const toolConfig = {
    configurable: {
      ...(config?.configurable ?? {}),
      orgId,
      userId,
      role,
    },
    metadata: {
      ...(config?.metadata ?? {}),
      orgId,
      userId,
      role,
    },
  };

  // Map complexity tier from supervisor to topK (ATH-21 MODEL_MATRIX)
  const topKMap: Record<string, number> = { simple: 5, standard: 8, complex: 12 };
  const topK = topKMap[(state as any).complexity ?? "standard"] ?? 8;

  // ── Run both lookups in parallel ──────────────────────────
  const [vectorRaw, graphRaw] = await Promise.all([
    // Vector search — always runs
    vectorSearchTool
      .invoke({ query, topK }, toolConfig)
      .catch((err: unknown) => {
        console.error("[retrieval] Vector search failed:", err);
        return JSON.stringify({ results: [] });
      }),

    // Graph traversal — graceful fallback on failure or empty graph
    graphQueryTool
      .invoke({ question: query, maxHops: 2 }, toolConfig)
      .catch((err: unknown) => {
        console.error("[retrieval] Graph query failed (continuing vector-only):", err);
        return "No knowledge graph data available yet.";
      }),
  ]);

  // ── Parse results ─────────────────────────────────────────
  const vectorChunks = parseVectorResults(vectorRaw as string);
  const graphResult = parseGraphResults(graphRaw as string);

  // ── Merge into unified retrieved_chunks ────────────────────
  const mergedResults: any[] = [...vectorChunks];

  if (graphResult) {
    mergedResults.push(graphResult);
  }

  // Log for observability
  console.info(
    `[retrieval] query="${query.slice(0, 80)}" vectorChunks=${vectorChunks.length} graphAvailable=${!!graphResult}${
      graphResult?.boundaryReached ? " boundaryReached=true" : ""
    }`
  );

  return {
    retrieved_chunks: mergedResults,
  };
}

// ============================================================
// lib/langgraph/nodes/__tests__/retrieval-agent.test.ts (ATH-63)
//
// Tests the hybrid retrieval agent:
//   1. Graph populated: merged results, graph context present
//   2. Graph empty: vector-only, no error
//   3. boundary_reached: note appears in merged results
//   4. Both fail: returns empty gracefully
//   5. No query: returns empty
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock dependencies BEFORE imports -----------------------

const mockVectorInvoke = vi.fn();
const mockGraphInvoke = vi.fn();

// Mock the Supabase RLS client to prevent env var errors during tests
vi.mock("@/lib/supabase/rls-client", () => ({
  withRLS: vi.fn(),
}));

vi.mock("@/lib/langgraph/tools/registry", () => ({
  vectorSearchTool: {
    invoke: (...args: unknown[]) => mockVectorInvoke(...args),
  },
  crossDeptVectorSearchTool: {
    invoke: vi.fn(),
  },
}));

vi.mock("@/lib/langgraph/tools/graph-query", () => ({
  graphQueryTool: {
    invoke: (...args: unknown[]) => mockGraphInvoke(...args),
  },
}));

// ---- Import after mocks -------------------------------------

import { retrievalAgent } from "../retrieval-agent";

// ---- Helpers ------------------------------------------------

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-test",
    userId: "user-test",
    role: "member",
    messages: [
      {
        _getType: () => "human",
        content: "What does the Payment Service depend on?",
      },
    ],
    next: "",
    retrievedDocs: [],
    awaiting_approval: false,
    pending_write_action: null,
    run_status: "running",
    final_answer: null,
    cited_sources: [],
    retrieved_chunks: [],
    action_result: null,
    action_error: null,
    task_type: null,
    is_cross_dept_query: false,
    ...overrides,
  } as any;
}

const defaultConfig = {
  configurable: {},
  metadata: {},
};

// Sample vector search response
const sampleVectorResponse = JSON.stringify({
  tool: "vectorSearch",
  query: "What does the Payment Service depend on?",
  results: [
    {
      document_id: "doc-payment-arch",
      content_preview: "The Payment Service runs on AWS EKS and connects to Stripe API.",
      chunk_index: 0,
      source_type: "confluence",
      similarity: 0.92,
      external_url: "https://wiki.example.com/payment",
    },
    {
      document_id: "doc-infra-guide",
      content_preview: "AWS EKS clusters are managed by the Platform team.",
      chunk_index: 3,
      source_type: "gdrive",
      similarity: 0.85,
    },
  ],
});

// Sample graph response with entities and relationships
const sampleGraphResponse = [
  "Entities found: Payment Service (service), AWS EKS (infrastructure)",
  "Relationships:",
  "  Payment Service → depends_on → AWS EKS [document, 0.95]",
  "  Payment Service → calls → Stripe API [document, 0.88]",
  "Source departments: platform, payments",
].join("\n");

// Graph response with boundary reached
const graphWithBoundary = [
  "Entities found: Payment Service (service)",
  "Relationships:",
  "  Payment Service → depends_on → AWS EKS [document, 0.95]",
  "Note: boundary reached — some related nodes are not accessible to you.",
].join("\n");

// ---- Tests --------------------------------------------------

describe("retrievalAgent — hybrid mode (ATH-63)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges vector chunks and graph results when both succeed", async () => {
    mockVectorInvoke.mockResolvedValue(sampleVectorResponse);
    mockGraphInvoke.mockResolvedValue(sampleGraphResponse);

    const result = await retrievalAgent(makeState(), defaultConfig);

    // Should have vector chunks + 1 graph result
    expect(result.retrieved_chunks).toBeDefined();
    const chunks = result.retrieved_chunks!;
    expect(chunks.length).toBe(3); // 2 vector + 1 graph

    // Verify vector chunks
    const vectorItems = chunks.filter((c: any) => c.type === "chunk");
    expect(vectorItems).toHaveLength(2);
    expect(vectorItems[0].document_id).toBe("doc-payment-arch");
    expect(vectorItems[0].score).toBe(0.92);
    expect(vectorItems[1].document_id).toBe("doc-infra-guide");

    // Verify graph result
    const graphItems = chunks.filter((c: any) => c.type === "graph");
    expect(graphItems).toHaveLength(1);
    expect(graphItems[0].relationships.length).toBeGreaterThan(0);
    expect(graphItems[0].relationships[0]).toContain("Payment Service");
    expect(graphItems[0].boundaryReached).toBe(false);

    // Verify both tools were called in parallel
    expect(mockVectorInvoke).toHaveBeenCalledOnce();
    expect(mockGraphInvoke).toHaveBeenCalledOnce();

    // Verify graph tool received correct args
    const graphArgs = mockGraphInvoke.mock.calls[0][0];
    expect(graphArgs.question).toContain("Payment Service");
    expect(graphArgs.maxHops).toBe(2);
  });

  it("returns vector-only when graph returns empty sentinel (no error)", async () => {
    mockVectorInvoke.mockResolvedValue(sampleVectorResponse);
    mockGraphInvoke.mockResolvedValue("No knowledge graph data available yet.");

    const result = await retrievalAgent(makeState(), defaultConfig);

    const chunks = result.retrieved_chunks!;

    // Only vector chunks — no graph result added
    const vectorItems = chunks.filter((c: any) => c.type === "chunk");
    const graphItems = chunks.filter((c: any) => c.type === "graph");

    expect(vectorItems).toHaveLength(2);
    expect(graphItems).toHaveLength(0);
  });

  it("returns vector-only when graph throws (graceful fallback)", async () => {
    mockVectorInvoke.mockResolvedValue(sampleVectorResponse);
    mockGraphInvoke.mockRejectedValue(new Error("Supabase connection timeout"));

    const result = await retrievalAgent(makeState(), defaultConfig);

    const chunks = result.retrieved_chunks!;

    // Vector chunks still present
    const vectorItems = chunks.filter((c: any) => c.type === "chunk");
    expect(vectorItems).toHaveLength(2);

    // No graph items
    const graphItems = chunks.filter((c: any) => c.type === "graph");
    expect(graphItems).toHaveLength(0);
  });

  it("sets boundaryReached when graph traversal hits visibility limit", async () => {
    mockVectorInvoke.mockResolvedValue(sampleVectorResponse);
    mockGraphInvoke.mockResolvedValue(graphWithBoundary);

    const result = await retrievalAgent(makeState(), defaultConfig);

    const chunks = result.retrieved_chunks!;
    const graphItems = chunks.filter((c: any) => c.type === "graph");

    expect(graphItems).toHaveLength(1);
    expect(graphItems[0].boundaryReached).toBe(true);
  });

  it("returns empty when both vector and graph fail", async () => {
    mockVectorInvoke.mockRejectedValue(new Error("Vector DB down"));
    mockGraphInvoke.mockRejectedValue(new Error("Graph DB down"));

    const result = await retrievalAgent(makeState(), defaultConfig);

    expect(result.retrieved_chunks).toEqual([]);
  });

  it("returns empty when no query text is found in messages", async () => {
    const result = await retrievalAgent(
      makeState({ messages: [] }),
      defaultConfig
    );

    expect(result.retrieved_chunks).toEqual([]);
    // Tools should not be called
    expect(mockVectorInvoke).not.toHaveBeenCalled();
    expect(mockGraphInvoke).not.toHaveBeenCalled();
  });

  it("passes correct security context (orgId, userId, role) to both tools", async () => {
    mockVectorInvoke.mockResolvedValue(JSON.stringify({ results: [] }));
    mockGraphInvoke.mockResolvedValue("No knowledge graph data available yet.");

    await retrievalAgent(
      makeState({ orgId: "org-prod", userId: "user-42", role: "bi_analyst" }),
      defaultConfig
    );

    // Verify vector tool config
    const vectorConfig = mockVectorInvoke.mock.calls[0][1];
    expect(vectorConfig.configurable.orgId).toBe("org-prod");
    expect(vectorConfig.configurable.userId).toBe("user-42");
    expect(vectorConfig.configurable.role).toBe("bi_analyst");

    // Verify graph tool config
    const graphConfig = mockGraphInvoke.mock.calls[0][1];
    expect(graphConfig.configurable.orgId).toBe("org-prod");
    expect(graphConfig.configurable.role).toBe("bi_analyst");
  });
});

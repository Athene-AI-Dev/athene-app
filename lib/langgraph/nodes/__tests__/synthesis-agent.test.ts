// ============================================================
// lib/langgraph/nodes/__tests__/synthesis-agent.test.ts
//
// Covers: empty retrieved_chunks, vector-only, graph context,
// citation extraction, boundary note, BI mode, dept guidance.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock("../../llm-factory", () => ({
  resolveModelClient: vi.fn().mockResolvedValue({
    invoke: (...args: unknown[]) => mockInvoke(...args),
  }),
}));

vi.mock("@/lib/knowledge-graph/modules/registry", () => ({
  VERTICAL_MODULES: [
    {
      id: "dept-bi",
      activating_sources: ["powerbi", "looker"],
      synthesis_prompt_addendum: "Focus on KPIs and data trends.",
    },
  ],
}));

// ─── Import after mocks ─────────────────────────────────────

import { synthesisAgentNode } from "../synthesis-agent";

// ─── Helpers ───────────────────────────────────────────────

function makeChunk(overrides: Record<string, unknown> = {}) {
  return {
    type: "chunk",
    document_id: "doc-1",
    content_preview: "Revenue grew 20% YoY.",
    chunk_index: 0,
    source_type: "confluence",
    similarity: 0.9,
    external_url: "https://wiki.example.com/doc-1",
    department_id: null,
    ...overrides,
  };
}

function makeGraphResult(overrides: Record<string, unknown> = {}) {
  return {
    type: "graph",
    raw: "Entities found: Payment Service (service)\nRelationships:\n  Payment Service → depends_on → AWS EKS [extracted, 0.95]",
    relationships: ["Payment Service → depends_on → AWS EKS [extracted, 0.95]"],
    boundaryReached: false,
    ...overrides,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    userId: "user-1",
    role: "member",
    messages: [{ _getType: () => "human", content: "What drives revenue?" }],
    retrieved_chunks: [],
    task_type: null,
    is_cross_dept_query: false,
    next_node: "",
    awaiting_approval: false,
    pending_write_action: null,
    run_status: "running",
    final_answer: null,
    cited_sources: [],
    action_result: null,
    action_error: null,
    ...overrides,
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────

describe("synthesisAgentNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no-info answer when retrieved_chunks is empty", async () => {
    const result = await synthesisAgentNode(makeState({ retrieved_chunks: [] }));

    expect(result.final_answer).toMatch(/don't have enough information/i);
    expect(result.cited_sources).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns no-info answer when retrieved_chunks is null", async () => {
    const result = await synthesisAgentNode(makeState({ retrieved_chunks: null }));
    expect(result.final_answer).toMatch(/don't have enough information/i);
  });

  it("calls LLM and returns final_answer for vector chunks", async () => {
    mockInvoke.mockResolvedValue({ content: "Revenue grew due to expansion." });

    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: [makeChunk()] })
    );

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(result.final_answer).toBe("Revenue grew due to expansion.");
    expect(result.retrieved_chunks).toEqual([]); // cleared after synthesis
  });

  it("extracts citations from final_answer matching document IDs", async () => {
    mockInvoke.mockResolvedValue({
      content: "Revenue grew [doc-1] and services expanded [doc-2].",
    });

    const chunks = [
      makeChunk({ document_id: "doc-1" }),
      makeChunk({ document_id: "doc-2", source_type: "gdrive", external_url: null }),
    ];

    const result = await synthesisAgentNode(makeState({ retrieved_chunks: chunks }));

    expect(result.cited_sources).toHaveLength(2);
    const ids = (result.cited_sources as any[]).map((s: any) => s.document_id);
    expect(ids).toContain("doc-1");
    expect(ids).toContain("doc-2");
  });

  it("does not cite [EXTRACTED] or [document_id] tags as documents", async () => {
    mockInvoke.mockResolvedValue({
      content: "The service [EXTRACTED] connects to AWS [document_id].",
    });

    const result = await synthesisAgentNode(makeState({ retrieved_chunks: [makeChunk()] }));
    expect(result.cited_sources).toHaveLength(0);
  });

  it("includes graph context section in prompt when graph results present", async () => {
    mockInvoke.mockResolvedValue({ content: "Answer with graph context." });

    await synthesisAgentNode(
      makeState({
        retrieved_chunks: [makeChunk(), makeGraphResult()],
      })
    );

    const systemMessage = mockInvoke.mock.calls[0][0][0];
    expect(systemMessage.content).toContain("KNOWLEDGE GRAPH RELATIONSHIPS");
    expect(systemMessage.content).toContain("Payment Service → depends_on → AWS EKS");
  });

  it("appends boundary note to prompt when any graph result has boundaryReached=true", async () => {
    mockInvoke.mockResolvedValue({ content: "Partial answer." });

    await synthesisAgentNode(
      makeState({
        retrieved_chunks: [makeChunk(), makeGraphResult({ boundaryReached: true })],
      })
    );

    const systemMessage = mockInvoke.mock.calls[0][0][0];
    expect(systemMessage.content).toContain("boundary");
  });

  it("uses BI MODE when task_type is analytical", async () => {
    mockInvoke.mockResolvedValue({ content: "BI answer." });

    await synthesisAgentNode(
      makeState({
        retrieved_chunks: [makeChunk()],
        task_type: "analytical",
      })
    );

    const systemMessage = mockInvoke.mock.calls[0][0][0];
    expect(systemMessage.content).toContain("BI (BUSINESS INTELLIGENCE) MODE");
  });

  it("uses BI MODE when is_cross_dept_query is true", async () => {
    mockInvoke.mockResolvedValue({ content: "Cross-dept answer." });

    await synthesisAgentNode(
      makeState({
        retrieved_chunks: [makeChunk()],
        is_cross_dept_query: true,
      })
    );

    const systemMessage = mockInvoke.mock.calls[0][0][0];
    expect(systemMessage.content).toContain("BI (BUSINESS INTELLIGENCE) MODE");
  });

  it("injects domain guidance when chunks match a vertical module source type", async () => {
    mockInvoke.mockResolvedValue({ content: "BI answer with domain guidance." });

    await synthesisAgentNode(
      makeState({
        retrieved_chunks: [makeChunk({ source_type: "powerbi" })],
      })
    );

    const systemMessage = mockInvoke.mock.calls[0][0][0];
    expect(systemMessage.content).toContain("Focus on KPIs and data trends.");
  });

  it("handles array response content from LLM", async () => {
    mockInvoke.mockResolvedValue({
      content: [
        { type: "text", text: "First part. " },
        { type: "text", text: "Second part." },
      ],
    });

    const result = await synthesisAgentNode(makeState({ retrieved_chunks: [makeChunk()] }));
    expect(result.final_answer).toBe("First part. Second part.");
  });
});

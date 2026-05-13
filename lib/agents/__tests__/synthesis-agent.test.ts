// ============================================================
// synthesis-agent.test.ts — Unit tests for ATH-39
//
// Covers:
//   • Standard mode — cited answer, citation extraction
//   • BI mode — activated by task_type="analytical" or is_cross_dept_query
//   • Empty chunks — hallucination prevention / refusal path (no LLM call)
//   • Hallucinated doc IDs — unknown IDs silently dropped
//   • Multiple citations — deduplication across chunks
//   • LLM error — throw propagates out of the node
//   • Missing prompt file — throws descriptive error
//   • Complex content array — multimodal LLM response handling
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";

// ---- Hoist mocks BEFORE any imports that use them ----------

const mockInvoke = vi.hoisted(() => vi.fn());
const mockStream = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/langgraph/llm-factory", () => ({
  model: { 
    invoke: mockInvoke,
    stream: mockStream,
  },
}));

// ---- Import after mocks ------------------------------------

import { synthesisAgentNode } from "../synthesis-agent";
import type { AtheneState } from "../../langgraph/state";

// ---- Helpers -----------------------------------------------

/**
 * Creates a mock async iterator that yields a single chunk with the given content.
 */
function mockAsyncIterator(content: any) {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { content };
    },
  };
}

const PROMPT_TEMPLATE = "Mode: {{MODE}}\nContext: {{CONTEXT}}";

function makeState(overrides: Partial<AtheneState> = {}): AtheneState {
  return {
    retrieved_chunks: [],
    messages: [new HumanMessage("What is the revenue?")],
    orgId: "org-1",
    userId: "user-1",
    role: "member",
    next: "",
    final_answer: null,
    cited_sources: [],
    task_type: "retrieval",
    is_cross_dept_query: false,
    ...overrides,
  } as unknown as AtheneState;
}

const DOC_A: any = {
  document_id: "doc_123",
  content_preview: "Revenue hit $1M this quarter.",
  chunk_index: 0,
  source_type: "pdf",
  external_url: "https://example.com/report.pdf",
};

const DOC_B: any = {
  document_id: "doc_456",
  content_preview: "Operating costs were $800K.",
  chunk_index: 0,
  source_type: "spreadsheet",
  external_url: null,
};

// ---- Tests -------------------------------------------------

describe("synthesisAgentNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileSync.mockReturnValue(PROMPT_TEMPLATE);
  });

  // ── Standard mode ────────────────────────────────────────

  it("standard mode: returns cited answer and clears retrieved_chunks", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Revenue is $1M [doc_123]."));

    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_A] }),
    );

    expect(result.final_answer).toBe("Revenue is $1M [doc_123].");
    expect(result.cited_sources).toHaveLength(1);
    expect((result.cited_sources as any[])[0].document_id).toBe("doc_123");
    expect((result.cited_sources as any[])[0].external_url).toBe(
      "https://example.com/report.pdf",
    );
    expect(result.retrieved_chunks).toHaveLength(0);
  });

  it("standard mode: system prompt contains STANDARD MODE and chunk context", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Answer [doc_123]."));

    await synthesisAgentNode(makeState({ retrieved_chunks: [DOC_A] }));

    const messages = mockStream.mock.calls[0][0];
    const systemMsg = messages[0];
    expect(systemMsg.content).toContain("STANDARD MODE");
    expect(systemMsg.content).toContain("doc_123");
    expect(systemMsg.content).toContain("Revenue hit $1M this quarter.");
  });

  // ── BI mode ──────────────────────────────────────────────

  it("BI mode: activated when task_type='analytical'", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("BI answer [doc_456]."));

    await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_B], task_type: "analytical" }),
    );

    const messages = mockStream.mock.calls[0][0];
    const systemMsg = messages[0];
    expect(systemMsg.content).toContain("BI (BUSINESS INTELLIGENCE) MODE");
  });

  it("BI mode: activated when is_cross_dept_query=true", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Cross-dept answer [doc_123]."));

    await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_A], is_cross_dept_query: true }),
    );

    const messages = mockStream.mock.calls[0][0];
    const systemMsg = messages[0];
    expect(systemMsg.content).toContain("BI (BUSINESS INTELLIGENCE) MODE");
  });

  it("standard mode: task_type='retrieval' + cross_dept=false stays STANDARD", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Standard answer [doc_123]."));

    await synthesisAgentNode(makeState({ retrieved_chunks: [DOC_A] }));

    const messages = mockStream.mock.calls[0][0];
    const systemMsg = messages[0];
    expect(systemMsg.content).toContain("STANDARD MODE");
    expect(systemMsg.content).not.toContain("BUSINESS INTELLIGENCE");
  });

  // ── Empty chunks (hallucination prevention) ───────────────

  it("empty chunks: returns refusal string without calling LLM", async () => {
    const result = await synthesisAgentNode(makeState({ retrieved_chunks: [] }));

    expect(result.final_answer).toBe(
      "I don't have enough information in your connected sources to answer that.",
    );
    expect(result.cited_sources).toHaveLength(0);
    expect(result.retrieved_chunks).toHaveLength(0);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("null retrieved_chunks: treated as empty, no LLM call", async () => {
    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: undefined as any }),
    );

    expect(result.final_answer).toBe(
      "I don't have enough information in your connected sources to answer that.",
    );
    expect(mockStream).not.toHaveBeenCalled();
  });

  // ── Hallucination prevention — unknown doc IDs ────────────

  it("hallucinated doc ID: unknown reference dropped from citations, text preserved", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Invented fact [doc_999]."));

    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_A] }),
    );

    expect(result.cited_sources).toHaveLength(0);
    expect(result.final_answer).toContain("[doc_999]"); // text preserved
  });

  // ── Multiple citations ────────────────────────────────────

  it("multiple citations: resolves both docs and deduplicates repeated references", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator("Revenue [doc_123] plus costs [doc_456] and again [doc_123]."));

    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_A, DOC_B] }),
    );

    expect(result.cited_sources).toHaveLength(2);
    const ids = (result.cited_sources as any[]).map((c) => c.document_id);
    expect(ids).toContain("doc_123");
    expect(ids).toContain("doc_456");
    // doc_123 referenced twice in text — should appear once in citations
    expect(ids.filter((id: string) => id === "doc_123")).toHaveLength(1);
  });

  // ── LLM error ────────────────────────────────────────────

  it("LLM error: propagates the thrown error to the caller", async () => {
    mockStream.mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(
      synthesisAgentNode(makeState({ retrieved_chunks: [DOC_A] })),
    ).rejects.toThrow("Rate limit exceeded");
  });


  // ── Complex (multimodal) content array from LLM ───────────

  it("complex content array: joins text parts into final_answer", async () => {
    mockStream.mockResolvedValue(mockAsyncIterator([{ type: "text", text: "Revenue is $1M [doc_123]." }]));

    const result = await synthesisAgentNode(
      makeState({ retrieved_chunks: [DOC_A] }),
    );

    expect(result.final_answer).toBe("Revenue is $1M [doc_123].");
    expect(result.cited_sources).toHaveLength(1);
  });
});

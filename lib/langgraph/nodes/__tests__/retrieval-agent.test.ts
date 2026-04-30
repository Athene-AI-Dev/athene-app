import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrievalAgent } from "../retrieval-agent";
import { vectorSearch } from "../../../tools/vector-search";
import { HumanMessage } from "@langchain/core/messages";

// Mock the vector search tool — no real DB/embed calls in unit tests
vi.mock("../../../tools/vector-search", () => ({
  vectorSearch: vi.fn(),
}));

describe("retrievalAgent (live node)", () => {
  const BASE_STATE: any = {
    orgId: "org_1",
    userId: "user_1",
    role: "admin",
    messages: [new HumanMessage("find me info about Q3 sales")],
    // remaining state fields default
    retrievedDocs: [],
    retrieved_chunks: [],
    awaiting_approval: false,
    pending_write_action: null,
    run_status: "running",
    final_answer: null,
    cited_sources: [],
    action_result: null,
    action_error: null,
    task_type: null,
    is_cross_dept_query: false,
    hop_count: 0,
    active_agent: null,
    complexity: null,
    reasoning: null,
    next: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------ //
  // Happy path
  // ------------------------------------------------------------------ //

  it("calls vectorSearch with correct parameters (user_role, not role)", async () => {
    (vectorSearch as any).mockResolvedValue([
      {
        chunk_id: "c1",
        document_id: "d1",
        score: 0.95,
        preview: "Q3 sales were strong",
        chunk_index: 0,
        source_type: "document",
        external_url: null,
        department_id: null,
      },
    ]);

    await retrievalAgent(BASE_STATE);

    expect(vectorSearch).toHaveBeenCalledOnce();
    expect(vectorSearch).toHaveBeenCalledWith({
      orgId: "org_1",
      userId: "user_1",
      user_role: "admin", // ← must be user_role, NOT role (Bug #3 fix)
      query: "find me info about Q3 sales",
      topK: 8,
    });
  });

  it("returns retrieved_chunks mapped to RetrievedChunk shape", async () => {
    (vectorSearch as any).mockResolvedValue([
      {
        chunk_id: "c1",
        document_id: "d1",
        score: 0.95,
        preview: "Q3 sales were strong",
        chunk_index: 2,
        source_type: "report",
        external_url: "https://example.com/doc",
        department_id: "dept_sales",
      },
    ]);

    const update = await retrievalAgent(BASE_STATE);

    // Output must use retrieved_chunks, NOT retrieval_results (Bug #2 fix)
    expect(update.retrieved_chunks).toHaveLength(1);
    expect(update.retrieved_chunks![0]).toEqual({
      id: "c1",
      document_id: "d1",
      content_preview: "Q3 sales were strong",
      chunk_index: 2,
      source_type: "report",
      external_url: "https://example.com/doc",
      department_id: "dept_sales",
      similarity: 0.95,
    });

    // run_status should NOT be set on a successful run
    expect(update.run_status).toBeUndefined();
  });

  it("falls back to res.id when chunk_id is absent", async () => {
    (vectorSearch as any).mockResolvedValue([
      {
        id: "fallback_id",
        document_id: "d2",
        similarity: 0.8,
        content_preview: "Some content",
        chunk_index: 0,
        source_type: "document",
      },
    ]);

    const update = await retrievalAgent(BASE_STATE);

    expect(update.retrieved_chunks![0].id).toBe("fallback_id");
    expect(update.retrieved_chunks![0].similarity).toBe(0.8);
  });

  // ------------------------------------------------------------------ //
  // Edge cases
  // ------------------------------------------------------------------ //

  it("returns run_status: completed when vectorSearch returns empty array", async () => {
    (vectorSearch as any).mockResolvedValue([]);

    const update = await retrievalAgent(BASE_STATE);

    expect(update).toEqual({ run_status: "completed" });
    expect(update.retrieved_chunks).toBeUndefined();
    expect(vectorSearch).toHaveBeenCalledOnce();
  });

  it("returns run_status: completed when orgId is missing", async () => {
    const state = { ...BASE_STATE, orgId: undefined };
    const update = await retrievalAgent(state);

    expect(update).toEqual({ run_status: "completed" });
    expect(vectorSearch).not.toHaveBeenCalled();
  });

  it("returns run_status: completed when messages array is empty", async () => {
    const state = { ...BASE_STATE, messages: [] };
    const update = await retrievalAgent(state);

    expect(update).toEqual({ run_status: "completed" });
    expect(vectorSearch).not.toHaveBeenCalled();
  });

  it("stringifies non-string message content gracefully", async () => {
    (vectorSearch as any).mockResolvedValue([]);

    const state = {
      ...BASE_STATE,
      messages: [{ content: { text: "complex content" } }],
    };

    const update = await retrievalAgent(state);

    // Should not throw; vectorSearch gets called (or not) depending on orgId
    expect(update).toEqual({ run_status: "completed" });
  });
});

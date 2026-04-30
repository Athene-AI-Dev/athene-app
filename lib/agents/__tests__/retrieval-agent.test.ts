import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrievalAgent } from "../retrieval-agent";
import { vectorSearch } from "../../tools/vector-search";

vi.mock("../../tools/vector-search", () => ({
  vectorSearch: vi.fn(),
}));

describe("retrievalAgent", () => {

// Correct state shape matching AtheneState from lib/langgraph/state.ts
const baseState = {
  orgId: "org_1",
  userId: "user_1",
  role: "admin",
  messages: [{ content: "find me info" }],
};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verifies vectorSearch is called with correct params and retrieved_chunks are returned
it("calls vectorSearch with correct parameters and updates state", async () => {
  const mockResults = [
    {
      chunk_id: "c1",
      document_id: "d1",
      score: 0.95,
      preview: "Found some info",
      chunk_index: 0,
      source_type: "document",
      external_url: null,
      department_id: null,
    },
  ];

  (vectorSearch as any).mockResolvedValue(mockResults);

  const update = await retrievalAgent(baseState as any);

  expect(vectorSearch).toHaveBeenCalledWith({
    orgId: "org_1",
    userId: "user_1",
    user_role: "admin",
    query: "find me info",
    topK: 8,
  });

  expect(update.retrieved_chunks).toHaveLength(1);
  expect(update.retrieved_chunks![0]).toEqual({
    id: "c1",
    document_id: "d1",
    content_preview: "Found some info",
    chunk_index: 0,
    source_type: "document",
    external_url: null,
    department_id: null,
    similarity: 0.95,
  });
  expect(update.run_status).toBe("completed");
});

 // Verifies empty results mark agent as completed with no chunks
it("handles empty results by returning run_status completed", async () => {
  (vectorSearch as any).mockResolvedValue([]);

  const update = await retrievalAgent(baseState as any);

  expect(update.run_status).toBe("completed");
  expect(update.retrieved_chunks).toBeUndefined();
});

 // Verifies missing orgId returns completed without calling vectorSearch
it("handles missing orgId gracefully", async () => {
  const state: any = { ...baseState, orgId: undefined };
  const update = await retrievalAgent(state);

  expect(update.run_status).toBe("completed");
  expect(vectorSearch).not.toHaveBeenCalled();
});


// Ensures null content does not become the string "null" and slip past the guard
it("returns completed when content is null", async () => {
  const state = { ...baseState, messages: [{ content: null }] };
  const update = await retrievalAgent(state as any);
  expect(update.run_status).toBe("completed");
  expect(vectorSearch).not.toHaveBeenCalled();
});

// Ensures whitespace-only strings are treated as empty and do not trigger a search
it("returns completed when query is only whitespace", async () => {
  const state = { ...baseState, messages: [{ content: "   " }] };
  const update = await retrievalAgent(state as any);
  expect(update.run_status).toBe("completed");
  expect(vectorSearch).not.toHaveBeenCalled();
});

// Verifies that a successful retrieval always includes run_status completed
it("returns run_status completed on success", async () => {
  (vectorSearch as any).mockResolvedValue([
    { chunk_id: "c1", document_id: "d1", score: 0.9 },
  ]);
  const update = await retrievalAgent(baseState as any);
  expect(update.run_status).toBe("completed");
});
});
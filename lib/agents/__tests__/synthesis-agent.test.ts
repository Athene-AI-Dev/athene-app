import { describe, it, expect, vi, beforeEach } from "vitest";
import { synthesisAgentNode } from "../synthesis-agent";
import fs from "fs";
import { model } from "../../langgraph/llm-factory";

// Mock external dependencies
vi.mock("fs");
vi.mock("../../langgraph/llm-factory", () => ({
  model: {
    invoke: vi.fn(),
  },
}));

describe("Synthesis Agent Node", () => {
  const mockChunks = [
    {
      document_id: "doc_123",
      content_preview: "Revenue hit $1M this quarter.",
      chunk_index: 0,
      source_type: "pdf",
      external_url: "https://example.com/report.pdf",
    },
  ];

  const mockState: any = {
    retrieval_results: mockChunks,
    messages: [
      { content: "What is the revenue?", _getType: () => "human" }
    ],
    orgId: "test-org-id",
    task_type: "retrieval",
    is_cross_dept_query: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as any).mockReturnValue("Mode: {{MODE}}\nContext: {{CONTEXT}}");
  });

  it("Standard Path: should generate a cited answer", async () => {
    vi.mocked(model.invoke).mockResolvedValue({
      content: "Revenue is $1M [doc_123].",
    } as any);

    const result = await synthesisAgentNode(mockState);

    expect(result.final_answer).toBe("Revenue is $1M [doc_123].");
    expect(result.citations!).toHaveLength(1);
    expect((result.citations as any)![0].document_id).toBe("doc_123");
    expect(result.retrieval_results!).toHaveLength(0);
  });

  it("Empty Chunks Path: should return the refusal message", async () => {
    const emptyState = { ...mockState, retrieval_results: [] };
    const result = await synthesisAgentNode(emptyState);

    expect(result.final_answer).toBe("I don't have enough info in your connected sources.");
    expect(result.citations as any).toHaveLength(0);
  });

  it("Hallucination Prevention: should only extract valid doc IDs", async () => {
    vi.mocked(model.invoke).mockResolvedValue({
      content: "Fake [doc_999].",
    } as any);

    const result = await synthesisAgentNode(mockState);
    expect(result.citations as any).toHaveLength(0);
  });
});

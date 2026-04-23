import { describe, it, expect, vi, beforeEach } from "vitest";
import { synthesisAgentNode } from "../synthesis-agent";
import fs from "fs";
import { resolveModelClient } from "../../langgraph/llm-factory";

// Use vi.hoisted to define values that are needed inside vi.mock calls
const mocks = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGenerateContentStream: vi.fn(),
}));

// Mock external dependencies
vi.mock("fs");
vi.mock("../../langgraph/llm-factory");
vi.mock("../../supabase/server", () => ({
  supabaseAdmin: {},
}));

// Mock Raw SDKs
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mocks.mockCreate },
  })),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mocks.mockCreate } },
  })),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContentStream: mocks.mockGenerateContentStream,
    }),
  })),
}));

describe("Synthesis Agent Node (Raw SDK Mode)", () => {
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
    retrieved_chunks: mockChunks,
    messages: [
      { content: "What is the revenue?", _getType: () => "human" }
    ],
    org_id: "test-org-id",
    complexity: "medium",
    task_type: "retrieval",
    is_cross_dept_query: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as any).mockReturnValue("Mode: {{MODE}}\nContext: {{CONTEXT}}");
  });

  it("Standard Path: should generate a cited answer via Anthropic Raw SDK", async () => {
    // Mock Anthropic streaming response
    const mockStream = (async function* () {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "Revenue is $1M " } };
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "[doc_123]." } };
    })();

    (resolveModelClient as any).mockResolvedValue({
      provider: "anthropic",
      modelId: "claude-sonnet",
      apiKey: "sk-test",
      anthropic: { messages: { create: vi.fn().mockResolvedValue(mockStream) } }
    });

    const result = await synthesisAgentNode(mockState);

    expect(result.final_answer).toBe("Revenue is $1M [doc_123].");
    expect(result.cited_sources!).toHaveLength(1);
    expect((result.cited_sources as any)![0].document_id).toBe("doc_123");
    expect(result.retrieved_chunks!).toHaveLength(0);
  });

  it("OpenAI Path: should generate a cited answer via OpenAI Raw SDK", async () => {
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: "Revenue " } }] };
      yield { choices: [{ delta: { content: "$1M [doc_123]." } }] };
    })();

    (resolveModelClient as any).mockResolvedValue({
      provider: "openai",
      modelId: "gpt-4o",
      apiKey: "sk-test",
      openai: { chat: { completions: { create: vi.fn().mockResolvedValue(mockStream) } } }
    });

    const result = await synthesisAgentNode(mockState);

    expect(result.final_answer).toBe("Revenue $1M [doc_123].");
    expect(result.cited_sources as any).toHaveLength(1);
  });

  it("Empty Chunks Path: should return the refusal message", async () => {
    const emptyState = { ...mockState, retrieved_chunks: [] };
    const result = await synthesisAgentNode(emptyState);

    expect(result.final_answer).toBe("I don't have enough info in your connected sources.");
    expect(result.cited_sources as any).toHaveLength(0);
  });

  it("Hallucination Prevention: should only extract valid doc IDs", async () => {
    const mockStream = (async function* () {
       yield { type: "content_block_delta", delta: { type: "text_delta", text: "Fake [doc_999]." } };
    })();

    (resolveModelClient as any).mockResolvedValue({
      provider: "anthropic",
      modelId: "claude-sonnet",
      apiKey: "sk-test",
      anthropic: { messages: { create: vi.fn().mockResolvedValue(mockStream) } }
    });

    const result = await synthesisAgentNode(mockState);
    expect(result.cited_sources as any).toHaveLength(0);
  });
});

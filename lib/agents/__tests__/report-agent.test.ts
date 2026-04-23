import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportAgent } from "../report-agent";
import { HumanMessage } from "@langchain/core/messages";
import { model } from "../../langgraph/llm-factory";
import { vectorSearch } from "../../tools/vector-search";

// Mock the vector search
vi.mock("../../tools/vector-search", () => ({
  vectorSearch: vi.fn()
}));

// Mock the LLM factory
vi.mock("../../langgraph/llm-factory", () => ({
  model: {
    invoke: vi.fn()
  }
}));

describe("reportAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (vectorSearch as any).mockResolvedValue([
      { metadata: { text: "mocked chunk data", source: "doc1" } }
    ]);
  });

  it("generates a report with a 2-section plan dynamically", async () => {
    (model.invoke as any).mockImplementation(async (messages: any[]) => {
      const prompt = messages[0].content.toString();
      if (prompt.includes("Report Planning Prompt") || prompt.includes("Return a JSON array")) {
        return { content: '["Section A", "Section B"]' };
      }
      return { content: "Synthesized content with [citation]." };
    });

    const fakeState: any = {
      orgId: "org_123",
      userId: "user_456",
      role: "member",
      messages: [new HumanMessage("Summarize the recent updates (2 sections)")],
    };

    const result = await reportAgent(fakeState, {});

    expect(result.final_answer).toBeDefined();
    expect(result.final_answer).toContain("## Section A");
    expect(result.final_answer).toContain("## Section B");
    expect(result.final_answer).toContain("Synthesized content with [citation].");
    
    // Ensure they appear in the correct order
    const indexA = result.final_answer?.indexOf("## Section A") ?? -1;
    const indexB = result.final_answer?.indexOf("## Section B") ?? -1;
    expect(indexA).toBeLessThan(indexB);
    
    // Check that vectorSearch was called twice
    expect(vectorSearch).toHaveBeenCalledTimes(2);
  });

  it("generates a report with a 5-section plan dynamically", async () => {
    (model.invoke as any).mockImplementation(async (messages: any[]) => {
      const prompt = messages[0].content.toString();
      if (prompt.includes("Report Planning Prompt") || prompt.includes("Return a JSON array")) {
        return { content: '["Intro", "Metrics", "Events", "Risks", "Conclusion"]' };
      }
      return { content: "Synthesized content with [citation]." };
    });

    const fakeState: any = {
      orgId: "org_123",
      userId: "user_456",
      role: "member",
      messages: [new HumanMessage("Summarize the recent updates (5 sections)")],
    };

    const result = await reportAgent(fakeState, {});

    expect(result.final_answer).toBeDefined();
    expect(result.final_answer).toContain("## Intro");
    expect(result.final_answer).toContain("## Metrics");
    expect(result.final_answer).toContain("## Events");
    expect(result.final_answer).toContain("## Risks");
    expect(result.final_answer).toContain("## Conclusion");
    
    const indexIntro = result.final_answer?.indexOf("## Intro") ?? -1;
    const indexConclusion = result.final_answer?.indexOf("## Conclusion") ?? -1;
    expect(indexIntro).toBeLessThan(indexConclusion);
    
    // Check that vectorSearch was called 5 times
    expect(vectorSearch).toHaveBeenCalledTimes(5);
  });
});

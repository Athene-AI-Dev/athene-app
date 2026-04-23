import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.hoisted ensures mockInvoke is available inside the hoisted vi.mock factory
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    withStructuredOutput: vi.fn().mockReturnValue({ invoke: mockInvoke }),
  })),
}));

import { supervisor } from "../supervisor";
import type { AtheneStateType } from "../../state";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<AtheneStateType> = {}): AtheneStateType {
  return {
    messages: [{ role: "user", content: "test" }],
    orgId: "org-1",
    userId: "user-1",
    role: "member",
    next: "",
    hopCount: 0,
    reasoning: "",
    retrievedDocs: [],
    retrieved_chunks: [],
    final_answer: null,
    cited_sources: [],
    awaiting_approval: false,
    pending_write_action: null,
    run_status: null,
    ...overrides,
  } as unknown as AtheneStateType;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("supervisor", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("routes a general document query to retrieval", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "retrieval",
      reasoning: "User is looking for documents.",
    });

    const state = makeState({
      messages: [{ role: "user", content: "Find our Q3 OKR docs" }] as any,
    });
    const result = await supervisor(state);

    expect(result.next).toBe("retrieval");
    expect(result.hopCount).toBe(1);
    expect(result.reasoning).toContain("documents");
  });

  it("routes a cross-dept BI query to cross_dept for bi_analyst", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "cross_dept",
      reasoning: "Revenue trends require cross-department access.",
    });

    const state = makeState({
      role: "bi_analyst",
      messages: [{ role: "user", content: "Show revenue trends across all teams" }] as any,
    });
    const result = await supervisor(state);

    expect(result.next).toBe("cross_dept");
    expect(result.hopCount).toBe(1);
  });

  it("overrides cross_dept routing to retrieval when role is not bi_analyst (guard rail)", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "cross_dept",
      reasoning: "Attempting cross-dept access.",
    });

    const state = makeState({
      role: "member",
      messages: [{ role: "user", content: "Show revenue trends across all teams" }] as any,
    });
    const result = await supervisor(state);

    expect(result.next).toBe("retrieval");
    expect(result.reasoning).toMatch(/\[Guard\]/);
  });

  it("routes an email request to the email agent", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "email",
      reasoning: "User wants to draft an email.",
    });

    const state = makeState({
      messages: [{ role: "user", content: "Draft an email to the engineering team" }] as any,
    });
    const result = await supervisor(state);

    expect(result.next).toBe("email");
    expect(result.hopCount).toBe(1);
  });

  it("routes a scheduling request to the calendar agent", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "calendar",
      reasoning: "User wants to book a meeting.",
    });

    const state = makeState({
      messages: [{ role: "user", content: "Book a 1:1 with Sarah next Tuesday at 3pm" }] as any,
    });
    const result = await supervisor(state);

    expect(result.next).toBe("calendar");
    expect(result.hopCount).toBe(1);
  });

  it("routes a report request to the report agent", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "report",
      reasoning: "User wants a formatted report from retrieved data.",
    });

    const state = makeState({
      messages: [{ role: "user", content: "Generate a report from the data you found" }] as any,
      retrievedDocs: [{ id: "doc-1", content: "some data" }],
    });
    const result = await supervisor(state);

    expect(result.next).toBe("report");
    expect(result.hopCount).toBe(1);
  });

  it("terminates immediately when max hop limit is reached without calling the LLM", async () => {
    const state = makeState({ hopCount: 6 });
    const result = await supervisor(state);

    expect(result.next).toBe("END");
    expect(result.reasoning).toMatch(/Max hop/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("routes to synthesis when enough context is accumulated", async () => {
    mockInvoke.mockResolvedValue({
      next_agent: "synthesis",
      reasoning: "Enough documents retrieved to answer the question.",
    });

    const state = makeState({
      messages: [{ role: "user", content: "Summarize what you found" }] as any,
      retrievedDocs: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
    });
    const result = await supervisor(state);

    expect(result.next).toBe("synthesis");
    expect(result.hopCount).toBe(1);
  });

  it("increments hopCount on each invocation", async () => {
    mockInvoke.mockResolvedValue({ next_agent: "retrieval", reasoning: "searching" });

    const state = makeState({ hopCount: 3 });
    const result = await supervisor(state);

    expect(result.hopCount).toBe(4);
  });
});

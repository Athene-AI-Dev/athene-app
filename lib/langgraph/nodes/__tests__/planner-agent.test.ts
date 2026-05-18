// ============================================================
// lib/langgraph/nodes/__tests__/planner-agent.test.ts
//
// Covers: short-query passthrough, hop_count bypass,
// no cross-dept signal passthrough, LLM decomposition,
// JSON parse failure fallback, LLM error fallback.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock("../../llm-factory", () => ({
  resolveModelClient: vi.fn().mockResolvedValue({
    invoke: (...args: unknown[]) => mockInvoke(...args),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ─────────────────────────────────────

import { plannerAgent } from "../planner-agent";

// ─── Helpers ───────────────────────────────────────────────

function makeState(query: string, overrides: Record<string, unknown> = {}) {
  return {
    orgId: "org-1",
    userId: "user-1",
    role: "member",
    messages: [{ _getType: () => "human", content: query }],
    hop_count: 0,
    planning_steps: null,
    next_node: "",
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

const longCrossDeptQuery =
  "How do incidents in engineering affect customer churn and what is the relationship between revenue and legal compliance across departments?";

// ─── Tests ─────────────────────────────────────────────────

describe("plannerAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns planning_steps:null for short queries (< 15 words)", async () => {
    const result = await plannerAgent(makeState("What is our revenue?"), {});

    expect(result.planning_steps).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns planning_steps:null when hop_count > 0 (already in retrieval loop)", async () => {
    const result = await plannerAgent(
      makeState(longCrossDeptQuery, { hop_count: 1 }),
      {}
    );

    expect(result.planning_steps).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns planning_steps:null when long query has no cross-dept signals", async () => {
    const isolatedQuery =
      "List all the Jira tickets that were assigned to John Smith in the last quarter grouped by priority level status";
    const result = await plannerAgent(makeState(isolatedQuery), {});

    expect(result.planning_steps).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("calls LLM and returns planning_steps for cross-dept query", async () => {
    const steps = [
      { id: "s1", query: "engineering incidents", department: "engineering", depends_on: [] },
      { id: "s2", query: "customer churn after incidents", department: "customer_success", depends_on: ["s1"] },
    ];
    mockInvoke.mockResolvedValue({ content: JSON.stringify({ steps }) });

    const result = await plannerAgent(makeState(longCrossDeptQuery), {});

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(result.planning_steps).toEqual(steps);
  });

  it("strips markdown code fences from LLM JSON response", async () => {
    const steps = [
      { id: "s1", query: "revenue impact", department: "revops", depends_on: [] },
    ];
    mockInvoke.mockResolvedValue({
      content: "```json\n" + JSON.stringify({ steps }) + "\n```",
    });

    const result = await plannerAgent(makeState(longCrossDeptQuery), {});
    expect(result.planning_steps).toEqual(steps);
  });

  it("returns planning_steps:null and does not throw when LLM returns invalid JSON", async () => {
    mockInvoke.mockResolvedValue({ content: "Sorry, I cannot plan this." });

    const result = await plannerAgent(makeState(longCrossDeptQuery), {});
    expect(result.planning_steps).toBeNull();
  });

  it("returns planning_steps:null and does not throw when LLM call fails", async () => {
    mockInvoke.mockRejectedValue(new Error("LLM service unavailable"));

    const result = await plannerAgent(makeState(longCrossDeptQuery), {});
    expect(result.planning_steps).toBeNull();
  });

  it("uses the last human message for planning", async () => {
    const steps = [{ id: "s1", query: "second query", department: "cross", depends_on: [] }];
    mockInvoke.mockResolvedValue({ content: JSON.stringify({ steps }) });

    // Two human messages — planner should use the second one
    const state = makeState(longCrossDeptQuery);
    state.messages = [
      { _getType: () => "human", content: "First question that is short" },
      { _getType: () => "human", content: longCrossDeptQuery },
    ];

    const result = await plannerAgent(state, {});
    const userMessage = mockInvoke.mock.calls[0][0][1];
    expect(userMessage.content).toBe(longCrossDeptQuery);
    expect(result.planning_steps).toEqual(steps);
  });
});

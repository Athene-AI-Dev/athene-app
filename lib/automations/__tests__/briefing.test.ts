import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const { mockInsert, mockPublishJSON, mockReportAgent, mockFrom, mockGetNeighbors } = vi.hoisted(() => {
  const mockInsert = vi.fn(async () => ({ error: null }));
  const mockPublishJSON = vi.fn(async () => ({ messageId: "msg-123" }));
  const mockReportAgent = vi.fn(async () => ({ final_answer: "Mock briefing" }));
  const mockGetNeighbors = vi.fn(async () => ({ nodes: [], edges: [] }));

  const mockFrom = vi.fn((table: string) => {
    const chain = {
      insert: mockInsert,
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: any) => {
        // Default responses for each table
        if (table === "automations") {
          resolve({
            data: [{
              id: "auto-1",
              org_id: "org-1",
              user_id: "u1",
              org_members: { timezone: "UTC", briefing_delivery: "in_app" }
            }],
            error: null
          });
        } else if (table === "kg_nodes") {
          resolve({ data: [], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      }
    };
    return chain as any;
  });

  return { mockInsert, mockPublishJSON, mockReportAgent, mockFrom, mockGetNeighbors };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/supabase/rls-client", () => ({
  withRLS: vi.fn((_ctx, fn) => fn({ rpc: vi.fn() })),
}));

vi.mock("../langgraph/nodes/report-agent", () => ({
  reportAgent: mockReportAgent,
}));

vi.mock("../knowledge-graph/query", () => ({
  getNeighbors: mockGetNeighbors,
}));

vi.mock("@/lib/qstash/client", () => ({
  qstash: { publishJSON: mockPublishJSON },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { generateMorningBriefing } from "../morning-briefing";
import { scheduleMorningBriefings, getNextLocal7AmUtc } from "../schedule-briefings";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMorningBriefing - DoD Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportAgent.mockResolvedValue({ final_answer: "## Calendar\nEvent A\n## Emails\nEmail B" });
    mockInsert.mockResolvedValue({ error: null });
    mockGetNeighbors.mockResolvedValue({ nodes: [], edges: [] });
  });

  it("Scenario 1: Populated - shows Knowledge Highlights when recent nodes and edges exist", async () => {
    mockFrom.mockImplementationOnce((table: string) => ({
      select: () => ({ eq: () => ({ gt: () => ({ limit: () => ({
        then: (resolve: any) => {
          if (table === "kg_nodes") resolve({ data: [{ id: "n1", label: "Project Alpha" }], error: null });
          else resolve({ data: [], error: null });
        }
      }) }) }) })
    }) as any);

    const yesterday = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    mockGetNeighbors.mockResolvedValue({
      nodes: [{ id: "n2", label: "Module B" }],
      edges: [{ source_node: "n1", target_node: "n2", updated_at: yesterday }]
    });

    await generateMorningBriefing("u1", "org-1");
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({
        knowledge: expect.stringContaining("[Project Alpha](/graph?focus=n1)")
      })
    }));
  });

  it("Scenario 2: Empty - degrades silently when graph has no recent nodes", async () => {
    await generateMorningBriefing("u1", "org-1");
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.content.knowledge).toBeUndefined();
  });

  it("Scenario 3: Boundary - skips highlights when nodes are updated but no NEW edges exist", async () => {
    mockFrom.mockImplementationOnce((table: string) => ({
      select: () => ({ eq: () => ({ gt: () => ({ limit: () => ({
        then: (resolve: any) => {
          if (table === "kg_nodes") resolve({ data: [{ id: "n1", label: "Old Project" }], error: null });
          else resolve({ data: [], error: null });
        }
      }) }) }) })
    }) as any);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    mockGetNeighbors.mockResolvedValue({
      nodes: [{ id: "n2", label: "Old Module" }],
      edges: [{ source_node: "n1", target_node: "n2", updated_at: threeDaysAgo }]
    });

    await generateMorningBriefing("u1", "org-1");
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.content.knowledge).toBeUndefined();
  });
});

describe("scheduleMorningBriefings", () => {
  it("happy path: schedules one QStash job per active automation", async () => {
    const result = await scheduleMorningBriefings();
    expect(result.success).toBe(true);
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
  });
});

describe("getNextLocal7AmUtc", () => {
  it("returns today's 7 AM when called before 7 AM local (Asia/Kolkata)", () => {
    const now = new Date("2026-05-05T01:29:00Z");
    const result = getNextLocal7AmUtc("Asia/Kolkata", now);
    expect(result.getUTCHours()).toBe(1);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it("advances to next day when called after 7 AM local (America/New_York)", () => {
    const now = new Date("2026-05-05T12:00:00Z");
    const result = getNextLocal7AmUtc("America/New_York", now);
    expect(result.getUTCDate()).toBe(6);
    expect(result.getUTCHours()).toBe(11);
  });
});
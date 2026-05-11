import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const { mockInsert, mockPublishJSON, mockReportAgent, mockFrom, mockGetNeighbors, mockMaybeSingle } = vi.hoisted(() => {
  return {
    mockInsert: vi.fn(),
    mockPublishJSON: vi.fn(),
    mockReportAgent: vi.fn(),
    mockFrom: vi.fn(),
    mockGetNeighbors: vi.fn(),
    mockMaybeSingle: vi.fn(),
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/supabase/rls-client", () => ({
  withRLS: vi.fn((_ctx, fn) => fn({ rpc: vi.fn() })),
}));

vi.mock("@/lib/langgraph/nodes/report-agent", () => ({
  reportAgent: mockReportAgent,
}));

vi.mock("@/lib/knowledge-graph/query", () => ({
  getNeighbors: mockGetNeighbors,
}));

vi.mock("@/lib/qstash/client", () => ({
  qstash: { publishJSON: mockPublishJSON },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { generateMorningBriefing } from "../morning-briefing";
import { scheduleMorningBriefings, getNextLocal7AmUtc } from "../schedule-briefings";

// ── Test Helpers ──────────────────────────────────────────────────────────────

function buildChain(data: any, error: any = null) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gt: () => chain,
    limit: () => chain,
    order: () => chain,
    maybeSingle: mockMaybeSingle,
    insert: mockInsert,
    then: (resolve: any) => resolve({ data, error }),
  };
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Briefing System Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Default implementations
    mockReportAgent.mockResolvedValue({ final_answer: "## Calendar\n- Event A\n## Emails\n- Email B" });
    mockInsert.mockResolvedValue({ error: null });
    mockGetNeighbors.mockResolvedValue({ nodes: [], edges: [] });
    mockPublishJSON.mockResolvedValue({ messageId: "msg-1" });
    mockMaybeSingle.mockResolvedValue({ data: { role: "member" }, error: null });

    mockFrom.mockImplementation((table: string) => {
      const defaultData: Record<string, any[]> = {
        automations: [{
          id: "auto-1",
          org_id: "org-1",
          user_id: "u1",
          org_members: { timezone: "UTC", briefing_delivery: "in_app" }
        }],
        org_members: [{ role: "member" }],
        kg_nodes: [],
        briefings: [],
      };
      return buildChain(defaultData[table] ?? []);
    });
  });

  describe("generateMorningBriefing", () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-05T08:00:00Z"));
    });

    afterAll(() => vi.useRealTimers());

    it("Scenario 1: Populated - shows Knowledge Highlights when recent nodes and edges exist", async () => {
      const sixHoursAgo = new Date("2026-05-05T02:00:00Z").toISOString();
      
      mockFrom.mockImplementation((table: string) => {
        if (table === "kg_nodes") {
           return buildChain([{ id: "n1", label: "Project Alpha" }]);
        }
        if (table === "org_members") {
           return buildChain([{ role: "member" }]);
        }
        return buildChain([]);
      });

      mockGetNeighbors.mockResolvedValue({
        nodes: [{ id: "n2", label: "Module B" }],
        edges: [{ source_node: "n1", target_node: "n2", updated_at: sixHoursAgo }]
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
      mockFrom.mockImplementation((table: string) => {
        if (table === "kg_nodes") return buildChain([{ id: "n1", label: "Old Project" }]);
        return buildChain([]);
      });

      const threeDaysAgo = new Date("2026-05-02T08:00:00Z").toISOString();
      mockGetNeighbors.mockResolvedValue({
        nodes: [{ id: "n2", label: "Old Module" }],
        edges: [{ source_node: "n1", target_node: "n2", updated_at: threeDaysAgo }]
      });

      await generateMorningBriefing("u1", "org-1");
      const payload = mockInsert.mock.calls[0][0];
      expect(payload.content.knowledge).toBeUndefined();
    });

    it("surfaces error when insert fails", async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: "DB write failed" } });
      const result = await generateMorningBriefing("u1", "org-1");
      expect(result.success).toBe(false);
    });

    it("handles reportAgent rejection", async () => {
      mockReportAgent.mockRejectedValueOnce(new Error("LLM timeout"));
      const result = await generateMorningBriefing("u1", "org-1");
      expect(result.success).toBe(false);
    });

    it("surfaces knowledgeError when getNeighbors throws", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "kg_nodes") return buildChain([{ id: "n1", label: "Node 1" }]);
        return buildChain([]);
      });
      mockGetNeighbors.mockRejectedValue(new Error("Graph DB down"));
      
      await generateMorningBriefing("u1", "org-1");
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.objectContaining({
          knowledgeError: "Knowledge highlights temporarily unavailable."
        })
      }));
    });
  });

  describe("scheduleMorningBriefings", () => {
    it("happy path: schedules one QStash job per active automation", async () => {
      mockFrom.mockImplementation((table: string) => {
        const data: Record<string, any[]> = {
          automations: [{
            id: "auto-1",
            org_id: "org-1",
            user_id: "u1",
            org_members: [{ timezone: "UTC", briefing_delivery: "in_app" }]
          }],
        };
        return buildChain(data[table] ?? []);
      });

      const result = await scheduleMorningBriefings();
      expect(result.success).toBe(true);
      expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    });
  });

  describe("getNextLocal7AmUtc", () => {
    it("returns today's 7 AM when called before 7 AM local (Asia/Kolkata)", () => {
      const now = new Date("2026-05-05T00:00:00Z");
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

    it("handles the 7 AM cutoff boundary correctly (Asia/Kolkata)", () => {
      const atCutoff = new Date("2026-05-05T01:30:00Z");
      const next = getNextLocal7AmUtc("Asia/Kolkata", atCutoff);
      expect(next.getUTCDate()).toBe(6);
    });

    it("handles EST (winter, UTC-5) correctly", () => {
      const now = new Date("2026-01-05T13:00:00Z");
      const result = getNextLocal7AmUtc("America/New_York", now);
      expect(result.getUTCDate()).toBe(6);
      expect(result.getUTCHours()).toBe(12);
    });
  });
});
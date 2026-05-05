import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────
const { mockInsert, mockPublishJSON, mockReportAgent, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn(async () => ({ error: null }));
  const mockPublishJSON = vi.fn(async () => ({ messageId: "msg-123" }));
  const mockReportAgent = vi.fn(async () => ({ final_answer: "Mock briefing" }));

  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: [
            {
              id: "auto-1",
              org_id: "org-1",
              user_id: "u1",
              org_members: { timezone: "Asia/Kolkata", briefing_delivery: "in_app" },
            },
            {
              id: "auto-2",
              org_id: "org-1",
              user_id: "u2",
              org_members: { timezone: "America/New_York", briefing_delivery: "in_app" },
            },
            {
              id: "auto-3",
              org_id: "org-1",
              user_id: "u3",
              org_members: { timezone: null, briefing_delivery: null },
            },
          ],
          error: null,
        })),
      })),
    })),
  }));

  return { mockInsert, mockPublishJSON, mockReportAgent, mockFrom };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/agents/report-agent", () => ({
  reportAgent: mockReportAgent,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/qstash/client", () => ({
  qstash: { publishJSON: mockPublishJSON },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { generateMorningBriefing } from "../morning-briefings";
import { scheduleMorningBriefings, getNextLocal7AmUtc } from "../schedule-briefings";

// ── Reset helpers ─────────────────────────────────────────────────────────────

function resetHappyPath() {
  mockReportAgent.mockResolvedValue({ final_answer: "Mock briefing" });
  mockInsert.mockResolvedValue({ error: null });
  mockPublishJSON.mockResolvedValue({ messageId: "msg-123" });
  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: [
            {
              id: "auto-1",
              org_id: "org-1",
              user_id: "u1",
              org_members: { timezone: "Asia/Kolkata", briefing_delivery: "in_app" },
            },
            {
              id: "auto-2",
              org_id: "org-1",
              user_id: "u2",
              org_members: { timezone: "America/New_York", briefing_delivery: "in_app" },
            },
            {
              id: "auto-3",
              org_id: "org-1",
              user_id: "u3",
              org_members: { timezone: null, briefing_delivery: null },
            },
          ],
          error: null,
        })),
      })),
    })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetHappyPath();
});

// ── generateMorningBriefing ───────────────────────────────────────────────────

describe("generateMorningBriefing", () => {
  it("happy path: returns success with correct shape", async () => {
    const result = await generateMorningBriefing("u1", "org-1", "auto-1");
    expect(result.success).toBe(true);
    expect(result.userId).toBe("u1");
    expect(result.briefing).toBe("Mock briefing");
  });

  it("inserts into briefings table with org_id, user_id, automation_id, delivery_method and jsonb content", async () => {
    await generateMorningBriefing("u1", "org-1", "auto-1", "email");
    expect(mockInsert).toHaveBeenCalledOnce();
    const payload = mockInsert.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: "u1",
      org_id: "org-1",
      automation_id: "auto-1",
      content: { text: "Mock briefing" },
      delivery_method: "email",
    });
    // created_at must NOT be set manually — DB defaults to now()
    expect(payload).not.toHaveProperty("created_at");
  });

  it("passes the caller orgId to reportAgent — not hardcoded 'default'", async () => {
    await generateMorningBriefing("u1", "myRealOrg");
    expect(mockReportAgent).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "myRealOrg", userId: "u1" }),
      expect.anything()
    );
  });

  it("uses fallback text when reportAgent returns no final_answer", async () => {
    mockReportAgent.mockResolvedValueOnce({});
    const result = await generateMorningBriefing("u2", "org-1");
    expect(result.success).toBe(true);
    expect(result.briefing).toBe("No briefing generated.");
    const payload = mockInsert.mock.calls[0][0];
    expect(payload.content).toEqual({ text: "No briefing generated." });
  });

  it("returns failure when DB insert returns an error", async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error("DB error") });
    const result = await generateMorningBriefing("u3", "org-1");
    expect(result.success).toBe(false);
    expect(result.briefing).toBeNull();
  });

  it("returns failure when reportAgent throws", async () => {
    mockReportAgent.mockRejectedValueOnce(new Error("Agent failure"));
    const result = await generateMorningBriefing("u4", "org-1");
    expect(result.success).toBe(false);
    expect(result.briefing).toBeNull();
  });
});

// ── scheduleMorningBriefings ──────────────────────────────────────────────────

describe("scheduleMorningBriefings", () => {
  it("happy path: schedules one QStash job per active automation", async () => {
    const result = await scheduleMorningBriefings();
    expect(result.success).toBe(true);
    expect(result.scheduledCount).toBe(3);
    expect(mockPublishJSON).toHaveBeenCalledTimes(3);
  });

  it("QStash body includes userId, orgId, automationId, deliveryMethod", async () => {
    await scheduleMorningBriefings();
    const body = mockPublishJSON.mock.calls[0][0].body;
    expect(body).toMatchObject({
      userId: "u1",
      orgId: "org-1",
      automationId: "auto-1",
      deliveryMethod: "in_app",
    });
  });

  it("passes delay as a number — not a string template", async () => {
    await scheduleMorningBriefings();
    const call = mockPublishJSON.mock.calls[0][0];
    expect(typeof call.delay).toBe("number");
  });

  it("uses the correct /api/worker/morning-briefing endpoint", async () => {
    await scheduleMorningBriefings();
    const call = mockPublishJSON.mock.calls[0][0];
    expect(call.url).toContain("/api/worker/morning-briefing");
    expect(call.url).not.toContain("/api/automations/morning-briefing");
  });

  it("falls back to UTC when org_members.timezone is null", async () => {
    const now = new Date("2026-05-05T00:00:00Z"); // midnight UTC = before 7am UTC
    const result = await scheduleMorningBriefings(now);
    expect(result.success).toBe(true);
    // All 3 jobs should still be scheduled
    expect(mockPublishJSON).toHaveBeenCalledTimes(3);
    // The user with null timezone (u3) should get UTC 7am
    const u3Call = mockPublishJSON.mock.calls[2][0];
    expect(u3Call.body.timezone).toBe("UTC");
  });

  it("returns failure when the DB query errors", async () => {
    mockFrom.mockReturnValueOnce({
      insert: mockInsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: null,
            error: new Error("DB down"),
          })),
        })),
      })),
    });
    const result = await scheduleMorningBriefings();
    expect(result.success).toBe(false);
    expect(result.scheduledCount).toBe(0);
  });
});

// ── getNextLocal7AmUtc — timezone edge cases ──────────────────────────────────

describe("getNextLocal7AmUtc", () => {
  it("returns today's 7 AM when called before 7 AM local (Asia/Kolkata)", () => {
    // 06:59 IST = 01:29 UTC — next 7 AM IST is still today
    const now = new Date("2026-05-05T01:29:00Z");
    const result = getNextLocal7AmUtc("Asia/Kolkata", now);
    // 7:00 AM IST = 01:30 UTC
    expect(result.getUTCHours()).toBe(1);
    expect(result.getUTCMinutes()).toBe(30);
  });

  it("returns TODAY at 7 AM when called exactly at 7:00:00 (off-by-one fix: < not <=)", () => {
    // Exactly 7:00:00 AM UTC — strict < means this is NOT past 7am, stay today
    const now = new Date("2026-05-05T07:00:00Z");
    const result = getNextLocal7AmUtc("UTC", now);
    expect(result.toISOString()).toBe("2026-05-05T07:00:00.000Z");
  });

  it("advances to next day when called after 7 AM local (America/New_York)", () => {
    // 08:00 AM EDT = 12:00 UTC — past 7 AM, must go to next day
    const now = new Date("2026-05-05T12:00:00Z");
    const result = getNextLocal7AmUtc("America/New_York", now);
    // 7 AM EDT (UTC-4) on May 6 = 11:00 UTC
    expect(result.getUTCDate()).toBe(6);
    expect(result.getUTCHours()).toBe(11);
  });
});
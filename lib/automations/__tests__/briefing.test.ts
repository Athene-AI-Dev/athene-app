import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/agents/report-agent", () => ({
  reportAgent: vi.fn(async () => ({
    final_answer: "Mock briefing",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: [{ id: "u1" }, { id: "u2" }],
          error: null,
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/qstash/client", () => ({
  qstash: {
    publishJSON: vi.fn(async () => ({
      messageId: "123",
    })),
  },
}));

import { generateMorningBriefing } from "../morning-briefings";
import { scheduleMorningBriefings } from "../schedule-briefings";

describe("briefing automation", () => {
  it("generates briefing", async () => {
    const result = await generateMorningBriefing("user1");
    expect(result.success).toBe(true);
  });

  it("schedules briefings", async () => {
    const result = await scheduleMorningBriefings();
    expect(result.success).toBe(true);
  });
});
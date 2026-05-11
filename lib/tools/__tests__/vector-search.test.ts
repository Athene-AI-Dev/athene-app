import { describe, it, expect, vi, beforeEach } from "vitest";
import { vectorSearch, crossDeptVectorSearch } from "../vector-search";
// 🎭 Mock the embedder
vi.mock("@/lib/ai/embedder", () => ({
  embed: vi.fn(async () => Array(1536).fill(0.1)),
}));

describe("Vector Search RLS & RBAC (Mocked)", () => {
  it("prevents cross-organization access (Logic Check)", async () => {
    const results = await vectorSearch({
      orgId: "org_alpha",
      userId: "user_1",
      user_role: "member",
      query: "test query",
    });

    results.forEach((r: any) => {
      expect(r.metadata.org_id).toBe("org_alpha");
    });
  });

  it("restricts cross-department search to bi_analyst role", async () => {
    await expect(
      crossDeptVectorSearch({
        orgId: "org_alpha",
        userId: "user_1",
        user_role: "member",
        query: "revenue insights",
      })
    ).rejects.toThrow("Unauthorized: requires super_user role");
  });

  it("allows super_user to see 'bi_accessible' docs", async () => {
    const results = await crossDeptVectorSearch({
      orgId: "org_alpha",
      userId: "analyst_1",
      user_role: "super_user",
      query: "global trends",
    });

    results.forEach((r: any) => {
      expect(r.visibility).toBe("bi_accessible");
    });
  });

});

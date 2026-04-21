import { describe, it, expect, vi } from "vitest";
import { vectorSearch, crossDeptVectorSearch } from "../vector-search";

// 🎭 Mocking the database and embedder
vi.mock("@/lib/ai/embedder", () => ({
  embed: vi.fn(async () => Array(1536).fill(0.1)),
}));

vi.mock("../../db/pool", () => ({
  pool: {
    connect: vi.fn(() => ({
      query: vi.fn(async (sql) => {
        // Handle standard search
        if (sql.includes("SELECT") && !sql.includes("bi_accessible")) {
          return {
            rows: [
              {
                chunk_id: "chk_std_1",
                document_id: "doc_std_1",
                content_preview: "Standard results...",
                metadata: { category: "general" },
                score: 0.9,
              },
            ],
          };
        }
        // Handle cross-dept search
        if (sql.includes("bi_accessible")) {
          return {
            rows: [
              {
                chunk_id: "chk_bi_1",
                document_id: "doc_bi_1",
                content_preview: "Confidential BI data...",
                metadata: { category: "revenue" },
                score: 0.99,
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    })),
  },
}));

describe("Vector Search Access Control", () => {
  it("returns full structure for standard searches", async () => {
    const results = await vectorSearch({
      orgId: "org1",
      userId: "user1",
      role: "member",
      query: "pricing strategy",
    });

    const first = results[0];
    expect(first).toHaveProperty("chunk_id");
    expect(first).toHaveProperty("document_id");
    expect(first).toHaveProperty("content_preview");
    expect(first).toHaveProperty("metadata");
    expect(first).toHaveProperty("score");

    // ❌ SECURITY CHECK: Ensure full content is NOT leaked
    expect(first.content).toBeUndefined();
    console.log("Leak check passed: 'content' field is absent.");
  });

  it("restricts cross-department search to bi_analyst role", async () => {
    // ✅ Expected: Should throw error for "member" role
    await expect(
      crossDeptVectorSearch({
        orgId: "org1",
        userId: "user1",
        role: "member",
        query: "revenue",
      })
    ).rejects.toThrow("Unauthorized: requires bi_analyst role");
  });

  it("allows bi_analyst to retrieve cross-department data", async () => {
    // ✅ Expected: Should return results for "bi_analyst" role
    const results = await crossDeptVectorSearch({
      orgId: "org1",
      userId: "analyst1",
      role: "bi_analyst",
      query: "market revenue",
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    // Verified that it uses the visibility=bi_accessible filter in the query via mocks
    expect(results[0].chunk_id).toBe("chk_bi_1");
  });
});

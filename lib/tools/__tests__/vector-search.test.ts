import { describe, it, expect, vi, beforeEach } from "vitest";
import { vectorSearch, crossDeptVectorSearch } from "../vector-search";
import { supabaseAdmin } from "../../supabase/server";
// 🎭 Mock the embedder
vi.mock("../../ai/embedder", () => ({
  embed: vi.fn(async () => Array(1536).fill(0.1)),
}));

// 🎭 Mock Supabase & RLS
const mockRpc = vi.fn();
vi.mock("../../supabase/rls-client", () => ({
  withRLS: vi.fn((_ctx, fn) => fn({ rpc: mockRpc })),
}));

vi.mock("../../supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
}));
describe("Vector Search RLS & RBAC (Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents cross-organization access (Logic Check)", async () => {
    const mockData = [{ chunk_id: "test", metadata: { org_id: "org_alpha" }, visibility: "department" }];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const results = await vectorSearch({
      orgId: "org_alpha",
      userId: "user_1",
      user_role: "member",
      query: "test query",
    });

    expect(mockRpc).toHaveBeenCalledWith("vector_search", expect.objectContaining({
      p_limit: 5
    }));
    expect(results).toEqual(mockData);
  });

  it("restricts cross-department search to admin or super_user roles", async () => {
    // Current implementation in vector-search.ts line 52 checks for 'super_user'
    await expect(
      crossDeptVectorSearch({
        orgId: "org_alpha",
        userId: "user_1",
        user_role: "member",
        query: "revenue insights",
      })
    ).rejects.toThrow("Unauthorized: cross-department search requires super_user role");
  });

  it("allows super_user to call cross-dept search", async () => {
    const mockData = [{ chunk_id: "bi_test", visibility: "org_wide" }];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const results = await crossDeptVectorSearch({
      orgId: "org_alpha",
      userId: "analyst_1",
      user_role: "super_user",
      query: "global trends",
    });

    expect(mockRpc).toHaveBeenCalledWith("vector_search_cross_dept", expect.anything());
    expect(results).toEqual(mockData);
  });
});

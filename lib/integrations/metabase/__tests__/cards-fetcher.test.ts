// ============================================================
// lib/integrations/metabase/__tests__/cards-fetcher.test.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMetabaseFetch = vi.fn();
const mockGetProviderMetadata = vi.fn();

vi.mock("../client", () => ({
  metabaseFetch: (...args: unknown[]) => mockMetabaseFetch(...args),
}));

vi.mock("../base", () => ({
  getProviderMetadata: (...args: unknown[]) => mockGetProviderMetadata(...args),
}));

vi.mock("../../base", () => ({
  getProviderMetadata: (...args: unknown[]) => mockGetProviderMetadata(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { fetchMetabaseContent } from "../cards-fetcher";

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: "Monthly Revenue",
    description: "Revenue by month",
    display: "line",
    database_id: 1,
    ...overrides,
  };
}

describe("fetchMetabaseContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProviderMetadata.mockResolvedValue({ instance_url: "https://metabase.acme.com" });
  });

  it("returns empty array when cards and dashboards are empty", async () => {
    mockMetabaseFetch.mockResolvedValue([]);
    const result = await fetchMetabaseContent("conn-1", "org-1");
    expect(result).toEqual([]);
  });

  it("creates a chunk for a card with query results", async () => {
    const queryRes = {
      data: {
        rows: [["2026-05", 100000], ["2026-04", 95000]],
        cols: [{ name: "month" }, { name: "revenue" }],
      },
    };

    mockMetabaseFetch
      .mockResolvedValueOnce([makeCard()])  // GET /card
      .mockResolvedValueOnce(queryRes)      // POST /card/10/query
      .mockResolvedValueOnce([]);           // GET /dashboard

    const result = await fetchMetabaseContent("conn-1", "org-1");

    const cardChunk = result.find((c) => c.chunk_id === "metabase_card_10");
    expect(cardChunk).toBeDefined();
    expect(cardChunk?.title).toBe("Metabase: Monthly Revenue");
    expect(cardChunk?.content).toContain("Revenue by month");
    expect(cardChunk?.content).toContain("month: 2026-05");
    expect(cardChunk?.content).toContain("revenue: 100000");
    expect(cardChunk?.source_url).toBe("https://metabase.acme.com/question/10");
    expect(cardChunk?.metadata?.provider).toBe("metabase");
    expect(cardChunk?.metadata?.resource_type).toBe("question");
    expect(cardChunk?.metadata?.display_type).toBe("line");
  });

  it("falls back to description when card query fails", async () => {
    mockMetabaseFetch
      .mockResolvedValueOnce([makeCard()])
      .mockRejectedValueOnce(new Error("Query requires parameters"))
      .mockResolvedValueOnce([]);

    const result = await fetchMetabaseContent("conn-1", "org-1");

    const cardChunk = result.find((c) => c.chunk_id === "metabase_card_10");
    expect(cardChunk?.content).toContain("Revenue by month");
  });

  it("uses card name as content when description and query data are both missing", async () => {
    mockMetabaseFetch
      .mockResolvedValueOnce([makeCard({ description: null })])
      .mockRejectedValueOnce(new Error("No query"))
      .mockResolvedValueOnce([]);

    const result = await fetchMetabaseContent("conn-1", "org-1");

    const cardChunk = result.find((c) => c.chunk_id === "metabase_card_10");
    expect(cardChunk?.content).toBe("Monthly Revenue");
  });

  it("creates chunks for dashboards", async () => {
    const dashboards = [{ id: 5, name: "Executive Dashboard", description: "KPI overview" }];

    mockMetabaseFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(dashboards);

    const result = await fetchMetabaseContent("conn-1", "org-1");

    const dashChunk = result.find((c) => c.chunk_id === "metabase_dashboard_5");
    expect(dashChunk?.title).toBe("Metabase Dashboard: Executive Dashboard");
    expect(dashChunk?.content).toBe("KPI overview");
    expect(dashChunk?.metadata?.resource_type).toBe("dashboard");
  });

  it("continues fetching dashboards when cards endpoint fails", async () => {
    const dashboards = [{ id: 6, name: "Revenue Dash", description: null }];

    mockMetabaseFetch
      .mockRejectedValueOnce(new Error("Cards API down"))
      .mockResolvedValueOnce(dashboards);

    const result = await fetchMetabaseContent("conn-1", "org-1");

    expect(result.some((c) => c.chunk_id === "metabase_dashboard_6")).toBe(true);
  });

  it("builds correct source URL from instance_url metadata", async () => {
    // Instance URL with trailing slash should be trimmed
    mockGetProviderMetadata.mockResolvedValue({ instance_url: "https://metabase.acme.com/" });

    mockMetabaseFetch
      .mockResolvedValueOnce([makeCard()])
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce([]);

    const result = await fetchMetabaseContent("conn-1", "org-1");

    const cardChunk = result.find((c) => c.chunk_id === "metabase_card_10");
    expect(cardChunk?.source_url).toBe("https://metabase.acme.com/question/10");
  });
});

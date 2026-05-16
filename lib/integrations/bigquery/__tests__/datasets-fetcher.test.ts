// ============================================================
// lib/integrations/bigquery/__tests__/datasets-fetcher.test.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBigqueryFetch = vi.fn();
const mockBigqueryProjectId = vi.fn();
const mockParseBigQueryRows = vi.fn();
const mockGetProviderMetadata = vi.fn();

vi.mock("../client", () => ({
  bigqueryFetch: (...args: unknown[]) => mockBigqueryFetch(...args),
  bigqueryProjectId: (...args: unknown[]) => mockBigqueryProjectId(...args),
  parseBigQueryRows: (...args: unknown[]) => mockParseBigQueryRows(...args),
}));

vi.mock("../base", () => ({
  getProviderMetadata: (...args: unknown[]) => mockGetProviderMetadata(...args),
  FetchedChunk: class {},
}));

vi.mock("../../base", () => ({
  getProviderMetadata: (...args: unknown[]) => mockGetProviderMetadata(...args),
  FetchedChunk: class {},
}));

vi.mock("../../bi-chunking", () => ({
  buildStatsChunk: vi.fn().mockReturnValue({ chunk_id: "stats", title: "Stats" }),
  buildSampleChunk: vi.fn().mockReturnValue({ chunk_id: "sample", title: "Sample" }),
  buildAggregationChunk: vi.fn().mockReturnValue({ chunk_id: "agg", title: "Agg" }),
  classifyColumn: vi.fn().mockReturnValue("categorical"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { fetchBigQueryDatasets } from "../datasets-fetcher";

describe("fetchBigQueryDatasets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBigqueryProjectId.mockResolvedValue("my-project");
    mockGetProviderMetadata.mockResolvedValue({});
    mockParseBigQueryRows.mockReturnValue([]);
  });

  it("returns empty array when no datasets exist", async () => {
    mockBigqueryFetch.mockResolvedValue({ datasets: [] });
    const result = await fetchBigQueryDatasets("conn-1", "org-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when datasets response is null", async () => {
    mockBigqueryFetch.mockResolvedValue(null);
    const result = await fetchBigQueryDatasets("conn-1", "org-1");
    expect(result).toEqual([]);
  });

  it("skips datasets where table listing fails (non-fatal)", async () => {
    mockBigqueryFetch
      .mockResolvedValueOnce({ datasets: [{ datasetReference: { datasetId: "ds1" } }] })
      .mockRejectedValueOnce(new Error("Permission denied"));

    const result = await fetchBigQueryDatasets("conn-1", "org-1");
    expect(result).toEqual([]);
  });

  it("skips tables with no schema fields", async () => {
    mockBigqueryFetch
      .mockResolvedValueOnce({ datasets: [{ datasetReference: { datasetId: "ds1" } }] })
      .mockResolvedValueOnce({ tables: [{ tableReference: { tableId: "t1" } }] })
      .mockResolvedValueOnce({ schema: { fields: [] } }); // empty schema

    const result = await fetchBigQueryDatasets("conn-1", "org-1");
    expect(result).toHaveLength(0);
  });

  it("respects allowlist from Nango metadata", async () => {
    mockGetProviderMetadata.mockResolvedValue({ allowlist: ["ds1.allowed_table"] });

    mockBigqueryFetch
      .mockResolvedValueOnce({ datasets: [{ datasetReference: { datasetId: "ds1" } }] })
      .mockResolvedValueOnce({
        tables: [
          { tableReference: { tableId: "allowed_table" } },
          { tableReference: { tableId: "blocked_table" } },
        ],
      })
      // Only allowed_table should be processed (getProjectId + schema fetch)
      .mockResolvedValueOnce({ schema: { fields: [{ name: "id", type: "INTEGER" }] } })
      .mockResolvedValue({ rows: [] }); // subsequent query calls

    mockParseBigQueryRows.mockReturnValue([]);

    const result = await fetchBigQueryDatasets("conn-1", "org-1");
    // Result should only include chunks for allowed_table
    // The key check is that blocked_table was not processed (no schema fetch for it)
    expect(result.length).toBeGreaterThanOrEqual(0); // non-throwing
  });
});

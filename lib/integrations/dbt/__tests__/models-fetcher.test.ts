// ============================================================
// lib/integrations/dbt/__tests__/models-fetcher.test.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbtFetch = vi.fn();

vi.mock("../client", () => ({
  dbtFetch: (...args: unknown[]) => mockDbtFetch(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { fetchDbtContent } from "../models-fetcher";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: "Daily Transform",
    description: "Transforms raw data into analytics tables",
    project_id: 42,
    environment_id: 7,
    ...overrides,
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 201,
    job_id: 101,
    status: "Success",
    created_at: "2026-05-01T00:00:00Z",
    finished_at: "2026-05-01T00:15:00Z",
    run_duration_humanized: "15 minutes",
    job_definition: { name: "Daily Transform" },
    ...overrides,
  };
}

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    unique_id: "model.acme.orders",
    name: "orders",
    description: "All customer orders",
    package_name: "acme",
    schema: "analytics",
    alias: null,
    tags: ["finance", "core"],
    depends_on: { nodes: ["model.acme.customers"] },
    meta: {},
    ...overrides,
  };
}

describe("fetchDbtContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when all endpoints return empty data", async () => {
    mockDbtFetch.mockResolvedValue({ data: [] });
    const result = await fetchDbtContent("conn-1", "org-1");
    expect(result).toEqual([]);
  });

  it("transforms a job into a FetchedChunk", async () => {
    mockDbtFetch
      .mockResolvedValueOnce({ data: [makeJob()] }) // jobs
      .mockResolvedValueOnce({ data: [] })           // runs
      .mockResolvedValueOnce({ data: [] });           // models

    const result = await fetchDbtContent("conn-1", "org-1");

    const jobChunk = result.find((c) => c.chunk_id === "dbt_job_101");
    expect(jobChunk).toBeDefined();
    expect(jobChunk?.title).toBe("dbt Job: Daily Transform");
    expect(jobChunk?.metadata?.provider).toBe("dbt");
    expect(jobChunk?.metadata?.resource_type).toBe("job");
  });

  it("transforms a run into a FetchedChunk with status and duration", async () => {
    mockDbtFetch
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [makeRun()] })
      .mockResolvedValueOnce({ data: [] });

    const result = await fetchDbtContent("conn-1", "org-1");

    const runChunk = result.find((c) => c.chunk_id === "dbt_run_201");
    expect(runChunk).toBeDefined();
    expect(runChunk?.title).toBe("dbt Run #201 — Success");
    expect(runChunk?.content).toContain("Status: Success");
    expect(runChunk?.content).toContain("15 minutes");
    expect(runChunk?.metadata?.status).toBe("Success");
  });

  it("transforms a model into a FetchedChunk with tags and dependencies", async () => {
    mockDbtFetch
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [makeModel()] });

    const result = await fetchDbtContent("conn-1", "org-1");

    const modelChunk = result.find((c) => c.chunk_id?.includes("model.acme.orders"));
    expect(modelChunk).toBeDefined();
    expect(modelChunk?.title).toBe("dbt Model: orders");
    expect(modelChunk?.content).toContain("Tags: finance, core");
    expect(modelChunk?.content).toContain("Depends on: model.acme.customers");
    expect(modelChunk?.content).toContain("Schema: analytics");
  });

  it("continues fetching runs and models when jobs endpoint fails (fault tolerance)", async () => {
    mockDbtFetch
      .mockRejectedValueOnce(new Error("Jobs API down"))
      .mockResolvedValueOnce({ data: [makeRun()] })
      .mockResolvedValueOnce({ data: [] });

    const result = await fetchDbtContent("conn-1", "org-1");

    expect(result.some((c) => c.chunk_id === "dbt_run_201")).toBe(true);
  });

  it("handles run with no job_definition gracefully", async () => {
    const run = makeRun({ job_definition: undefined });
    mockDbtFetch
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [run] })
      .mockResolvedValueOnce({ data: [] });

    const result = await fetchDbtContent("conn-1", "org-1");
    const runChunk = result.find((c) => c.chunk_id === "dbt_run_201");
    expect(runChunk?.content).toContain("101"); // falls back to job_id
  });
});

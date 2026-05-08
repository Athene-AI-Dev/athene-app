import { describe, it, expect, vi } from "vitest";

// Mock modules that trigger Supabase client instantiation at import time
vi.mock("@/lib/tools/vector-search", () => ({
  vectorSearch: vi.fn(),
}));

vi.mock("@/lib/langgraph/tools/graph-query", () => ({
  graphQueryTool: { func: vi.fn() },
}));

vi.mock("@/lib/langgraph/llm-factory", () => ({
  getModel: vi.fn(() => ({ invoke: vi.fn() })),
}));

import { parseGraphRelationships } from "../report-agent";

describe("parseGraphRelationships", () => {
  // ─── Core format (exact match to graph-query.ts formatResult) ───

  it("parses the standard formatResult output with provenance brackets", () => {
    const input = [
      "Entities found: AWS (service), Payment Service (service)",
      "Relationships:",
      "  AWS → DEPENDS_ON → Payment Service [extracted, 0.85]",
      "  Payment Service → USES → Stripe API [extracted, 0.92]",
    ].join("\n");

    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "AWS", relation: "DEPENDS_ON", target: "Payment Service" },
      { source: "Payment Service", relation: "USES", target: "Stripe API" },
    ]);
  });

  // ─── Whitespace robustness ───

  it("handles no leading whitespace before entities", () => {
    const input = "AWS → DEPENDS_ON → Payment Service [extracted, 0.85]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "AWS", relation: "DEPENDS_ON", target: "Payment Service" },
    ]);
  });

  it("handles excessive whitespace around arrows", () => {
    const input = "  AWS   →   DEPENDS_ON   →   Payment Service   [extracted, 0.85]  ";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "AWS", relation: "DEPENDS_ON", target: "Payment Service" },
    ]);
  });

  it("handles tab-indented lines", () => {
    const input = "\tAWS → DEPENDS_ON → Payment Service [extracted, 0.85]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "AWS", relation: "DEPENDS_ON", target: "Payment Service" },
    ]);
  });

  // ─── Optional provenance brackets ───

  it("parses relationships without provenance brackets", () => {
    const input = "  HR Portal → RELATES_TO → Employee DB";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "HR Portal", relation: "RELATES_TO", target: "Employee DB" },
    ]);
  });

  it("parses relationships with complex provenance brackets", () => {
    const input =
      "  Auth Service → AUTHENTICATES → User DB [manual_annotation, 1.00]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      {
        source: "Auth Service",
        relation: "AUTHENTICATES",
        target: "User DB",
      },
    ]);
  });

  it("parses relationships with minimal provenance (single word)", () => {
    const input = "  AWS → HOSTS → Lambda [inferred]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      { source: "AWS", relation: "HOSTS", target: "Lambda" },
    ]);
  });

  // ─── Special characters in labels ───

  it("handles labels with hyphens, dots, and colons", () => {
    const input =
      "  api-gateway-v2 → ROUTES_TO → auth.service:8080 [extracted, 0.78]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      {
        source: "api-gateway-v2",
        relation: "ROUTES_TO",
        target: "auth.service:8080",
      },
    ]);
  });

  it("handles labels with slashes and underscores", () => {
    const input =
      "  /api/v1/users → DEFINED_IN → user_controller.ts [extracted, 0.90]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      {
        source: "/api/v1/users",
        relation: "DEFINED_IN",
        target: "user_controller.ts",
      },
    ]);
  });

  it("handles labels with parentheses", () => {
    const input =
      "  Cloud Functions (GCP) → TRIGGERS → Pub/Sub [extracted, 0.80]";
    const result = parseGraphRelationships(input);

    expect(result).toEqual([
      {
        source: "Cloud Functions (GCP)",
        relation: "TRIGGERS",
        target: "Pub/Sub",
      },
    ]);
  });

  // ─── Multi-line / mixed content ───

  it("extracts only relationship lines from mixed content", () => {
    const input = [
      "Entities found: AWS (service), Payment Service (service)",
      "Relationships:",
      "  AWS → DEPENDS_ON → Payment Service [extracted, 0.85]",
      "Note: boundary reached — some related nodes are not accessible to you.",
      "Source departments: dept_001, dept_002",
    ].join("\n");

    const result = parseGraphRelationships(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      source: "AWS",
      relation: "DEPENDS_ON",
      target: "Payment Service",
    });
  });

  it("parses multiple relationships from full graph output", () => {
    const input = [
      "Entities found: A (type), B (type), C (type)",
      "Relationships:",
      "  A → REL_1 → B [extracted, 0.80]",
      "  B → REL_2 → C [manual, 1.00]",
      "  A → REL_3 → C [inferred, 0.65]",
    ].join("\n");

    const result = parseGraphRelationships(input);

    expect(result).toHaveLength(3);
    expect(result[0].source).toBe("A");
    expect(result[1].relation).toBe("REL_2");
    expect(result[2].target).toBe("C");
  });

  // ─── Edge cases / graceful degradation ───

  it("returns empty array for 'No knowledge graph data' message", () => {
    const input = "No knowledge graph data available yet.";
    const result = parseGraphRelationships(input);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseGraphRelationships("")).toEqual([]);
  });

  it("returns empty array for null/undefined input", () => {
    expect(parseGraphRelationships(null as any)).toEqual([]);
    expect(parseGraphRelationships(undefined as any)).toEqual([]);
  });

  it("returns empty array when no relationship lines are present", () => {
    const input = [
      "Entities found: AWS (service)",
      "Source departments: dept_001",
    ].join("\n");

    expect(parseGraphRelationships(input)).toEqual([]);
  });

  it("skips malformed lines with only one arrow", () => {
    const input = [
      "  AWS → Payment Service",
      "  AWS → DEPENDS_ON → Payment Service [extracted, 0.85]",
    ].join("\n");

    const result = parseGraphRelationships(input);

    // Only the valid two-arrow line should be parsed
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("AWS");
  });

  // ─── Regression: the old regex would fail on these ───

  it("regression: old regex failed when target had trailing spaces before bracket", () => {
    // The old pattern ([^\n→\s\[]+) would stop at the first space in target
    const input = "  AWS → DEPENDS_ON → Payment Service  [extracted, 0.85]";
    const result = parseGraphRelationships(input);

    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("Payment Service");
  });

  it("regression: old regex failed on entity labels containing brackets elsewhere", () => {
    const input = "  Team (Engineering) → OWNS → Repo [manual, 1.00]";
    const result = parseGraphRelationships(input);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("Team (Engineering)");
    expect(result[0].target).toBe("Repo");
  });
});

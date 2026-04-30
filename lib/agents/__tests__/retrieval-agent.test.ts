/**
 * @deprecated This test file targeted the retired backlog retrieval agent
 * at lib/agents/retrieval-agent.ts.
 *
 * Canonical tests have been moved to:
 *   lib/langgraph/nodes/__tests__/retrieval-agent.test.ts
 *
 * This file is kept only to satisfy the Vitest file scanner.
 */
import { describe, it } from "vitest";

describe("retrievalAgent (DEPRECATED — backlog stub)", () => {
  it("is retired — see lib/langgraph/nodes/__tests__/retrieval-agent.test.ts", () => {
    // All tests have been migrated to the canonical location above.
    // This stub exists so Vitest does not error on an empty suite.
  });
});

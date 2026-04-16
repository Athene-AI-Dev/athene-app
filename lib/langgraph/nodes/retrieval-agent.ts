// ============================================================
// nodes/retrieval-agent.ts — Retrieval Agent node (stub)
// Full implementation: ATH-24
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function retrievalAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-24): run vector-search + kg-traversal in parallel,
  // populate retrieved_chunks.
  void state;
  return {
    retrieved_chunks: [],
    run_status: "running",
  };
}

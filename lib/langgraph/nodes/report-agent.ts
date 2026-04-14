// ============================================================
// nodes/report-agent.ts — Report Agent node (stub)
// Full implementation: ATH-28
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function reportAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-28): generate structured markdown reports from
  // cross-dept retrieved_chunks; no write actions required.
  void state;
  return {
    run_status: "running",
    retrieved_chunks: [],
  };
}

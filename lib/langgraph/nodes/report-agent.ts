// ============================================================
// nodes/report-agent.ts — Report Agent node (stub)
// Full implementation: ATH-28
// ============================================================

import type { AtheneStateType, AtheneStateUpdate } from "../state";

export async function reportAgentNode(
  state: AtheneStateType,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-28): generate structured markdown report from retrievedDocs.
  void state;
  return {
    run_status: "running",
  };
}

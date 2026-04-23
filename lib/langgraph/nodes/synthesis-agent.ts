// ============================================================
// nodes/synthesis-agent.ts — Synthesis Agent node (stub)
// Full implementation: ATH-29
// ============================================================

import type { AtheneStateType, AtheneStateUpdate } from "../state";

export async function synthesisAgentNode(
  state: AtheneStateType,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-29): build final answer from retrievedDocs + messages.
  void state;
  return {
    run_status: "complete",
  };
}

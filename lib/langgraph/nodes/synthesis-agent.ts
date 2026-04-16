// ============================================================
// nodes/synthesis-agent.ts — Synthesis Agent node (stub)
// Full implementation: ATH-29
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-29): build final_answer + cited_sources from
  // retrieved_chunks and messages; clear retrieved_chunks after use.
  void state;
  return {
    final_answer: null,
    cited_sources: [],
    // Ephemeral chunks cleared after synthesis
    retrieved_chunks: [],
    run_status: "completed",
  };
}

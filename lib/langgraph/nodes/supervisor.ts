// ============================================================
// nodes/supervisor.ts — Supervisor node (stub)
// Full implementation: ATH-23
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function supervisorNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-23): classify task_type, complexity, is_cross_dept_query
  // and select active_agent using LLM + agent registry.
  void state;
  return {
    active_agent: "retrieval_agent",
    task_type: "retrieval",
    complexity: "simple",
    is_cross_dept_query: false,
    run_status: "running",
  };
}

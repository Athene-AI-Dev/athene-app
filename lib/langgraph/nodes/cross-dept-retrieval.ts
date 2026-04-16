// ============================================================
// nodes/cross-dept-retrieval.ts — Cross-Department Retrieval node (stub)
// Full implementation: ATH-25
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function crossDeptRetrievalNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-25): run cross-department vector search using
  // accessible_dept_ids and write grant audit log rows.
  void state;
  return {
    retrieved_chunks: [],
    run_status: "running",
  };
}

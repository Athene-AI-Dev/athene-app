// ============================================================
// nodes/async-tool-node.ts — Approval / HITL node (stub)
//
// This node sits at interrupt_before in the compiled graph.
// LangGraph pauses execution here and waits for the human to
// call POST /api/agent/approve before resuming.
//
// Full implementation: ATH-30
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

/**
 * approval_node — receives the human decision after the interrupt.
 *
 * By the time this node executes, the approve/reject API route has
 * already updated pending_write_action and awaiting_approval in
 * the resumed state. This node clears the gate and proceeds.
 */
export async function approvalNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-30): check decision (approved/edited/rejected),
  // execute or discard pending_write_action accordingly,
  // write hitl_decisions audit row.
  void state;
  return {
    awaiting_approval: false,
    pending_write_action: null,
    run_status: "running",
  };
}

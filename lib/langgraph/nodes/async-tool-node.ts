import type { AtheneState, AtheneStateUpdate } from "../state";

// Approval gate node — runs after the human approves the synthesis output.
// The graph interrupts BEFORE this node (via interruptBefore: ['approval_gate']).
// On resume, this node clears the approval flag and marks the run done.
export async function approvalNode(
  _state: AtheneState
): Promise<AtheneStateUpdate> {
  return {
    awaiting_approval: false,
    run_status: "done",
  };
}

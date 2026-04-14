// ============================================================
// nodes/calendar-agent.ts — Calendar Agent node (stub)
// Full implementation: ATH-27
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";

export async function calendarAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-27): handle calendar-read, find-free-slot, calendar-create.
  // For create: set awaiting_approval=true and pending_write_action
  // to trigger the interrupt_before approval gate.
  void state;
  return {
    run_status: "running",
    awaiting_approval: false,
    pending_write_action: null,
  };
}

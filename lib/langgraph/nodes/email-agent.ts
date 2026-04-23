// ============================================================
// nodes/email-agent.ts — Email Agent node (stub)
// Full implementation: ATH-26
// ============================================================

import type { AtheneStateType, AtheneStateUpdate } from "../state";

export async function emailAgentNode(
  state: AtheneStateType,
): Promise<AtheneStateUpdate> {
  // TODO (ATH-26): handle email-read, email-draft, email-send.
  // For send: set awaiting_approval=true and pending_write_action
  // to trigger the interrupt_before approval gate.
  void state;
  return {
    run_status: "running",
    awaiting_approval: false,
    pending_write_action: null,
  };
}

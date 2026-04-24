// ============================================================
// nodes/action-executor.ts — Executes approved write actions
//
// This node runs AFTER an action has been approved by a human.
// It reads pending_write_action from state, dispatches to the
// appropriate integration, and stores the result or error.
// ============================================================

import type { AtheneState, AtheneStateUpdate } from "../state";
import { sendEmail } from "@/lib/integrations/microsoft/outlook-fetcher";
import { createEvent } from "@/lib/integrations/microsoft/calendar-fetcher";

export async function actionExecutorNode(
  state: AtheneState
): Promise<AtheneStateUpdate> {
  const action = state.pending_write_action;

  if (!action) {
    return { run_status: "running" };
  }

  try {
    let result: unknown;

    switch (action.type) {
      case "send_email": {
        result = await sendEmail(
          action.connectionId,
          action.orgId,
          action.payload
        );
        break;
      }
      case "create_event": {
        result = await createEvent(
          action.connectionId,
          action.orgId,
          action.payload
        );
        break;
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return {
      action_result: result,
      action_error: null,
      pending_write_action: null,
      run_status: "running",
    };
  } catch (err) {
    return {
      action_result: null,
      action_error: err instanceof Error ? err.message : String(err),
      pending_write_action: null,
      run_status: "running",
    };
  }
}

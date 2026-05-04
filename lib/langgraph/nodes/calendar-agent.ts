import type { AtheneState, AtheneStateUpdate } from "../state";
import { calendarAgent as implementation } from "@/lib/agents/calendar-agent";

export async function calendarAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  return implementation(state);
}

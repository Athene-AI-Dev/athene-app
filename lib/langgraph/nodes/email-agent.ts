import type { AtheneState, AtheneStateUpdate } from "../state";
import { emailAgentNode as implementation } from "@/lib/agents/email-agent";

export async function emailAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  return implementation(state);
}

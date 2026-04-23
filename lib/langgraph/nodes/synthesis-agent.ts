import type { AtheneState, AtheneStateUpdate } from "../state";
import { synthesisAgentNode as implementation } from "../../agents/synthesis-agent";

export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  return implementation(state);
}

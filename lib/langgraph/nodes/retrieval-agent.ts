import { vectorSearchTool, crossDeptVectorSearchTool } from "../tools/registry";
import { AtheneStateType } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";

/**
 * Standard retrieval agent worker.
 * Uses the orgId, userId, and role from the state to call RLS-protected tools.
 */
export async function retrievalAgent(state: AtheneStateType, config: any) {
  const { orgId, userId, role } = state;
  
  // Inject security context into tool config metadata
  const toolConfig = {
    ...config,
    metadata: {
      ...config.metadata,
      orgId,
      userId,
      role,
    },
  };

  const toolNode = new ToolNode([vectorSearchTool]);
  const result = await toolNode.invoke({ messages: state.messages }, toolConfig);

  return {
    messages: result.messages,
    // Extract retrieved docs from tool output if needed for state
    retrievedDocs: result.messages
      .filter((m: any) => m._getType() === "tool")
      .flatMap((m: any) => JSON.parse(m.content)),
  };
}

import { vectorSearchTool, crossDeptVectorSearchTool } from "../tools/registry";
import { AtheneStateType } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ToolMessage } from "@langchain/core/messages";

// 🛠️ ToolNode singleton
const toolNode = new ToolNode([vectorSearchTool]);

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

  const result = await toolNode.invoke({ messages: state.messages }, toolConfig);

  return {
    messages: result.messages,
    // Extract retrieved docs from tool output if needed for state
    retrievedDocs: result.messages
      .filter((m: any): m is ToolMessage => m instanceof ToolMessage)
      .flatMap((m: ToolMessage) => {
        try {
          return JSON.parse(m.content);
        } catch (e) {
          console.error("Error parsing tool output:", e);
          return [];
        }
      }),
  };
}

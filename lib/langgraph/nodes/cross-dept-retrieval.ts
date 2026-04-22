import { crossDeptVectorSearchTool } from "../tools/registry";
import { AtheneStateType } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// 🛠️ ToolNode singleton
const toolNode = new ToolNode([crossDeptVectorSearchTool]);

/**
 * BI Specialist agent worker.
 * Specifically uses crossDeptVectorSearchTool which enforces the bi_analyst role and visibility filters.
 */
export async function crossDeptRetrievalAgent(state: AtheneStateType, config: any) {
  const { orgId, userId, role } = state;

  // 🛡️ Defense-in-depth: Ensure role is actually bi_analyst
  if (role !== "bi_analyst") {
    return {
      messages: [
        {
          role: "assistant",
          content: "Access Denied: Cross-department search is restricted to BI Analysts.",
        },
      ],
    };
  }

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
    retrievedDocs: result.messages
      .filter((m: any) => m._getType() === "tool")
      .flatMap((m: any) => {
        try {
          return JSON.parse(m.content);
        } catch (e) {
          console.error("Error parsing tool output:", e);
          return [];
        }
      }),
  };
}

import { crossDeptVectorSearchTool } from "../tools/registry";
import { AtheneStateType } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode = new ToolNode([crossDeptVectorSearchTool]);

export async function crossDeptRetrievalAgent(state: AtheneStateType, config: any) {
  const { org_id, user_id, user_role } = state;

  if (user_role !== "super_user" && user_role !== "admin") {
    return {
      messages: [
        {
          role: "assistant",
          content: "Access Denied: Cross-department search is restricted to super_user and admin roles.",
        },
      ],
    };
  }

  const toolConfig = {
    ...config,
    metadata: {
      ...config.metadata,
      orgId: org_id,
      userId: user_id,
      user_role,
    },
  };

  const result = await toolNode.invoke({ messages: state.messages }, toolConfig);

  return {
    messages: result.messages,
    retrieved_chunks: result.messages
      .filter((m: any) => m._getType() === "tool")
      .flatMap((m: any) => {
        try {
          return JSON.parse(m.content);
        } catch {
          return [];
        }
      }),
  };
}

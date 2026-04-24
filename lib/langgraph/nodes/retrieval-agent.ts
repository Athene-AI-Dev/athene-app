import { vectorSearchTool } from "../tools/registry";
import { AtheneStateType } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";

const toolNode = new ToolNode([vectorSearchTool]);

export async function retrievalAgent(state: AtheneStateType, config: any) {
  const { org_id, user_id, user_role } = state;

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

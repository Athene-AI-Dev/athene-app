import { ChatOpenAI } from "@langchain/openai";
import { AtheneStateType } from "../state";
import { z } from "zod";

const supervisorPrompt = `You are a supervisor tasked with managing a conversation between the following workers: {workers}. 
Given the following user request, respond with the worker to act next. Each worker has a specialized role:
- retrieval: Searches for documents within the user's organization. Use this for general queries.
- cross_dept_retrieval: Specialized search that can access 'bi_accessible' documents across departments. Use this ONLY if the query specifically asks for revenue insights, cross-department trends, or mentions BI analysis.

If you have finished gathering information, respond with FINISH.`;

/**
 * Supervisor node that routes queries to the appropriate specialist.
 */
export async function supervisor(state: AtheneStateType) {
  const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

  const workers = ["retrieval", "cross_dept_retrieval"];
  
  const tool = {
    name: "route",
    description: "Select the next role.",
    schema: z.object({
      next: z.enum(["retrieval", "cross_dept_retrieval", "FINISH"]),
    }),
  };

  const response = await model.bindTools([tool], {
    tool_choice: "route",
  }).invoke([
    { role: "system", content: supervisorPrompt.replace("{workers}", workers.join(", ")) },
    ...state.messages,
  ]);

  const route = response.tool_calls?.[0]?.args as { next: string };
  
  return {
    next: route?.next || "FINISH",
  };
}

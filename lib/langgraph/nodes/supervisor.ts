import { AtheneStateType } from "../state";
import { z } from "zod";
import { model } from "../llm-factory";

const supervisorPrompt = `You are a supervisor tasked with managing a conversation between the following workers: {workers}. 
Given the following user request, respond with the worker to act next. Each worker has a specialized role:
- retrieval: Searches for documents within the user's organization. Use this for general queries.
- cross_dept_retrieval: Specialized search that can access 'bi_accessible' documents across departments. Use this ONLY if the query specifically asks for revenue insights, cross-department trends, or mentions BI analysis.
- email_agent: Drafts emails based on retrieved context. Use this when the user wants to compose or send an email.

If you have finished gathering information or a task is complete, respond with FINISH.`;

/**
 * Supervisor node that routes queries to the appropriate specialist.
 */
export async function supervisor(state: AtheneStateType) {
  const workers = ["retrieval", "cross_dept_retrieval", "email_agent"];
  
  const tool = {
    name: "route",
    description: "Select the next role.",
    schema: z.object({
      next: z.enum(["retrieval", "cross_dept_retrieval", "email_agent", "action_executor", "FINISH"]),
    }),
  };

  const response = await model.bindTools([tool], {
    tool_choice: "route",
  }).invoke([
    { role: "system", content: supervisorPrompt.replace("{workers}", workers.join(", ")) },
    ...state.messages,
  ]);

  const VALID_ROUTES = ["retrieval", "cross_dept_retrieval", "email_agent", "action_executor", "FINISH"] as const;
  const rawNext = (response.tool_calls?.[0]?.args as { next?: string } | undefined)?.next;

  if (!rawNext || !VALID_ROUTES.includes(rawNext as typeof VALID_ROUTES[number])) {
    console.warn("[supervisor] LLM returned invalid route:", rawNext, "— defaulting to FINISH");
  }

  return {
    next: VALID_ROUTES.includes(rawNext as typeof VALID_ROUTES[number]) ? rawNext : "FINISH",
  };
}

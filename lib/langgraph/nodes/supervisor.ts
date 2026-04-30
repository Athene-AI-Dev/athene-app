import { AtheneStateType } from "../state";
import { z } from "zod";
import { model } from "../llm-factory";

<<<<<<< Updated upstream
const supervisorPrompt = `You are a supervisor tasked with managing a conversation between the following workers: {workers}. 
Given the following user request, respond with the worker to act next. Each worker has a specialized role:
- retrieval: Searches for documents within the user's organization. Use this for general queries.
- cross_dept_retrieval: Specialized search that can access 'bi_accessible' documents across departments. Use this ONLY if the query specifically asks for revenue insights, cross-department trends, or mentions BI analysis.
- email_agent: Drafts emails based on retrieved context. Use this when the user wants to compose or send an email.

If you have finished gathering information or a task is complete, respond with FINISH.`;
=======
const MAX_HOPS = 6;

const ALL_AGENTS = [
  "retrieval",
  "cross_dept_retrieval",
  "email",
  "calendar",
  "report",
  "synthesis",
  "END",
] as const;

const supervisorPrompt = `You are the supervisor of an AI assistant. Route the conversation to the correct specialized agent.

**USER ROLE:** {user_role}
**HOPS REMAINING:** {hops_left}

## Available Agents

- retrieval: Search documents within the user's organization (Jira, Confluence, Slack, SharePoint, etc.)
- cross_dept_retrieval: Cross-department BI analysis — revenue insights, multi-team trends. **Restricted: super_user and admin roles only.**
- email: Read, draft, or send emails.
- calendar: Read calendar, find free slots, or create events.
- report: Generate a structured markdown report from already-retrieved data.
- synthesis: Synthesize a final answer from accumulated retrieved context and finish.
- END: The request has been fully answered — stop the graph.

## Routing Rules

1. **Role guard**: member roles MUST NOT be routed to cross_dept_retrieval. Route to retrieval instead.
2. **Hop guard**: If hops_left <= 1, route to synthesis or END to avoid hitting the hop limit.
3. **Synthesis trigger**: Route to synthesis when enough information has been gathered.
4. **END condition**: Route to END only after the final answer has already been delivered.
5. **Agent specificity**: Choose the most targeted agent; avoid unnecessary retrieval hops.`;
>>>>>>> Stashed changes

/**
 * Supervisor node that routes queries to the appropriate specialist.
 */
export async function supervisor(state: AtheneStateType) {
<<<<<<< Updated upstream
  const workers = ["retrieval", "cross_dept_retrieval", "email_agent"];
  
  const tool = {
    name: "route",
    description: "Select the next role.",
    schema: z.object({
      next: z.enum(["retrieval", "cross_dept_retrieval", "email_agent", "action_executor", "FINISH"]),
    }),
  };
=======
  const hopCount = state.hop_count ?? 0;
>>>>>>> Stashed changes

  // ── Hop-limit guard: skip LLM entirely at max hops ──
  if (hopCount >= MAX_HOPS) {
    return {
      active_agent: "END",
      reasoning: `[Guard] Max hop limit (${MAX_HOPS}) reached.`,
      hop_count: hopCount,
    };
  }

  const userRole = (state as any).user_role ?? state.role ?? "member";
  const hopsLeft = MAX_HOPS - hopCount;

  const responseSchema = z.object({
    next_agent: z.enum(ALL_AGENTS),
    task_type: z.string(),
    complexity: z.string(),
    reasoning: z.string(),
  });

  const systemContent = supervisorPrompt
    .replace("{user_role}", String(userRole))
    .replace("{hops_left}", String(hopsLeft));

  const structuredModel = model.withStructuredOutput(responseSchema);

  const response = await structuredModel.invoke([
    { role: "system", content: systemContent },
    ...state.messages,
  ]);

<<<<<<< Updated upstream
  const VALID_ROUTES = ["retrieval", "cross_dept_retrieval", "email_agent", "action_executor", "FINISH"] as const;
  const rawNext = (response.tool_calls?.[0]?.args as { next?: string } | undefined)?.next;
=======
  let nextAgent = response.next_agent;
  let taskType = response.task_type;
  let isCrossDeptQuery = state.is_cross_dept_query ?? false;
  let reasoning = response.reasoning;
>>>>>>> Stashed changes

  // ── Role guard: members cannot use cross_dept_retrieval ──
  if (nextAgent === "cross_dept_retrieval" && userRole === "member") {
    nextAgent = "retrieval";
    taskType = "document_search";
    isCrossDeptQuery = false;
    reasoning = `[Guard] member role blocked from cross_dept_retrieval → routed to retrieval. (${reasoning})`;
  }

  // ── Hop-left guard: force synthesis/END when nearly out of hops ──
  if (hopsLeft <= 1 && nextAgent !== "synthesis" && nextAgent !== "END") {
    nextAgent = "synthesis";
    taskType = "synthesis";
    reasoning = `[Guard] Only ${hopsLeft} hop(s) left → forced to synthesis. (${reasoning})`;
  }

  return {
    active_agent: nextAgent === "END" ? "END" : nextAgent,
    next: nextAgent === "END" ? "END" : nextAgent,
    task_type: taskType,
    complexity: response.complexity,
    reasoning,
    hop_count: hopCount + 1,
    is_cross_dept_query:
      nextAgent === "cross_dept_retrieval" ? true : isCrossDeptQuery,
  };
}

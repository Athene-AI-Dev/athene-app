import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { AtheneState, UserRole } from "../state";

const MAX_HOPS = 6;

// Roles permitted to trigger cross-department retrieval
const CROSS_DEPT_ROLES = new Set<UserRole>(["super_user", "admin"]);

const routingSchema = z.object({
  next_agent: z
    .enum(["retrieval", "cross_dept_retrieval", "email", "calendar", "report", "synthesis", "END"])
    .describe("The agent that should handle the next step"),
  task_type: z
    .string()
    .describe(
      "Fine-grained task classification, e.g. 'document_search', 'cross_dept_analysis', 'email_draft', 'calendar_booking', 'report_generation', 'synthesis'",
    ),
  complexity: z
    .enum(["simple", "medium", "complex"])
    .describe("Estimated complexity of the request — drives model tier selection"),
  reasoning: z
    .string()
    .describe("One sentence explaining why this agent was chosen"),
});

// Lightweight model for fast routing — gpt-4o-mini keeps latency low
const routerModel = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 }).withStructuredOutput(
  routingSchema,
);

function buildSystemPrompt(user_role: UserRole, hopsLeft: number): string {
  return `You are the supervisor of an AI assistant. Route the conversation to the correct specialized agent.

USER ROLE: ${user_role}
HOPS REMAINING: ${hopsLeft} of ${MAX_HOPS}

AVAILABLE AGENTS:
- retrieval           : Search documents within the user's organization (Jira, Confluence, Slack, etc.)
- cross_dept_retrieval: Cross-department BI analysis — revenue, multi-team trends. RESTRICTED: super_user and admin roles only.
- email               : Read, draft, or send emails.
- calendar            : Read calendar, find free slots, create events.
- report              : Generate a structured markdown report from already-retrieved data.
- synthesis           : Synthesize a final answer from accumulated retrieved context and finish.
- END                 : The request has been fully answered — stop the graph.

ROUTING RULES:
1. Non super_user/admin roles MUST NOT be routed to cross_dept_retrieval — route to retrieval instead.
2. If hopsLeft <= 1, route to synthesis or END to avoid hitting the hop limit.
3. Route to synthesis when enough information has been gathered to answer the question.
4. Route to END only after the final answer has already been delivered in the message history.
5. Choose the most specific agent for the request; avoid unnecessary retrieval hops.

Classify task_type as one of: document_search, cross_dept_analysis, email_draft, email_read,
calendar_read, calendar_create, report_generation, synthesis, or other.
Estimate complexity as simple (single lookup), medium (multi-step), or complex (cross-dept/multi-source).`;
}

/**
 * Supervisor node — classifies the user request, enforces role-based access,
 * and routes to the correct specialist agent or END.
 *
 * Guards enforced here (defense-in-depth also exists in each worker node):
 *   - Non super_user/admin users cannot be routed to cross_dept_retrieval.
 *   - Max 6 hops are enforced without calling the LLM.
 */
export async function supervisor(state: AtheneState) {
  const { user_role, hop_count } = state;
  const hopsLeft = MAX_HOPS - hop_count;

  // Enforce hard hop limit without calling the LLM
  if (hop_count >= MAX_HOPS) {
    return {
      active_agent: "END",
      reasoning: `Max hop limit (${MAX_HOPS}) reached — terminating to prevent infinite loop.`,
      hop_count,
    };
  }

  const result = await routerModel.invoke([
    { role: "system", content: buildSystemPrompt(user_role, hopsLeft) },
    ...state.messages,
  ]);

  let { next_agent, task_type, complexity, reasoning } = result;

  // Guard rail: silently override unauthorized cross-dept routing
  if (next_agent === "cross_dept_retrieval" && !CROSS_DEPT_ROLES.has(user_role)) {
    console.warn(
      `[supervisor] Guard: role "${user_role}" attempted cross_dept_retrieval — overriding to retrieval.`,
    );
    next_agent = "retrieval";
    task_type = "document_search";
    reasoning = `[Guard] Role "${user_role}" is not authorized for cross-department access. Routing to retrieval instead.`;
  }

  return {
    active_agent: next_agent,
    task_type,
    complexity,
    is_cross_dept_query: next_agent === "cross_dept_retrieval",
    reasoning,
    hop_count: hop_count + 1,
  };
}

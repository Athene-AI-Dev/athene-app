// ============================================================
// lib/langgraph/nodes/planner-agent.ts — Multi-step query planner (Sprint 4C)
//
// Sits between supervisor and retrieval for complex queries.
// Decomposes a cross-department question into 2-5 sequential
// retrieval steps with explicit dependency ordering.
//
// Simple queries (< 15 words, single domain) are passed through
// as a single-step plan to avoid latency overhead.
//
// State contract:
//   IN:  state.messages (last HumanMessage), state.hop_count
//   OUT: state.planning_steps
// ============================================================

import { AtheneStateType } from "../state";
import { resolveModelClient } from "../llm-factory";
import { logger } from "@/lib/logger";

const PLANNER_SYSTEM = `You are a query decomposition planner for an enterprise knowledge system with 4 departments:
- RevOps: Salesforce, HubSpot, pipeline data, deals, revenue forecasting
- Engineering Intelligence: GitHub, Linear, Jira, PagerDuty incidents, deployments
- Customer Success: Zendesk, Intercom, support tickets, churn, account health
- Legal & Compliance: Google Drive, SharePoint, contracts, policies, SLAs, regulations

Given a complex user query that spans multiple departments or requires sequential context gathering, decompose it into 2-5 sequential retrieval steps. Each step should build on the results of its dependencies.

Return ONLY valid JSON — no prose, no markdown:
{
  "steps": [
    { "id": "s1", "query": "<specific search string for this step>", "department": "revops|engineering|customer_success|legal|cross", "depends_on": [] },
    { "id": "s2", "query": "<builds on s1 context>", "department": "...", "depends_on": ["s1"] }
  ]
}

Rules:
- If the query is simple (single department, factual lookup), return a single step with department="cross"
- Each query string should be specific and self-contained
- "cross" department means search across all departments
- depends_on should only reference step ids that come before this step`;

export async function plannerAgent(
  state: AtheneStateType,
  config: any
): Promise<Partial<AtheneStateType>> {
  const lastHuman = [...state.messages]
    .reverse()
    .find((m) => m._getType?.() === "human");
  const query =
    typeof lastHuman?.content === "string" ? lastHuman.content : "";

  // Short or first-hop queries skip planning to avoid latency overhead
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount < 15 || (state.hop_count ?? 0) > 0) {
    return { planning_steps: null };
  }

  // Check if query contains cross-department signals
  const crossDeptSignals = [
    "affect", "impact", "cause", "because", "relationship", "connect",
    "across", "between", "and the", "as well as", "revenue", "incident",
    "legal", "compliance", "customer", "engineering",
  ];
  const hasCrossSignal = crossDeptSignals.some((s) =>
    query.toLowerCase().includes(s)
  );

  if (!hasCrossSignal) {
    return { planning_steps: null };
  }

  try {
    const llm = await resolveModelClient("simple", state.orgId, 0);
    const response = await llm.invoke([
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: query },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const planJson = JSON.parse(cleaned);
    const steps = planJson.steps ?? null;

    logger.info(
      { steps: steps?.length ?? 0, query: query.slice(0, 80) },
      "[planner] Query decomposed"
    );

    return { planning_steps: steps };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[planner] Planning failed — falling back to single-hop retrieval"
    );
    return { planning_steps: null };
  }
}

// ============================================================
// graph.ts — Athene StateGraph
//
// Assembles the full multi-agent graph from node functions and
// wires up all edges including the HITL interrupt gate.
//
// Graph topology:
//
//   START
//     └─► supervisor
//           └─► (conditional on active_agent)
//                 ├─► retrieval_agent   ──────────────────► synthesis_agent ──► END
//                 ├─► cross_dept_agent  ──────────────────► synthesis_agent
//                 ├─► report_agent      ──────────────────► synthesis_agent
//                 ├─► data_index_agent  ──────────────────► synthesis_agent
//                 ├─► email_agent   ──┬─ (no approval) ──► synthesis_agent
//                 │                   └─ (needs approval) ► approval_node ──► synthesis_agent
//                 └─► calendar_agent ─┬─ (no approval) ──► synthesis_agent
//                                     └─ (needs approval) ► approval_node
//
// interrupt_before: ["approval_node"]
//   LangGraph pauses execution before approval_node runs.
//   The human calls POST /api/agent/approve to resume.
//
// Usage:
//   const graph = buildAtheneGraph(checkpointer);
//   const stream = graph.stream(initialState, { configurable: { thread_id } });
// ============================================================

import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

import { AtheneStateAnnotation, type AtheneState, type AtheneStateUpdate } from "./state";
import { supervisor as supervisorNode } from "./nodes/supervisor";
import { retrievalAgent as retrievalAgentNode } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent as crossDeptRetrievalNode } from "./nodes/cross-dept-retrieval";
import { emailAgentNode } from "../agents/email-agent";
import { calendarAgent as calendarAgentNode } from "../agents/calendar-agent";
import { reportAgent as reportAgentNode } from "../agents/report-agent";
import { synthesisAgentNode } from "./nodes/synthesis-agent";
import { approvalNode } from "./nodes/async-tool-node";

// ---- Routing functions -------------------------------------

/** Map supervisor output (from mudassir ATH-34) to graph node names. */
const AGENT_NAME_MAP: Record<string, string> = {
  retrieval: "retrieval_agent",
  cross_dept_retrieval: "cross_dept_agent",
  email: "email_agent",
  calendar: "calendar_agent",
  report: "report_agent",
  // Already-correct names (pass through)
  retrieval_agent: "retrieval_agent",
  cross_dept_agent: "cross_dept_agent",
  email_agent: "email_agent",
  calendar_agent: "calendar_agent",
  report_agent: "report_agent",
  data_index_agent: "data_index_agent",
};

/** Supervisor → agent routing based on active_agent field. */
function routeFromSupervisor(state: AtheneState): string {
  const agent = state.active_agent ?? "";
  return AGENT_NAME_MAP[agent] ?? "synthesis_agent";
}

/** Route write-capable agents to approval gate or directly to synthesis. */
function routeAfterWriteAgent(state: AtheneState): string {
  return state.awaiting_approval ? "approval_node" : "synthesis_agent";
}

// ---- data_index_agent stub (admin-only, no separate node file yet) ---

async function dataIndexAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  // TODO: implement data indexing logic
  void state;
  return { run_status: "running" };
}

// ---- Graph factory -----------------------------------------

/**
 * Build and compile the Athene StateGraph.
 *
 * @param checkpointer  A BaseCheckpointSaver instance.
 *   Pass SupabaseCheckpointer for production.
 *   Pass MemorySaver from @langchain/langgraph for tests.
 */
export function buildAtheneGraph(checkpointer: BaseCheckpointSaver) {
  const graph = new StateGraph(AtheneStateAnnotation)
    // ---- Nodes ------------------------------------------------
    .addNode("supervisor", supervisorNode)
    .addNode("retrieval_agent", retrievalAgentNode)
    .addNode("cross_dept_agent", crossDeptRetrievalNode)
    .addNode("email_agent", emailAgentNode)
    .addNode("calendar_agent", calendarAgentNode)
    .addNode("report_agent", reportAgentNode)
    .addNode("data_index_agent", dataIndexAgentNode)
    .addNode("approval_node", approvalNode)
    .addNode("synthesis_agent", synthesisAgentNode)

    // ---- Entry edge -------------------------------------------
    .addEdge(START, "supervisor")

    // ---- Supervisor → agents (conditional) -------------------
    .addConditionalEdges("supervisor", routeFromSupervisor, {
      retrieval_agent: "retrieval_agent",
      cross_dept_agent: "cross_dept_agent",
      email_agent: "email_agent",
      calendar_agent: "calendar_agent",
      report_agent: "report_agent",
      data_index_agent: "data_index_agent",
      synthesis_agent: "synthesis_agent",
    })

    // ---- Read-only agents → synthesis (direct) ---------------
    .addEdge("retrieval_agent", "synthesis_agent")
    .addEdge("cross_dept_agent", "synthesis_agent")
    .addEdge("report_agent", "synthesis_agent")
    .addEdge("data_index_agent", "synthesis_agent")

    // ---- Write-capable agents → approval gate or synthesis ---
    .addConditionalEdges("email_agent", routeAfterWriteAgent, {
      approval_node: "approval_node",
      synthesis_agent: "synthesis_agent",
    })
    .addConditionalEdges("calendar_agent", routeAfterWriteAgent, {
      approval_node: "approval_node",
      synthesis_agent: "synthesis_agent",
    })

    // ---- Approval node → synthesis ---------------------------
    .addEdge("approval_node", "synthesis_agent")

    // ---- Terminal edge ----------------------------------------
    .addEdge("synthesis_agent", END);

  return graph.compile({
    checkpointer,
    interruptBefore: ["approval_node"],
  });
}

export type AtheneGraph = ReturnType<typeof buildAtheneGraph>;

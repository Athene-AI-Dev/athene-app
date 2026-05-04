import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneState } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { emailAgentNode } from "./nodes/email-agent";
import { calendarAgentNode } from "./nodes/calendar-agent";
import { synthesisAgentNode } from "./nodes/synthesis-agent";
import { actionExecutorNode } from "./nodes/action-executor";
import { getCheckpointer } from "./checkpointer";

// Cached compiled graph — lazily initialized on first call to getAgentGraph()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let compiledGraph: any = null;

export async function getAgentGraph(): Promise<any> {
  if (compiledGraph) return compiledGraph;

  const checkpointer = await getCheckpointer();

  const workflow = new StateGraph(AtheneState)
    // Router
    .addNode("supervisor", supervisor)
    // Worker nodes
    .addNode("retrieval", retrievalAgent)
    .addNode("cross_dept_retrieval", crossDeptRetrievalAgent)
    .addNode("email_agent", emailAgentNode)
    .addNode("calendar_agent", calendarAgentNode)
    .addNode("synthesis", synthesisAgentNode)
    // Write-action executor (paused by interrupt_before for HITL approval)
    .addNode("action_executor", actionExecutorNode);

  // Edges
  workflow.addEdge(START, "supervisor");

  // Workers always return to the supervisor after completion
  workflow.addEdge("retrieval", "supervisor");
  workflow.addEdge("cross_dept_retrieval", "supervisor");
  workflow.addEdge("email_agent", "supervisor");
  workflow.addEdge("calendar_agent", "supervisor");
  workflow.addEdge("action_executor", "supervisor");

  // Synthesis is the terminal node for answers
  workflow.addEdge("synthesis", END);

  // The supervisor routes to a worker, synthesis, or END
  workflow.addConditionalEdges(
    "supervisor",
    (state) => state.next || "END",
    {
      retrieval: "retrieval",
      cross_dept_retrieval: "cross_dept_retrieval",
      email_agent: "email_agent",
      calendar_agent: "calendar_agent",
      synthesis: "synthesis",
      action_executor: "action_executor",
      END: END,
    }
  );

  // ATH-43: The interrupt_before: ["action_executor"] halts execution
  // whenever the graph is about to run the action_executor node.
  // This gives the user a chance to review the pending_write_action
  // (set by email_agent or calendar_agent) before it actually executes.
  compiledGraph = workflow.compile({
    checkpointer,
    interruptBefore: ["action_executor"],
  });
  return compiledGraph;
}



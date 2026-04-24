import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneStateAnnotation } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { synthesisAgentNode } from "./nodes/synthesis-agent";
import { reportAgentNode } from "./nodes/report-agent";
import { emailAgentNode } from "./nodes/email-agent";
import { calendarAgentNode } from "./nodes/calendar-agent";
import { approvalNode } from "./nodes/async-tool-node";
import { checkpointer } from "./checkpointer";

const workflow = new StateGraph(AtheneStateAnnotation)
  .addNode("supervisor", supervisor)
  .addNode("retrieval", retrievalAgent)
  .addNode("cross_dept_retrieval", crossDeptRetrievalAgent)
  .addNode("synthesis", synthesisAgentNode)
  .addNode("report", reportAgentNode)
  .addNode("email", emailAgentNode)
  .addNode("calendar", calendarAgentNode)
  .addNode("approval_node", approvalNode);

// Entry point
workflow.addEdge(START, "supervisor");

// Retrieval agents loop back to supervisor for multi-hop
workflow.addEdge("retrieval", "supervisor");
workflow.addEdge("cross_dept_retrieval", "supervisor");

// Report feeds into synthesis for the final answer
workflow.addEdge("report", "synthesis");

// Write agents go to HITL approval gate before executing
workflow.addEdge("email", "approval_node");
workflow.addEdge("calendar", "approval_node");

// Terminal nodes
workflow.addEdge("synthesis", END);
workflow.addEdge("approval_node", END);

// Supervisor routes to a worker or terminates via active_agent field
workflow.addConditionalEdges("supervisor", (state) => state.active_agent || "END", {
  retrieval: "retrieval",
  cross_dept_retrieval: "cross_dept_retrieval",
  synthesis: "synthesis",
  report: "report",
  email: "email",
  calendar: "calendar",
  END,
});

export const agentGraph = workflow.compile({
  checkpointer,
  // Pause before approval_node so the UI can show the pending action
  // and the user can approve/reject via POST /api/agent/approve
  interruptBefore: ["approval_node"],
});

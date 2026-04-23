import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneStateAnnotation } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { emailAgentNode } from "./nodes/email-agent";
import { calendarAgentNode } from "./nodes/calendar-agent";
import { reportAgentNode } from "./nodes/report-agent";
import { synthesisAgentNode } from "./nodes/synthesis-agent";
import { checkpointer } from "./checkpointer";

const workflow = new StateGraph(AtheneStateAnnotation)
  .addNode("supervisor", supervisor)
  .addNode("retrieval", retrievalAgent)
  .addNode("cross_dept_retrieval", crossDeptRetrievalAgent)
  .addNode("email", emailAgentNode)
  .addNode("calendar", calendarAgentNode)
  .addNode("report", reportAgentNode)
  .addNode("synthesis", synthesisAgentNode);

// Supervisor is the entry point for every conversation turn
workflow.addEdge(START, "supervisor");

// All workers return to supervisor after completion (loop topology)
workflow.addEdge("retrieval", "supervisor");
workflow.addEdge("cross_dept_retrieval", "supervisor");
workflow.addEdge("email", "supervisor");
workflow.addEdge("calendar", "supervisor");
workflow.addEdge("report", "supervisor");
workflow.addEdge("synthesis", "supervisor");

// Supervisor routes to a worker or terminates
workflow.addConditionalEdges(
  "supervisor",
  (state) => state.active_agent || "END",
  {
    retrieval: "retrieval",
    cross_dept_retrieval: "cross_dept_retrieval",
    email: "email",
    calendar: "calendar",
    report: "report",
    synthesis: "synthesis",
    END,
  },
);

export const agentGraph = workflow.compile({ checkpointer });

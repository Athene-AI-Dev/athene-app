import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneStateAnnotation } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { calendarAgent } from "../agents/calendar-agent";
import { checkpointer } from "./checkpointer";

// 1. Initialize the graph with our state definition
const workflow = new StateGraph(AtheneStateAnnotation)
  // 2. Add the supervisor (the "router")
  .addNode("supervisor", supervisor)
  // 3. Add the worker nodes
  .addNode("retrieval", retrievalAgent)
  .addNode("cross_dept_retrieval", crossDeptRetrievalAgent)
  .addNode("calendar", calendarAgent);

// 4. Define the edges (routing)
workflow.addEdge(START, "supervisor");

// Workers always return to the supervisor after completion
workflow.addEdge("retrieval", "supervisor");
workflow.addEdge("cross_dept_retrieval", "supervisor");
workflow.addEdge("calendar", "supervisor");

// The supervisor routes to a worker or FINISH.
// active_agent is set by the supervisor node (canonical routing field).
workflow.addConditionalEdges(
  "supervisor",
  (state) => state.active_agent || "FINISH",
  {
    retrieval: "retrieval",
    cross_dept_retrieval: "cross_dept_retrieval",
    calendar: "calendar",
    FINISH: END,
  }
);

// 5. Compile the graph with a checkpointer
export const agentGraph = workflow.compile({
  checkpointer,
});

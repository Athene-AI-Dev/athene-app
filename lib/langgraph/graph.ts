import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneState } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";

// 1. Initialize the graph with our state definition
const workflow = new StateGraph(AtheneState)
  // 2. Add the supervisor (the "router")
  .addNode("supervisor", supervisor)
  // 3. Add the worker nodes
  .addNode("retrieval", retrievalAgent)
  .addNode("cross_dept_retrieval", crossDeptRetrievalAgent);

// 4. Define the edges (routing)
workflow.addEdge(START, "supervisor");

// Workers always return to the supervisor after completion
workflow.addEdge("retrieval", "supervisor");
workflow.addEdge("cross_dept_retrieval", "supervisor");

// The supervisor routes to a worker or FINISH
workflow.addConditionalEdges("supervisor", (state) => state.next || "FINISH", {
  retrieval: "retrieval",
  cross_dept_retrieval: "cross_dept_retrieval",
  FINISH: END,
});

// 5. Compile the graph
export const agentGraph = workflow.compile();

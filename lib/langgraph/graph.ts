import { StateGraph, START, END } from "@langchain/langgraph";
import { AtheneState } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
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
    // Write-action executor (requires prior approval)
    .addNode("action_executor", actionExecutorNode);

  // Edges
  workflow.addEdge(START, "supervisor");

  // Workers always return to the supervisor after completion
  workflow.addEdge("retrieval", "supervisor");
  workflow.addEdge("cross_dept_retrieval", "supervisor");
  workflow.addEdge("action_executor", "supervisor");

  // The supervisor routes to a worker, action executor, or FINISH
  workflow.addConditionalEdges(
    "supervisor",
    (state) => state.next || "FINISH",
    {
      retrieval: "retrieval",
      cross_dept_retrieval: "cross_dept_retrieval",
      action_executor: "action_executor",
      FINISH: END,
    }
  );

  compiledGraph = workflow.compile({ checkpointer });
  return compiledGraph;
}


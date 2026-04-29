import { StateGraph, START, END, CompiledStateGraph } from "@langchain/langgraph";
import { AtheneState, AtheneStateType } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { actionExecutorNode } from "./nodes/action-executor";
import { synthesisAgentNode } from "./nodes/synthesis-agent";
import { approvalNode } from "./nodes/async-tool-node";
import { getCheckpointer } from "./checkpointer";

// Cached compiled graph — lazily initialized on first call to getAgentGraph()
let compiledGraph: CompiledStateGraph<AtheneStateType, any, any> | null = null;

export async function getAgentGraph(): Promise<CompiledStateGraph<AtheneStateType, any, any>> {
  if (compiledGraph) return compiledGraph;

  const checkpointer = await getCheckpointer();

  const workflow = new StateGraph(AtheneState)
    // Router
    .addNode("supervisor", supervisor)
    // Worker nodes
    .addNode("retrieval", retrievalAgent)
    .addNode("cross_dept_retrieval", crossDeptRetrievalAgent)
    // Write-action executor (requires prior approval)
    .addNode("action_executor", actionExecutorNode)
    .addNode("synthesis", synthesisAgentNode)
    .addNode("approval_gate", approvalNode);

  // Edges
  workflow.addEdge(START, "supervisor");

  // Workers always return to the supervisor after completion
  workflow.addEdge("retrieval", "supervisor");
  workflow.addEdge("cross_dept_retrieval", "supervisor");
  workflow.addEdge("action_executor", "supervisor");

  // The supervisor routes to a worker, action executor, or FINISH
  // FINISH now maps to "synthesis" instead of END
  workflow.addConditionalEdges(
    "supervisor",
    (state) => state.next || "FINISH",
    {
      retrieval: "retrieval",
      cross_dept_retrieval: "cross_dept_retrieval",
      action_executor: "action_executor",
      FINISH: "synthesis",
    }
  );

  // After synthesis, go to the approval gate
  workflow.addEdge("synthesis", "approval_gate");

  compiledGraph = workflow.compile({
    checkpointer,
    interruptBefore: ['approval_gate'],
  });
  
  return compiledGraph;
}


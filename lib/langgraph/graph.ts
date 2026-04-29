import { StateGraph, START, END, CompiledStateGraph } from "@langchain/langgraph";
import { AtheneState, AtheneStateType } from "./state";
import { supervisor } from "./nodes/supervisor";
import { retrievalAgent } from "./nodes/retrieval-agent";
import { crossDeptRetrievalAgent } from "./nodes/cross-dept-retrieval";
import { emailAgentNode } from "./nodes/email-agent";
import { calendarAgentNode } from "./nodes/calendar-agent";
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
<<<<<<< HEAD
    // Write-action executor (requires prior approval)
    .addNode("action_executor", actionExecutorNode)
    .addNode("synthesis", synthesisAgentNode)
    .addNode("approval_gate", approvalNode);
=======
    // Email and Calendar agents (propose actions)
    .addNode("email_agent", emailAgentNode)
    .addNode("calendar_agent", calendarAgentNode)
    // Write-action executors (paused by interrupt_before for HITL approval)
    .addNode("email_send", actionExecutorNode)
    .addNode("calendar_create", actionExecutorNode);
>>>>>>> e4468dfbf5c9fbe7df5c7f6aacdac14f08dd7d09

  // Edges
  workflow.addEdge(START, "supervisor");

  // Workers always return to the supervisor after completion
  workflow.addEdge("retrieval", "supervisor");
  workflow.addEdge("cross_dept_retrieval", "supervisor");
  
  // Transition from agent to executor node (paused by interrupt_before)
  workflow.addEdge("email_agent", "email_send");
  workflow.addEdge("calendar_agent", "calendar_create");

  // Executors return to supervisor
  workflow.addEdge("email_send", "supervisor");
  workflow.addEdge("calendar_create", "supervisor");

  // The supervisor routes to a worker, action executor, or FINISH
  // FINISH now maps to "synthesis" instead of END
  workflow.addConditionalEdges(
    "supervisor",
    (state) => state.next || "FINISH",
    {
      retrieval: "retrieval",
      cross_dept_retrieval: "cross_dept_retrieval",
<<<<<<< HEAD
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
  
=======
      email_agent: "email_agent",
      calendar_agent: "calendar_agent",
      FINISH: END,
    }
  );

  compiledGraph = workflow.compile({ 
    checkpointer,
    interruptBefore: ["email_send", "calendar_create"],
  });
>>>>>>> e4468dfbf5c9fbe7df5c7f6aacdac14f08dd7d09
  return compiledGraph;
}


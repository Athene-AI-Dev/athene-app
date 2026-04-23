/**
 * verify-synthesis.ts
 * 
 * Smoke test to manually verify the Synthesis Agent implementation.
 * Run with: npx tsx .gemini/antigravity/scratch/verify-synthesis.ts
 */

import { synthesisAgentNode } from "../../../lib/agents/synthesis-agent";
import { AtheneState } from "../../../lib/langgraph/state";
import * as dotenv from "dotenv";

// Load env vars for API keys - specifically from .env.local for Next.js projects
dotenv.config({ path: ".env.local" });

async function runVerification() {
  console.log(" Starting Synthesis Agent Manual Verification...\n");

  // Mock state with retrieval results
  const mockState: AtheneState = {
    messages: [{ content: "What were the key takeaways from the Q3 report?", _getType: () => "human" } as any],
    retrieved_chunks: [
      {
        document_id: "doc_q3_report",
        content_preview: "The main takeaway from Q3 was a 15% increase in operational efficiency due to AI adoption.",
        chunk_index: 0,
        source_type: "pdf",
        external_url: "https://athene.ai/reports/q3.pdf",
        id: "chunk_1",
        similarity: 0.95,
        department_id: "finance"
      }
    ],
    org_id: "org_test_123",
    complexity: "medium",
    task_type: "retrieval",
    is_cross_dept_query: false,
    thread_id: "test_thread",
    user_id: "user_test",
    user_role: "admin",
    user_dept_id: "finance",
    accessible_dept_ids: ["finance"],
    bi_grant_id: null,
    active_agent: "synthesis_agent",
    run_status: "running",
    awaiting_approval: false,
    pending_write_action: null,
    final_answer: null,
    cited_sources: []
  };

  try {
    console.log("--- Input State ---");
    console.log(`Context Chunks: ${mockState.retrieved_chunks.length}`);
    console.log(`Question: ${mockState.messages[0].content}\n`);

    // Note: To see streaming logs, you would normally use graph.stream()
    // Here we invoke the node directly to check the logic.
    const result = await synthesisAgentNode(mockState);

    console.log("--- Synthesis Result ---");
    console.log("Final Answer:");
    console.log("------------------------");
    console.log(result.final_answer);
    console.log("------------------------\n");

    console.log("Extracted Citations:");
    console.log(JSON.stringify(result.cited_sources ?? [], null, 2));

    console.log("\nCleanup Check:");
    console.log(`Retrieved Chunks Remaining: ${(result.retrieved_chunks as any)?.length}`);

    if ((result.final_answer as string)?.includes("[doc_q3_report]") && (result.cited_sources as any)?.length === 1) {
      console.log("\n VERIFICATION SUCCESSFUL: Citations produced and extracted.");
    } else {
      console.log("\n VERIFICATION INCOMPLETE: Check output for missing citations.");
    }

  } catch (error) {
    console.error("\n VERIFICATION FAILED:");
    console.error(error);
    console.log("\nNote: Ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set in your .env file.");
  }
}

runVerification();

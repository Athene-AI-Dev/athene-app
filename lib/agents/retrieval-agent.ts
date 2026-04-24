import { AtheneStateType } from "../langgraph/state";
import { vectorSearch } from "../tools/vector-search";

/**
 * Retrieval Agent — Single-department document search.
 * Handles plain "find me info" questions by calling the vector search tool.
 */
export async function retrievalAgent(state: AtheneStateType) {
  const { query, user } = state;

  if (!query || !user) {
    return {
      next_agent: "END",
      message: "Missing query or user context",
    };
  }

  // Call vector search with topK: 8 as requested
  const results = await vectorSearch({
    orgId: user.orgId,
    userId: user.id,
    role: user.role,
    query: query,
    topK: 8,
  });

  // If zero results → set state.next_agent = "END" with message
  if (!results || results.length === 0) {
    return {
      next_agent: "END",
      message: "No relevant docs found",
    };
  }

  // Store results in state.retrieval_results as specified
  const retrieval_results = results.map((res: any) => ({
    chunk_id: res.chunk_id,
    document_id: res.document_id,
    score: res.score,
    preview: res.preview || "No preview available",
    metadata: res.metadata,
  }));


  return {
    retrieval_results,
    // Return partial state update — graph router sends to synthesis
  };
}

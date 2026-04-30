import type { AtheneStateType, AtheneStateUpdate } from "../state";
import { vectorSearch } from "../../tools/vector-search";

/**
 * Live retrieval agent node — wired into the LangGraph workflow.
 *
 * Reads security context (orgId, userId, role) from graph state,
 * calls the RLS-protected vectorSearch directly, and writes
 * `retrieved_chunks` back to state for the synthesis agent.
 *
 * Output contract: { retrieved_chunks } | { run_status: "completed" }
 */
export async function retrievalAgent(
  state: AtheneStateType
): Promise<AtheneStateUpdate> {
  const { orgId, userId, role, messages } = state;

  // Extract query text from the last human message
  const lastMessage = messages?.[messages.length - 1];
  if (!lastMessage || !orgId) {
    return { run_status: "completed" };
  }

  const query =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content ?? "");

  if (!query) {
    return { run_status: "completed" };
  }

  const results = await vectorSearch({
    orgId,
    userId,
    user_role: role as "member" | "super_user" | "admin",
    query,
    topK: 8,
  });

  if (!results || results.length === 0) {
    return { run_status: "completed" };
  }

  const retrieved_chunks = results.map((res: any) => ({
    id: res.chunk_id ?? res.id,
    document_id: res.document_id,
    content_preview: res.preview ?? res.content_preview ?? "",
    chunk_index: res.chunk_index ?? 0,
    source_type: res.source_type ?? "document",
    external_url: res.external_url ?? null,
    department_id: res.department_id ?? null,
    similarity: res.score ?? res.similarity ?? 0,
  }));

  return { retrieved_chunks };
}

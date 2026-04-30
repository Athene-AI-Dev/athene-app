import type { AtheneState, AtheneStateUpdate } from "../langgraph/state";
import { vectorSearch } from "../tools/vector-search";

export async function retrievalAgent(state: AtheneState): Promise<AtheneStateUpdate> {
  const { orgId, userId, role, messages } = state;

  const lastMessage = messages?.[messages.length - 1];
  // Fallback to "" first so null/undefined content never becomes the string "null" via JSON.stringify
const rawContent = lastMessage?.content ?? "";
const query =
  typeof rawContent === "string"
    ? rawContent
    : JSON.stringify(rawContent);

    
// Use .trim() to also catch whitespace-only strings that would produce useless search results
if (!query.trim() || !orgId) {
    return { run_status: "completed" };
  }

  // Perform vector search scoped to org, user and role with top 8 results
  const results = await vectorSearch({
    orgId,
    userId,
    user_role: role as "member" | "super_user" | "admin",
    query,
    topK: 8,
  });

  // Nothing retrieved, mark agent as done so downstream nodes are not left waiting
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

// Return chunks alongside run_status so downstream nodes receive a completion signal
return { retrieved_chunks, run_status: "completed" };
}

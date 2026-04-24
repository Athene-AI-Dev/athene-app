import type { AtheneState, AtheneStateUpdate } from "../langgraph/state";
import { vectorSearch } from "../tools/vector-search";

export async function retrievalAgent(state: AtheneState): Promise<AtheneStateUpdate> {
  const { org_id, user_id, user_role, messages } = state;

  const lastMessage = messages?.[messages.length - 1];
  const query =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content ?? "");

  if (!query || !org_id) {
    return { run_status: "complete" };
  }

  const results = await vectorSearch({
    orgId: org_id,
    userId: user_id,
    user_role,
    query,
    topK: 8,
  });

  if (!results || results.length === 0) {
    return { run_status: "complete" };
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

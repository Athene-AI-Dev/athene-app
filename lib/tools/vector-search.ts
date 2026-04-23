import { embed } from "../ai/embedder";
import { similaritySearch, type SearchResult } from "../supabase/vector";
import type { RLSContext } from "../supabase/rls-client";

export type { SearchResult };

type Params = {
  ctx: RLSContext;
  query: string;
  topK?: number;
};

/**
 * Standard vector search for documents within the user's organisation and access context.
 * Delegates to similaritySearch() which uses withRLS() for full Postgres RLS enforcement
 * via the match_documents() RPC function.
 */
export async function vectorSearch({
  ctx,
  query,
  topK = 5,
}: Params): Promise<SearchResult[]> {
  const embedding = await embed(query);
  return similaritySearch(ctx, embedding, 0.5, topK);
}

/**
 * Cross-department vector search — requires super_user or admin role.
 * Raises if called by a regular member.
 */
export async function crossDeptVectorSearch(
  params: Params
): Promise<SearchResult[]> {
  const { ctx } = params;

  if (ctx.user_role !== "super_user" && ctx.user_role !== "admin") {
    throw new Error(
      "Unauthorized: crossDeptVectorSearch requires super_user or admin role"
    );
  }

  return vectorSearch(params);
}

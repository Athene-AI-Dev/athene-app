import { withRLS, type RLSContext } from "./rls-client";

export type SearchResult = {
  id: string;
  document_id: string;
  content_preview: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

/**
 * Performs a vector similarity search within the RLS-protected context.
 * Uses withRLS() so Postgres session vars are set and grants are injected.
 */
export async function similaritySearch(
  context: RLSContext,
  queryEmbedding: number[],
  matchThreshold: number = 0.5,
  matchCount: number = 10
): Promise<SearchResult[]> {
  // Guard against empty embedding — would cause a silent bad RPC call
  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error("[vector] queryEmbedding must be a non-empty array");
  }

  return withRLS(context, async (supabase) => {
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      // Log message separately for cleaner output, then rethrow for caller to handle
      console.error("[vector] similaritySearch RPC failed:", error.message);
      throw error;
    }

    return (data as SearchResult[]) || [];
  });
}

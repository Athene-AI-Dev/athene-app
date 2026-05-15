import { withRLS, type RLSContext } from "./rls-client";
import { logger } from "@/lib/logger";

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
  return withRLS(context, async (supabase) => {
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      logger.error({ err: error?.message ?? String(error) }, "[vector] similaritySearch error");
      throw error;
    }

    return (data as SearchResult[]) || [];
  });
}

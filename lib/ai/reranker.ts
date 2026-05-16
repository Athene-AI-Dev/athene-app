import { logger } from "@/lib/logger";

const JINA_RERANKER_URL = "https://api.jina.ai/v1/rerank";

interface RerankResult {
  index: number;
  relevance_score: number;
}

/**
 * Re-ranks chunks by relevance to the query using the Jina cross-encoder.
 * Falls back to the original order (capped at topN) if the API is unavailable
 * or JINA_API_KEY is not set.
 *
 * Cross-encoders score (query, chunk) jointly, producing significantly better
 * relevance ordering than cosine similarity alone — critical for BI queries
 * that pull large topK windows where tail chunks dilute synthesis quality.
 */
export async function rerankChunks<T extends { content_preview: string }>(
  query: string,
  chunks: T[],
  topN = 10
): Promise<(T & { rerank_score?: number })[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topN) return chunks;

  const jinaKey = process.env.JINA_API_KEY;
  if (!jinaKey) {
    logger.debug({}, "[reranker] JINA_API_KEY not set — using original order");
    return chunks.slice(0, topN);
  }

  try {
    const response = await fetch(JINA_RERANKER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jinaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jina-reranker-v2-base-multilingual",
        query,
        documents: chunks.map((c) => c.content_preview),
        top_n: topN,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jina reranker HTTP ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results ?? []) as RerankResult[];

    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((r) => ({ ...chunks[r.index], rerank_score: r.relevance_score }));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[reranker] API failed — falling back to original order"
    );
    return chunks.slice(0, topN);
  }
}

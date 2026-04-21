import { FetchedChunk } from './base'

/**
 * Placeholder for the indexing pipeline (ATH-28).
 * In a real implementation, this would:
 * 1. Chunk the content if too large
 * 2. Generate embeddings
 * 3. Store in Supabase via RLS-protected vector client
 */
export async function indexDocument(chunk: FetchedChunk, orgId: string) {
  console.log(`[Indexing] ${chunk.title} for org ${orgId}`)
  // Implementation will follow in ATH-28
}

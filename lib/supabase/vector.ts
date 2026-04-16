import { getRLSClient, RLSContext } from './rls-client'

export type SearchResult = {
  id: string
  document_id: string
  content_preview: string
  metadata: any
  similarity: number
}

/**
 * Performs a vector similarity search within the RLS-protected context.
 */
export async function similaritySearch(
  context: RLSContext,
  query_embedding: number[],
  match_threshold: number = 0.5,
  match_count: number = 10
): Promise<SearchResult[]> {
  const supabase = getRLSClient(context)

  // Call the search function
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding,
    match_threshold,
    match_count
  })

  if (error) {
    console.error('Error in similaritySearch:', error)
    throw error
  }

  return (data as SearchResult[]) || []
}

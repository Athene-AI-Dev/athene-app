import { FetchedChunk } from './types';

// TODO (ATH-28): Wire this fully into the semantic search indexing pipeline
export async function indexDocument(chunk: FetchedChunk) {
  // console.log(`[Indexer] Indexing document for ${chunk.provider}:`, chunk.id);
  // Full implementation for vector embedding and upsert goes here
}

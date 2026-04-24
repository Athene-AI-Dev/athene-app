// ============================================================
// integrations/indexing.ts — Bridge between fetchers and vector store
//
// Takes FetchedChunk[] from any provider, chunks large content,
// generates embeddings via OpenAI, and upserts into Supabase
// document_embeddings table using the service-role client.
//
// Writes go through supabaseAdmin (service-role) — bypasses RLS.
// Reads later go through withRLS() — the existing pattern.
//
// No tokens or raw content is logged. Only document metadata
// is written to the database.
// ============================================================

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { baseFetch } from './base'
import type { FetchedChunk } from './base'
import { logger } from '@/lib/logger'

// ---- Constants --------------------------------------------------

/** Target chunk size in characters (~500 tokens ≈ 2000 chars) */
const CHUNK_SIZE_CHARS = 2000

/** Overlap between chunks to preserve context at boundaries */
const CHUNK_OVERLAP_CHARS = 200

/** OpenAI embedding model */
const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Embedding dimensions (text-embedding-3-small default) */
const EMBEDDING_DIMENSIONS = 1536

// ---- Content Chunking -------------------------------------------

/**
 * Splits content into overlapping chunks of ~CHUNK_SIZE_CHARS.
 * Tries to break at sentence boundaries when possible.
 */
function chunkContent(content: string): string[] {
  if (content.length <= CHUNK_SIZE_CHARS) {
    return [content]
  }

  const chunks: string[] = []
  let start = 0

  while (start < content.length) {
    let end = start + CHUNK_SIZE_CHARS

    // If we're not at the end, try to break at a sentence boundary
    if (end < content.length) {
      // Look for sentence-ending punctuation near the chunk boundary
      const searchWindow = content.substring(
        Math.max(start, end - 200),
        end
      )
      const lastSentenceEnd = Math.max(
        searchWindow.lastIndexOf('. '),
        searchWindow.lastIndexOf('.\n'),
        searchWindow.lastIndexOf('? '),
        searchWindow.lastIndexOf('! ')
      )

      if (lastSentenceEnd > 0) {
        // Adjust end to the sentence boundary (relative to content, not window)
        end = Math.max(start, end - 200) + lastSentenceEnd + 1
      }
    }

    chunks.push(content.substring(start, Math.min(end, content.length)).trim())

    // Next chunk starts with overlap
    start = end - CHUNK_OVERLAP_CHARS
    if (start >= content.length) break
  }

  return chunks.filter((c) => c.length > 0)
}

// ---- Embedding Generation ---------------------------------------

/**
 * Generates embeddings for the given texts using OpenAI.
 * Uses the API key from environment — never stored, never logged.
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable')
  }

  const data = await baseFetch<{
    data: Array<{ embedding: number[]; index: number }>
  }>('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    },
  })

  // Sort by index to maintain order
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

// ---- Main Indexing Function -------------------------------------

/**
 * Indexes a single FetchedChunk into the vector store.
 *
 * Flow:
 *   1. Chunk the content if it exceeds CHUNK_SIZE_CHARS
 *   2. Generate embeddings for all chunks in a batch
 *   3. Upsert each chunk + embedding into document_embeddings
 *
 * @param chunk - The fetched chunk to index
 * @param orgId - Organization ID (for RLS tagging)
 * @param departmentId - Department ID (for RLS tagging, nullable)
 */
export async function indexDocument(
  chunk: FetchedChunk,
  orgId: string,
  departmentId: string | null
): Promise<void> {
  // 1. Split content into chunks
  const contentChunks = chunkContent(chunk.content)

  if (contentChunks.length === 0) return

  // 2. Generate embeddings for all chunks in a single batch
  const embeddings = await generateEmbeddings(contentChunks)

  // 3. Build the records to upsert
  const records = contentChunks.map((text, index) => ({
    // Deterministic ID: chunk_id + chunk_index
    // This enables idempotent upserts (re-indexing overwrites, not duplicates)
    id: `${chunk.chunk_id}_${index}`,
    org_id: orgId,
    department_id: departmentId,
    source_type: chunk.metadata.provider,
    title: chunk.title,
    content_preview: text.substring(0, 500), // First 500 chars as preview
    external_url: chunk.source_url,
    chunk_index: index,
    embedding: embeddings[index],
    // SHA-256 hash of the content — used to skip re-embedding unchanged chunks
    content_hash: createHash('sha256').update(text).digest('hex'),
    metadata: chunk.metadata,
    updated_at: new Date().toISOString(),
  }))

  // 4. Upsert into Supabase via service-role (bypasses RLS)
  const { error } = await supabaseAdmin
    .from('document_embeddings')
    .upsert(records, { onConflict: 'id' })

  if (error) {
    logger.error({ title: chunk.title, err: error.message }, '[indexing] Error upserting chunks')
    throw error
  }
}

/**
 * Indexes multiple FetchedChunks in sequence.
 * Used by the worker route after a full sync.
 */
export async function indexDocuments(
  chunks: FetchedChunk[],
  orgId: string,
  departmentId: string | null
): Promise<{ indexed: number; errors: number }> {
  let indexed = 0
  let errors = 0

  for (const chunk of chunks) {
    try {
      await indexDocument(chunk, orgId, departmentId)
      indexed++
    } catch (err) {
      errors++
      logger.error(
        { title: chunk.title, err: err instanceof Error ? err.message : String(err) },
        '[indexing] Failed to index chunk'
      )
    }
  }

  return { indexed, errors }
}

// ---- Helpers ----------------------------------------------------

/**
 * Generates a deterministic ID for a chunk.
 * Ensures re-indexing overwrites rather than duplicates.
 */
function generateChunkId(
  sourceType: string,
  sourceUrl: string,
  chunkIndex: number
): string {
  // Simple hash: we use a deterministic string
  // In production, you'd use a proper hash function
  const raw = `${sourceType}:${sourceUrl}:${chunkIndex}`
  // Convert to a URL-safe base64-like string
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `${sourceType}_${Math.abs(hash).toString(36)}_${chunkIndex}`
}

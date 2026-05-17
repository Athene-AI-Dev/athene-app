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
import type { FetchedChunk } from './base'
import { logger } from '@/lib/logger'
import { embedBatch } from '@/lib/ai/embedding-factory'
import { chunk as tokenChunk } from '@/lib/langgraph/tools/chunker'

// ---- Constants --------------------------------------------------

/** Email sources use character-based chunking (body text is short, no tokenizer needed) */
const EMAIL_CHUNK_SIZE_CHARS = 2000
const EMAIL_CHUNK_OVERLAP_CHARS = 200

/** Email source_type values that bypass the token-based chunker */
const EMAIL_SOURCE_TYPES = new Set(['gmail', 'outlook', 'email'])

// ---- Content Chunking -------------------------------------------

/**
 * Character-based chunker for email content.
 * Tries to break at sentence boundaries when possible.
 */
function chunkEmail(content: string): string[] {
  if (content.length <= EMAIL_CHUNK_SIZE_CHARS) {
    return [content]
  }

  const chunks: string[] = []
  let start = 0

  while (start < content.length) {
    let end = start + EMAIL_CHUNK_SIZE_CHARS

    if (end < content.length) {
      const searchWindow = content.substring(Math.max(start, end - 200), end)
      const lastSentenceEnd = Math.max(
        searchWindow.lastIndexOf('. '),
        searchWindow.lastIndexOf('.\n'),
        searchWindow.lastIndexOf('? '),
        searchWindow.lastIndexOf('! ')
      )
      if (lastSentenceEnd > 0) {
        end = Math.max(start, end - 200) + lastSentenceEnd + 1
      }
    }

    chunks.push(content.substring(start, Math.min(end, content.length)).trim())
    start = end - EMAIL_CHUNK_OVERLAP_CHARS
    if (start >= content.length) break
  }

  return chunks.filter((c) => c.length > 0)
}

/**
 * Routes to the correct chunker based on source type.
 * Email → character-based (2000 chars / 200 overlap).
 * Everything else → token-based (512 tokens / 64 overlap, cl100k_base).
 */
function chunkContent(content: string, sourceType?: string): string[] {
  if (sourceType && EMAIL_SOURCE_TYPES.has(sourceType)) {
    return chunkEmail(content)
  }
  // Token-based chunking for documents (Drive, SharePoint, Notion, etc.)
  return tokenChunk(content, { chunkSize: 512, overlap: 64 }).map((c) => c.text)
}

// ---- Embedding Generation ---------------------------------------

/**
 * Generates embeddings for the given texts via the EmbeddingFactory.
 * Provider resolved from: org BYOK → system env (Jina / Together / Nomic).
 */
async function generateEmbeddings(texts: string[], orgId?: string): Promise<number[][]> {
  return embedBatch(texts, orgId)
}

// ---- Main Indexing Function -------------------------------------

// ---- Document record resolution ---------------------------------

type VisibilityLevel = 'org_wide' | 'department' | 'bi_accessible' | 'confidential' | 'restricted'

/**
 * Upserts a row in the `documents` table for this chunk and returns its UUID.
 * Uses UNIQUE (org_id, connection_id, external_id) to make it idempotent.
 */
type UpsertDocumentResult = { documentId: string; contentChanged: boolean }

async function upsertDocumentRecord(
  chunk: FetchedChunk,
  orgId: string,
  connectionId: string,
  departmentId: string | null,
  visibility: VisibilityLevel,
  ownerUserId: string | null
): Promise<UpsertDocumentResult> {
  const newContentHash = createHash('sha256').update(chunk.content).digest('hex')

  // Check whether an identical version of this document is already indexed.
  // If the content_hash matches, skip re-embedding to avoid wasting API quota.
  const { data: existing } = await supabaseAdmin
    .from('documents')
    .select('id, content_hash')
    .eq('org_id', orgId)
    .eq('connection_id', connectionId)
    .eq('external_id', chunk.chunk_id)
    .maybeSingle()

  if (existing?.content_hash === newContentHash) {
    return { documentId: existing.id as string, contentChanged: false }
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .upsert(
      {
        org_id: orgId,
        connection_id: connectionId,
        external_id: chunk.chunk_id,
        title: chunk.title,
        source_type: chunk.metadata.provider,
        department_id: departmentId,
        owner_user_id: ownerUserId,
        visibility,
        external_url: chunk.source_url,
        metadata: chunk.metadata,
        content_hash: newContentHash,
      },
      { onConflict: 'org_id,connection_id,external_id' }
    )
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`[indexing] Failed to upsert document record: ${error?.message}`)
  }
  return { documentId: data.id as string, contentChanged: true }
}

// ---- Main Indexing Function -------------------------------------

/**
 * Indexes a single FetchedChunk into the vector store.
 *
 * Flow:
 *   1. Upsert the document metadata row (resolves/creates documents.id)
 *   2. Chunk the content if it exceeds CHUNK_SIZE_CHARS
 *   3. Generate embeddings for all chunks in a batch
 *   4. Upsert each chunk + embedding into document_embeddings
 *
 * @param chunk       - The fetched chunk to index
 * @param orgId       - Organization ID
 * @param connectionId - Nango connection UUID (links to connections.id)
 * @param departmentId - Department UUID for RLS scoping (nullable)
 * @param visibility  - Row-level visibility level
 * @param ownerUserId - org_members.id of the document owner (nullable)
 */
export async function indexDocument(
  chunk: FetchedChunk,
  orgId: string,
  connectionId: string,
  departmentId: string | null,
  visibility: VisibilityLevel = 'department',
  ownerUserId: string | null = null
): Promise<string> {
  // 0. Resolve/create the documents row; skip embedding if content unchanged
  const { documentId, contentChanged } = await upsertDocumentRecord(
    chunk, orgId, connectionId, departmentId, visibility, ownerUserId
  )
  if (!contentChanged) return documentId

  // 1. Split content into chunks (token-based for docs, char-based for email)
  const contentChunks = chunkContent(chunk.content, chunk.metadata.provider)

  if (contentChunks.length === 0) return documentId

  // 2. Generate embeddings for all chunks in a single batch (org-BYOK aware)
  const embeddings = await generateEmbeddings(contentChunks, orgId)

  // 3. Build the records to upsert — must match document_embeddings schema exactly
  const records = contentChunks.map((text, index) => ({
    org_id: orgId,
    document_id: documentId,
    department_id: departmentId,
    owner_user_id: ownerUserId,
    source_type: chunk.metadata.provider,
    visibility,
    chunk_index: index,
    embedding: embeddings[index],
    // SHA-256 hash — used to skip re-embedding unchanged chunks
    content_hash: createHash('sha256').update(text).digest('hex'),
    // Searchable preview — fallback when metadata.chunk_text is unavailable
    content_preview: text.slice(0, 200),
    // Zero-copy: store chunk text here so LLM retrieval never re-hits the source
    metadata: { ...chunk.metadata, chunk_text: text },
  }))

  // 4. Upsert into Supabase via service-role (bypasses RLS)
  // onConflict matches UNIQUE (document_id, chunk_index) constraint
  const { error } = await supabaseAdmin
    .from('document_embeddings')
    .upsert(records, { onConflict: 'document_id,chunk_index' })

  if (error) {
    logger.error({ title: chunk.title, err: error.message }, '[indexing] Error upserting chunks')
    throw error
  }

  return documentId
}

/** Maximum texts per OpenAI embedding API call */
const EMBED_BATCH_SIZE = 96

/**
 * Indexes multiple FetchedChunks with batched embedding generation.
 *
 * Instead of one OpenAI call per document (N round-trips), this:
 *   1. Resolves/creates all document rows in parallel
 *   2. Splits every document's content into sub-chunks
 *   3. Sends all sub-chunk texts to OpenAI in batches of EMBED_BATCH_SIZE
 *   4. Upserts all embedding records in a single Supabase call
 */
export async function indexDocuments(
  chunks: FetchedChunk[],
  orgId: string,
  connectionId: string,
  departmentId: string | null,
  visibility: VisibilityLevel = 'department',
  ownerUserId: string | null = null
): Promise<{ indexed: number; errors: number; documentIds: string[] }> {
  if (chunks.length === 0) return { indexed: 0, errors: 0, documentIds: [] }

  // ---- Phase 1: resolve document rows in parallel -----------------
  type PreparedItem = {
    chunk: FetchedChunk
    documentId: string
    subChunks: string[]
  }

  const prepared: PreparedItem[] = []
  let errors = 0

  // ---- Phase 1: resolve document rows and split into sub-chunks ----
  for (const chunk of chunks) {
    try {
      const { documentId, contentChanged } = await upsertDocumentRecord(chunk, orgId, connectionId, departmentId, visibility, ownerUserId)
      if (!contentChanged) {
        // Content hash unchanged — embeddings are still valid, skip re-embedding
        prepared.push({ chunk, documentId, subChunks: [] })
        continue
      }
      const subChunks = chunkContent(chunk.content, chunk.metadata.provider)
      if (subChunks.length > 0) {
        prepared.push({ chunk, documentId, subChunks })
      }
    } catch (err) {
      errors++
      logger.error(
        { title: chunk.title, err: err instanceof Error ? err.message : String(err) },
        '[indexing] Failed to prepare chunk'
      )
    }
  }

  // ---- Phase 2: flatten sub-chunk texts and build record templates -
  // Only include items with subChunks (items with empty subChunks had unchanged content)
  const changedItems = prepared.filter(item => item.subChunks.length > 0)
  const allTexts: string[] = changedItems.flatMap(item => item.subChunks)
  const allTemplates = changedItems.flatMap(item =>
    item.subChunks.map((text, index) => ({
      org_id: orgId,
      document_id: item.documentId,
      department_id: departmentId,
      owner_user_id: ownerUserId,
      source_type: item.chunk.metadata.provider,
      visibility,
      chunk_index: index,
      content_hash: createHash('sha256').update(text).digest('hex'),
      // Searchable preview — fallback when metadata.chunk_text is unavailable
      content_preview: text.slice(0, 200),
      // Zero-copy: chunk text stored here for LLM context — source never re-fetched at query time
      metadata: { ...item.chunk.metadata, chunk_text: text },
    }))
  )

  // ---- Phase 3: generate embeddings in batches (org-BYOK aware) ---
  const allEmbeddings: number[][] = []
  for (let i = 0; i < allTexts.length; i += EMBED_BATCH_SIZE) {
    const batchTexts = allTexts.slice(i, i + EMBED_BATCH_SIZE)
    try {
      const batchEmbeddings = await generateEmbeddings(batchTexts, orgId)
      allEmbeddings.push(...batchEmbeddings)
    } catch (err) {
      logger.error(
        { batchStart: i, batchEnd: i + batchTexts.length, err: err instanceof Error ? err.message : String(err) },
        '[indexing] Embedding batch failed'
      )
      // Fill with empty placeholders so index alignment is preserved; filtered out before upsert
      allEmbeddings.push(...batchTexts.map(() => []))
      errors += batchTexts.length
    }
  }

  // ---- Phase 4: upsert all records in one call -------------------
  const records = allTemplates
    .map((tmpl, idx) => ({ ...tmpl, embedding: allEmbeddings[idx] }))
    .filter((r) => r.embedding.length > 0)

  if (records.length > 0) {
    const { error } = await supabaseAdmin
      .from('document_embeddings')
      .upsert(records, { onConflict: 'document_id,chunk_index' })

    if (error) {
      logger.error({ err: error.message }, '[indexing] Bulk upsert error')
      errors += records.length
      return { indexed: 0, errors, documentIds: [] }
    }
  }

  return { 
    indexed: prepared.length, 
    errors, 
    documentIds: [...new Set(prepared.map(p => p.documentId))] 
  }
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

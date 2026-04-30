// ============================================================
// knowledge-graph/builder.ts — Graph builder (ATH-60)
//
// Triggered after every indexing batch by the graph-build worker.
// For each document: loads chunks from document_embeddings, runs
// the entity extractor (ATH-58), then upserts nodes/edges (ATH-59).
//
// SHA-256 content-hash dedup: if a document's content_hash hasn't
// changed since the last extraction we skip it entirely.
//
// Runs asynchronously via QStash so it never blocks the main
// indexing flow (ATH-44 wires this in after index-delta completes).
// ============================================================

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/server'
import { extractEntitiesAndRelations } from './extractor'
import { upsertNodes, upsertEdges, deleteByDocument } from './storage'
import { detectCommunities } from './community'
import type { RLSContext } from '@/lib/supabase/rls-client'

// ---- Types --------------------------------------------------

export type BuildMode = 'incremental' | 'full'

export interface BuildResult {
  processedDocs: number
  skippedDocs: number
  totalNodes: number
  totalEdges: number
  errors: string[]
}

// ---- Core builder -------------------------------------------

/**
 * Build or update the knowledge graph for the given documents.
 *
 * @param orgId       - The organization to build for.
 * @param documentIds - Specific document IDs to process (incremental).
 *                      Pass empty array for full rebuild (caller must set mode='full').
 * @param mode        - 'incremental' processes only given IDs;
 *                      'full' queries all doc IDs for the org.
 */
export async function buildGraphForDocuments(
  orgId: string,
  documentIds: string[],
  mode: BuildMode = 'incremental',
): Promise<BuildResult> {
  const result: BuildResult = {
    processedDocs: 0,
    skippedDocs: 0,
    totalNodes: 0,
    totalEdges: 0,
    errors: [],
  }

  // ── Resolve the full list of docs to process ──────────────
  let docIds = documentIds

  if (mode === 'full') {
    const { data: allDocs, error } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('org_id', orgId)

    if (error) throw new Error(`[builder] Failed to list documents: ${error.message}`)
    docIds = (allDocs ?? []).map((d: { id: string }) => d.id)
  }

  if (docIds.length === 0) return result

  // ── Process each document ─────────────────────────────────
  for (const docId of docIds) {
    try {
      const processed = await processDocument(orgId, docId, result)
      if (processed) result.processedDocs++
      else result.skippedDocs++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[builder] Error processing doc ${docId}:`, msg)
      result.errors.push(`${docId}: ${msg}`)
    }
  }

  // ── Community detection pass ──────────────────────────────
  // After all docs processed, assign community IDs to connected nodes.
  if (result.processedDocs > 0) {
    try {
      await detectCommunities(orgId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[builder] Community detection failed:', msg)
      result.errors.push(`community: ${msg}`)
    }
  }

  return result
}

// ---- Per-document processing --------------------------------

async function processDocument(
  orgId: string,
  docId: string,
  result: BuildResult,
): Promise<boolean> {
  // 1. Load the document metadata for content_hash dedup check
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('documents')
    .select('id, org_id, connection_id, external_id, source_type, content_hash, last_extracted_hash, dept_id, visibility')
    .eq('id', docId)
    .eq('org_id', orgId)
    .single()

  if (docErr || !doc) {
    throw new Error(`Document not found: ${docId}`)
  }

  // 2. SHA-256 skip: if content_hash unchanged since last extraction, skip
  if (doc.content_hash && doc.last_extracted_hash === doc.content_hash) {
    return false // skipped
  }

  // 3. Load all chunks from document_embeddings (content is in RAM, not stored)
  const { data: chunks, error: chunkErr } = await supabaseAdmin
    .from('document_embeddings')
    .select('chunk_id, chunk_index')
    .eq('document_id', docId)
    .eq('org_id', orgId)
    .order('chunk_index', { ascending: true })

  if (chunkErr) throw new Error(`Failed to load chunks: ${chunkErr.message}`)
  if (!chunks || chunks.length === 0) return false

  // 4. Rule #2 Fix: Re-fetch full content from source for extraction
  // Since we don't store text, we must hydrate from the provider.
  const { liveDocFetch } = await import('@/lib/langgraph/tools/live-doc-fetch')
  const fetchedChunks = await liveDocFetch(
    doc.source_type,
    doc.connection_id,
    doc.org_id,
    { limit: 1000 } // Safety limit
  )

  // Find the specific content for this document
  const fullContent = fetchedChunks.find(c => c.chunk_id === doc.external_id)?.content
  if (!fullContent) {
    throw new Error(`Failed to re-fetch content from ${doc.source_type} for ${docId}`)
  }

  // 5. Build RLS context for storage writes
  const ctx: RLSContext = {
    org_id: orgId,
    user_id: 'system',
    user_role: 'admin',
  }

  // 6. Delete existing graph contributions from this document
  await deleteByDocument(ctx, docId)

  // 7. Run entity/relation extraction
  // We use the full content and the same chunker as indexing to ensure index alignment
  const { chunk: chunkText } = await import('@/lib/langgraph/tools/chunker')
  const rawChunks = chunkText(fullContent)

  const extractorChunks = rawChunks.map((c) => ({
    text: c.text,
    chunk_index: c.chunk_index,
    org_id: orgId,
    document_id: docId,
    department_id: doc.dept_id ?? undefined,
    visibility: (doc.visibility ?? 'department') as 'public' | 'department' | 'private',
  }))

  const { nodes, edges } = await extractEntitiesAndRelations(extractorChunks)

  if (nodes.length === 0 && edges.length === 0) {
    await markExtracted(orgId, docId, doc.content_hash)
    return true
  }

  // 8. Upsert nodes and edges into the graph
  const nodeIdMap = await upsertNodes(ctx, nodes)
  await upsertEdges(ctx, edges, nodeIdMap)

  result.totalNodes += nodes.length
  result.totalEdges += edges.length

  // 9. Mark document as extracted
  await markExtracted(orgId, docId, doc.content_hash)

  return true
}

// ---- Hash stamp ---------------------------------------------

async function markExtracted(
  org_id: string,
  doc_id: string,
  content_hash: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({ last_extracted_hash: content_hash })
    .eq('id', doc_id)
    .eq('org_id', org_id)

  if (error) {
    throw new Error(`Failed to mark extracted: ${error.message}`)
  }
}

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
import { logger } from '@/lib/logger'


// ---- Types --------------------------------------------------

export type BuildMode = 'incremental' | 'full'

export interface BuildResult {
  processedDocs: number
  skippedDocs: number
  totalNodes: number
  totalEdges: number
  errors: string[]
  remainingDocs: string[] // ATH-60: for recursive re-enqueuing
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
    remainingDocs: [],
  }


  // ── Resolve the full list of docs to process ──────────────
  let docIds = documentIds

  if (mode === 'full') {
    const { data: allDocs, error } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('org_id', orgId)

    docIds = (allDocs ?? []).map((d: { id: string }) => d.id)
  }

  // ATH-60 safety: limit document count per job to prevent timeout (Serverless limit)
  // We process 20 docs and re-enqueue the rest.
  const BATCH_SIZE = 20
  if (docIds.length > BATCH_SIZE) {
    result.remainingDocs = docIds.slice(BATCH_SIZE)
    docIds = docIds.slice(0, BATCH_SIZE)
    logger.info({ orgId, currentBatch: docIds.length, remaining: result.remainingDocs.length }, "[builder] Large batch detected; splitting for recursive processing")
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
      logger.error({ orgId, docId, err: msg }, "[builder] Error processing document")
      result.errors.push(`${docId}: ${msg}`)
    }
  }

  // ── Community detection pass ──────────────────────────────
  // After all docs processed in the current batch, assign community IDs.
  // NOTE: We only run this if no more docs are remaining to process for the whole job.
  if (result.processedDocs > 0 && result.remainingDocs.length === 0) {
    try {
      await detectCommunities(orgId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error({ orgId, err: msg }, "[builder] Community detection failed")
      // We don't block the extraction result, but we log the error for ATH-61
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

  // 3. Rule #2 Fix: Re-fetch full content from source for extraction (Zero-Storage hydration)
  // Since we don't store text, we must hydrate from the provider in real-time.
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

  // 4. Build RLS context for storage writes
  const ctx: RLSContext = {
    org_id: orgId,
    user_id: 'system',
    user_role: 'admin',
  }

  // 5. Delete existing graph contributions from this document before re-extraction
  await deleteByDocument(ctx, docId)

  // 6. Run entity/relation extraction
  // We use the full content and the same chunker as indexing to ensure index alignment
  const { chunk: chunkText } = await import('@/lib/langgraph/tools/chunker')
  const rawChunks = chunkText(fullContent)

  const extractorChunks = rawChunks.map((c) => ({
    text: c.text,
    chunk_index: c.chunk_index,
    org_id: orgId,
    document_id: docId,
    department_id: doc.dept_id ?? undefined,
    visibility: (doc.visibility ?? 'team') as 'public' | 'team' | 'private',
  }))

  const { nodes, edges } = await extractEntitiesAndRelations(extractorChunks)

  // BUG-12 FIX: Only update global counters after full success
  if (nodes.length > 0 || edges.length > 0) {
    // 7. Upsert nodes and edges into the graph
    const nodeIdMap = await upsertNodes(ctx, nodes)
    await upsertEdges(ctx, edges, nodeIdMap)

    result.totalNodes += nodes.length
    result.totalEdges += edges.length
  }

  // 8. Mark document as extracted
  // BUG-15 FIX: Skip if content_hash is null to avoid disabling dedup permanently
  if (doc.content_hash) {
    await markExtracted(orgId, docId, doc.content_hash)
  }

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


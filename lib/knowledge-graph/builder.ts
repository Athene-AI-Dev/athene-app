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
    .select('id, content_hash, last_extracted_hash, dept_id, visibility')
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

  // 3. Process chunks in batches to avoid memory overflow (ATH-60)
  const CHUNK_BATCH_SIZE = 50
  let offset = 0
  let hasMoreChunks = true

  // BUG-12 FIX: Accumulate counts locally to ensure global counters only update on full success
  let docNodes = 0
  let docEdges = 0

  while (hasMoreChunks) {
    const { data: chunks, error: chunkErr } = await supabaseAdmin
      .from('document_embeddings')
      .select('chunk_id, metadata, chunk_index')
      .eq('document_id', docId)
      .eq('org_id', orgId)
      .order('chunk_index', { ascending: true })
      .range(offset, offset + CHUNK_BATCH_SIZE - 1)

    if (chunkErr) throw new Error(`Failed to load chunks: ${chunkErr.message}`)
    if (!chunks || chunks.length === 0) {
      hasMoreChunks = false
      continue
    }

    // 4. Build RLS context for storage writes
    const ctx: RLSContext = {
      org_id: orgId,
      user_id: 'system',
      user_role: 'admin',
    }

    // 5. Delete existing graph contributions (only on the FIRST batch)
    if (offset === 0) {
      await deleteByDocument(ctx, docId)
    }

    // 6. Run entity/relation extraction
    // ATH-58: extractor.ts expects chunks with { text, chunk_index, org_id, document_id, department_id, visibility }
    const extractorChunks = chunks.map((c: any) => ({
      text: c.metadata?.text_preview ?? '',
      chunk_index: c.chunk_index ?? 0,
      org_id: orgId,
      document_id: docId,
      department_id: doc.dept_id ?? undefined,
      visibility: (doc.visibility ?? 'team') as 'public' | 'team' | 'private',
    }))

    const { nodes, edges } = await extractEntitiesAndRelations(extractorChunks)

    if (nodes.length > 0 || edges.length > 0) {
      // 7. Upsert nodes and edges into the graph
      const nodeIdMap = await upsertNodes(ctx, nodes)
      await upsertEdges(ctx, edges, nodeIdMap)

      docNodes += nodes.length
      docEdges += edges.length
    }

    offset += CHUNK_BATCH_SIZE
    if (chunks.length < CHUNK_BATCH_SIZE) {
      hasMoreChunks = false
    }
  }

  // 8. Mark document as extracted with the current content_hash
  // BUG-15 FIX: Skip if content_hash is null to avoid disabling dedup permanently
  if (doc.content_hash) {
    await markExtracted(orgId, docId, doc.content_hash)
  }

  // BUG-12 FIX: Only update global counters after full success
  result.totalNodes += docNodes
  result.totalEdges += docEdges

  return true
}

// ---- Hash stamp ---------------------------------------------

async function markExtracted(
  orgId: string,
  docId: string,
  contentHash: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({ last_extracted_hash: contentHash })
    .eq('id', docId)
    .eq('org_id', orgId)

  if (error) {
    console.error(`[builder] Failed to mark extracted for ${docId}:`, error.message)
  }
}

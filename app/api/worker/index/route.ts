export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ============================================================
// app/api/worker/index/route.ts — Delta re-index worker
//
// QStash-triggered worker that re-fetches and re-indexes a
// specific set of already-known document IDs (e.g. after an
// admin edit, or a targeted content refresh).
//
// Payload: { org_id, document_ids[] }
//
// Flow:
//   1. Verify QStash signature
//   2. Parse and validate payload
//   3. Re-fetch each document via liveDocFetch
//   4. Batch-index the fetched chunks (embed + upsert)
//   5. Enqueue graph-build with the processed document IDs
//
// NOTE: This is a DELTA re-indexer — it expects documents to
// already have rows in the documents table. For initial ingestion
// (first sync after connecting a provider) use /api/worker/nango-fetch.
// ============================================================

import { NextResponse } from 'next/server';
import { verifyQStashSignature, checkIdempotency } from '@/lib/qstash/verify';
import { qstash } from '@/lib/qstash/client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { indexDocuments } from '@/lib/integrations/indexing';
import { liveDocFetch } from '@/lib/langgraph/tools/live-doc-fetch';

// ---- Types -------------------------------------------------------

interface IndexPayload {
  org_id: string;
  document_ids: string[];
}

interface BatchItem {
  chunk: any;
  connectionId: string;
  deptId: string | null;
  visibility: string;
}

// ---- POST handler ------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verify QStash signature
  const isValid = await verifyQStashSignature(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  // 2. Check idempotency
  const isFirstTime = await checkIdempotency(request);
  if (!isFirstTime) {
    logger.info('[index] Skipping duplicate job (idempotency)');
    return NextResponse.json({ status: 'ok', skipped: 'duplicate' });
  }

  // 3. Parse payload
  let payload: IndexPayload;
  try {
    payload = (await request.json()) as IndexPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { org_id, document_ids } = payload;

  if (!org_id || !Array.isArray(document_ids) || document_ids.length === 0) {
    return NextResponse.json(
      { error: 'Missing required fields: org_id, document_ids (non-empty array)' },
      { status: 400 }
    );
  }

  logger.info({ org_id, docsCount: document_ids.length }, '[index] Processing delta re-index');

  try {
    // 4. Fetch document details to get connection info
    const { data: docs, error: fetchErr } = await supabaseAdmin
      .from('documents')
      .select('id, external_id, source_type, connection_id, department_id, visibility')
      .in('id', document_ids)
      .eq('org_id', org_id);

    if (fetchErr) throw fetchErr;
    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: 'Documents not found' }, { status: 404 });
    }

    // 5. Reset extracted hashes to force graph-build to re-process them
    const { error: resetErr } = await supabaseAdmin
      .from('documents')
      .update({ last_extracted_hash: null })
      .eq('org_id', org_id)
      .in('id', document_ids);

    if (resetErr) {
      logger.error({ org_id, err: resetErr.message }, '[index] Failed to reset extracted hashes');
    }

    // 6. Re-fetch content and batch index
    const chunksToBatch: BatchItem[] = [];

    for (const doc of docs) {
      try {
        const fetchedChunks = await liveDocFetch(
          doc.source_type,
          doc.connection_id,
          org_id,
          { limit: 1000 }
        );

        const targetChunk = fetchedChunks.find((c: any) => c.chunk_id === doc.external_id);
        if (targetChunk) {
          chunksToBatch.push({
            chunk: targetChunk,
            connectionId: doc.connection_id,
            deptId: doc.department_id,
            visibility: doc.visibility || 'department',
          });
        }
      } catch (docErr) {
        logger.error(
          { org_id, docId: doc.id, err: docErr instanceof Error ? docErr.message : String(docErr) },
          '[index] Failed to re-fetch document content'
        );
      }
    }

    // Group by connectionId so indexDocuments gets a consistent FK per batch
    const byConnection = chunksToBatch.reduce((acc, item) => {
      if (!acc[item.connectionId]) acc[item.connectionId] = [];
      acc[item.connectionId].push(item);
      return acc;
    }, {} as Record<string, BatchItem[]>);

    const results = await Promise.all(
      Object.entries(byConnection).map(([connId, items]) =>
        indexDocuments(
          items.map((i) => i.chunk),
          org_id,
          connId,
          items[0].deptId,
          items[0].visibility as any
        )
      )
    );

    const totalIndexed = results.reduce((sum, r) => sum + r.indexed, 0);

    // 7. Enqueue graph-build for the document set
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      throw new Error('NEXT_PUBLIC_APP_URL is not configured; cannot enqueue graph-build');
    }

    await qstash.publishJSON({
      url: `${appUrl}/api/worker/graph-build`,
      body: { org_id, document_ids, job_type: 'incremental' },
    });

    logger.info(
      { org_id, totalIndexed, totalRequested: document_ids.length },
      '[index] Re-index completed and graph-build enqueued'
    );

    return NextResponse.json({
      status: 'ok',
      org_id,
      indexed: totalIndexed,
      document_ids_queued: document_ids.length,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ org_id, err: message }, '[index] Fatal error');
    return NextResponse.json({ error: `Re-index failed: ${message}` }, { status: 500 });
  }
}

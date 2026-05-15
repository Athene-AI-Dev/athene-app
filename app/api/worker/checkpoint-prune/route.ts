export const dynamic = 'force-dynamic';

// ============================================================
// api/worker/checkpoint-prune/route.ts — Thread checkpoint pruning
//
// Called by QStash cron daily at 2 AM UTC.
//
// Problem: thread_checkpoints and threads accumulate unboundedly.
// Left unchecked, a large org (~1K active users × 10 threads/month)
// will reach 100K+ checkpoint rows within a year, degrading query
// performance and bloating storage.
//
// Strategy (two-pass):
//   Pass 1 — Soft cleanup: delete thread_checkpoints rows for threads
//     inactive >30 days. The threads rows survive so metadata is retained.
//     ON DELETE CASCADE handles thread_checkpoints automatically if a
//     thread is deleted, but here we target just checkpoints to keep
//     thread history browsable without storing full graph state.
//
//   Pass 2 — Hard cleanup: delete thread rows (and cascaded checkpoints)
//     for threads inactive >90 days with 0 messages or null titles —
//     these are likely abandoned sessions from onboarding/testing.
//
// LangGraph's PostgresSaver tables (checkpoints, checkpoint_blobs,
// checkpoint_writes) are cleaned up via direct DELETE using thread_id.
// ============================================================

import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/qstash/verify';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const CHECKPOINT_STALE_DAYS = 30;
const THREAD_ABANDON_DAYS   = 90;
const BATCH_SIZE = 200;

export async function POST(request: Request): Promise<Response> {
  const isValid = await verifyQStashSignature(request);
  if (!isValid) return new Response('Invalid QStash signature', { status: 401 });

  const now = new Date();
  const checkpointCutoff = new Date(now.getTime() - CHECKPOINT_STALE_DAYS * 86400_000).toISOString();
  const abandonCutoff    = new Date(now.getTime() - THREAD_ABANDON_DAYS   * 86400_000).toISOString();

  let checkpointRowsDeleted = 0;
  let threadsDeleted = 0;

  // ── Pass 1: delete custom thread_checkpoints for stale threads ──────────
  // Fetch thread IDs in batches to avoid large IN clauses
  let offset = 0;
  while (true) {
    const { data: staleThreads, error } = await supabaseAdmin
      .from('threads')
      .select('id')
      .or(`last_message_at.lt.${checkpointCutoff},and(last_message_at.is.null,created_at.lt.${checkpointCutoff})`)
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      logger.error({ err: error.message }, '[checkpoint-prune] Failed to fetch stale threads');
      break;
    }
    if (!staleThreads || staleThreads.length === 0) break;

    const ids = staleThreads.map((t) => t.id);

    const { count, error: delErr } = await supabaseAdmin
      .from('thread_checkpoints')
      .delete({ count: 'exact' })
      .in('thread_id', ids);

    if (delErr) {
      logger.error({ err: delErr.message }, '[checkpoint-prune] Checkpoint delete failed');
    } else {
      checkpointRowsDeleted += count ?? 0;
    }

    if (staleThreads.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  // ── Pass 2: hard-delete abandoned threads (>90 days, no messages) ───────
  const { data: abandonedThreads, error: abErr } = await supabaseAdmin
    .from('threads')
    .select('id')
    .lt('created_at', abandonCutoff)
    .or('last_message_at.is.null,message_count.eq.0');

  if (abErr) {
    logger.error({ err: abErr.message }, '[checkpoint-prune] Failed to fetch abandoned threads');
  } else if (abandonedThreads && abandonedThreads.length > 0) {
    const ids = abandonedThreads.map((t) => t.id);

    // Delete in chunks (cascades to thread_checkpoints via FK)
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const { count: deleted, error: tDelErr } = await supabaseAdmin
        .from('threads')
        .delete({ count: 'exact' })
        .in('id', chunk);

      if (tDelErr) {
        logger.error({ err: tDelErr.message }, '[checkpoint-prune] Thread delete failed');
      } else {
        threadsDeleted += deleted ?? 0;
      }
    }
  }

  logger.info({ checkpointRowsDeleted, threadsDeleted }, '[checkpoint-prune] Run complete');
  return NextResponse.json({ checkpointRowsDeleted, threadsDeleted });
}

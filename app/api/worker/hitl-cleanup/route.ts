export const dynamic = 'force-dynamic';

// ============================================================
// api/worker/hitl-cleanup/route.ts — HITL stale-approval cleanup
//
// Called by QStash cron every 30 minutes.
//
// Problem it solves:
//   The agent route auto-rejects stale HITL approvals only when
//   the user sends a NEW message. If the user never returns, the
//   thread stays locked in awaiting_approval=true forever.
//
// Flow:
//   1. Verify QStash signature
//   2. Find threads updated in last 7 days (scope to recent activity)
//   3. For each thread, load LangGraph checkpoint state
//   4. If awaiting_approval=true and requested_at >24h ago:
//      a. Audit-log the auto-reject in hitl_decisions
//      b. Clear awaiting_approval + pending_write_action from state
// ============================================================

import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/qstash/verify';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgentGraph } from '@/lib/langgraph/graph';
import { logHitlDecision } from '@/lib/graph/interrupts';
import { logger } from '@/lib/logger';

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOOK_BACK_DAYS = 7;

export async function POST(request: Request): Promise<Response> {
  const isValid = await verifyQStashSignature(request);
  if (!isValid) return new Response('Invalid QStash signature', { status: 401 });

  const since = new Date(Date.now() - LOOK_BACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: threads, error: threadsErr } = await supabaseAdmin
    .from('threads')
    .select('id, org_id, user_id')
    .gte('updated_at', since);

  if (threadsErr) {
    logger.error({ err: threadsErr.message }, '[hitl-cleanup] Failed to load threads');
    return NextResponse.json({ error: threadsErr.message }, { status: 500 });
  }

  if (!threads || threads.length === 0) {
    return NextResponse.json({ cleaned: 0, checked: 0 });
  }

  const graph = await getAgentGraph();
  let checked = 0;
  let cleaned = 0;

  for (const thread of threads) {
    checked++;
    try {
      const state = await graph.getState({ configurable: { thread_id: thread.id } });
      if (!state?.values?.awaiting_approval) continue;

      const pendingAction = state.values.pending_write_action as {
        tool?: string;
        payload?: Record<string, unknown>;
        requested_at?: string;
      } | null;

      const requestedAt = pendingAction?.requested_at
        ? new Date(pendingAction.requested_at)
        : null;

      if (!requestedAt || Date.now() - requestedAt.getTime() <= STALE_MS) continue;

      // Audit log the auto-reject so the hitl_decisions trail stays complete
      try {
        await logHitlDecision({
          orgId: thread.org_id,
          threadId: thread.id,
          userId: thread.user_id,
          actionType: pendingAction?.tool ?? 'unknown',
          decision: 'reject',
          originalPayload: pendingAction?.payload ?? {},
          editedPayload: null,
        });
      } catch (auditErr) {
        // Non-fatal — still clear the lock so the thread becomes usable
        logger.warn({ threadId: thread.id, err: auditErr }, '[hitl-cleanup] Audit log failed (non-fatal)');
      }

      // Clear the stale lock from the checkpoint state
      await graph.updateState(
        { configurable: { thread_id: thread.id } },
        { awaiting_approval: false, pending_write_action: null }
      );

      cleaned++;
      logger.info({ threadId: thread.id, requestedAt }, '[hitl-cleanup] Auto-rejected stale HITL approval');
    } catch (err) {
      logger.error({ threadId: thread.id, err: err instanceof Error ? err.message : String(err) }, '[hitl-cleanup] Error processing thread');
    }
  }

  logger.info({ checked, cleaned }, '[hitl-cleanup] Run complete');
  return NextResponse.json({ checked, cleaned });
}

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { resolveUserAccess } from '@/lib/auth/rbac';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return new Response('Unauthorized', { status: 401 });

  const access = await resolveUserAccess(userId, orgId, orgRole);
  if (access.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const internalOrgId = access.internal_org_id;
  if (!internalOrgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const [
    docsRes,
    connectionsRes,
    threadsRes,
    briefingsRes,
    hitlRes,
  ] = await Promise.all([
    // Docs per source — group by source_type
    supabaseAdmin
      .from('documents')
      .select('source_type, id')
      .eq('org_id', internalOrgId),

    // Connections with status + last sync
    supabaseAdmin
      .from('connections')
      .select('provider, source_type, status, last_synced_at, created_at')
      .eq('org_id', internalOrgId)
      .order('created_at', { ascending: false }),

    // Thread + message stats (all threads — we filter by date in JS)
    supabaseAdmin
      .from('threads')
      .select('id, message_count, created_at, last_message_at')
      .eq('org_id', internalOrgId)
      .order('last_message_at', { ascending: false }),

    // Briefings count this month
    supabaseAdmin
      .from('briefings')
      .select('id, generated_at')
      .eq('org_id', internalOrgId)
      .gte('generated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

    // HITL decisions total
    supabaseAdmin
      .from('hitl_decisions')
      .select('id, decision, decided_at')
      .eq('org_id', internalOrgId),
  ]);

  // Surface any DB errors — don't silently return zeros
  const queryErrors = [docsRes.error, connectionsRes.error, threadsRes.error, briefingsRes.error, hitlRes.error]
    .filter(Boolean);
  if (queryErrors.length) {
    return NextResponse.json({ error: queryErrors[0]!.message }, { status: 500 });
  }

  // Docs per source_type
  const docsBySource: Record<string, number> = {};
  for (const doc of docsRes.data ?? []) {
    const key = doc.source_type ?? 'unknown';
    docsBySource[key] = (docsBySource[key] ?? 0) + 1;
  }

  // Connection health summary
  const connections = (connectionsRes.data ?? []).map((c) => ({
    provider: c.provider,
    source_type: c.source_type,
    status: c.status,
    last_synced_at: c.last_synced_at ?? null,
  }));

  const connectionsByStatus = {
    active: connections.filter((c) => c.status === 'active').length,
    syncing: connections.filter((c) => c.status === 'syncing').length,
    error: connections.filter((c) => c.status === 'error').length,
  };

  // Thread + query stats
  const threads = threadsRes.data ?? [];
  const totalThreads = threads.length;
  const totalMessages = threads.reduce((sum, t) => sum + (t.message_count ?? 0), 0);
  const sevenDaysAgo = Date.now() - 7 * 86400_000;
  const activeThreads = threads.filter((t) => {
    if (!t.last_message_at) return false;
    return new Date(t.last_message_at).getTime() > sevenDaysAgo;
  });
  const messagesThisWeek = activeThreads.reduce((sum, t) => sum + (t.message_count ?? 0), 0);
  const activeThreadsCount = activeThreads.length;

  // HITL breakdown
  const hitlDecisions = hitlRes.data ?? [];
  const hitlBreakdown = {
    total: hitlDecisions.length,
    approved: hitlDecisions.filter((d) => d.decision === 'approved').length,
    rejected: hitlDecisions.filter((d) => d.decision === 'rejected').length,
    edited: hitlDecisions.filter((d) => d.decision === 'edited').length,
  };

  return NextResponse.json({
    docs: {
      total: docsRes.data?.length ?? 0,
      by_source: docsBySource,
    },
    connections: {
      total: connections.length,
      by_status: connectionsByStatus,
      list: connections,
    },
    queries: {
      total_threads: totalThreads,
      total_messages: totalMessages,
      messages_7d: messagesThisWeek,
      active_threads_7d: activeThreadsCount,
    },
    briefings: {
      this_month: briefingsRes.data?.length ?? 0,
    },
    hitl: hitlBreakdown,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });

    // Resolve internal org
    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgRow) {
      return NextResponse.json({
        stats: { documents: 0, knowledge_nodes: 0, actions: 0, integrations: 0 },
        recent_orchestrations: []
      });
    }

    const internalOrgId = orgRow.id;

    // Fetch counts in parallel — log individual failures but don't crash
    const [
      { count: docsCount, error: docsErr },
      { count: nodesCount, error: nodesErr },
      { count: actionsCount, error: actionsErr },
      { count: connectionsCount, error: connErr },
      { data: recentDecisions, error: decisionsErr },
      { count: briefingsCount, error: briefingsErr }
    ] = await Promise.all([
      supabaseAdmin.from("documents").select("*", { count: "exact", head: true }).eq("org_id", internalOrgId),
      supabaseAdmin.from("kg_nodes").select("*", { count: "exact", head: true }).eq("org_id", internalOrgId),
      supabaseAdmin.from("hitl_decisions").select("*", { count: "exact", head: true }).eq("org_id", internalOrgId),
      supabaseAdmin.from("connections").select("*", { count: "exact", head: true }).eq("org_id", internalOrgId),
      supabaseAdmin
        .from("hitl_decisions")
        .select("id, action_type, decided_at, decision")
        .eq("org_id", internalOrgId)
        .order("decided_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("briefings")
        .select("id", { count: "exact", head: true })
        .eq("org_id", internalOrgId)
        .gte("generated_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    ]);

    // Log individual query errors without crashing the whole response
    if (docsErr) logger.error({ err: docsErr.message }, "[dashboard/stats] documents query");
    if (nodesErr) logger.error({ err: nodesErr.message }, "[dashboard/stats] kg_nodes query");
    if (actionsErr) logger.error({ err: actionsErr.message }, "[dashboard/stats] hitl_decisions count");
    if (connErr) logger.error({ err: connErr.message }, "[dashboard/stats] connections query");
    if (decisionsErr) logger.error({ err: decisionsErr.message }, "[dashboard/stats] recent decisions");
    if (briefingsErr) logger.error({ err: briefingsErr.message }, "[dashboard/stats] briefings count");

    const decisionStatusMap: Record<string, string> = {
      approved: 'Success',
      rejected: 'Failed',
      edited: 'Edited',
    };

    return NextResponse.json({
      stats: {
        documents: docsCount ?? 0,
        knowledge_nodes: nodesCount ?? 0,
        actions: actionsCount ?? 0,
        integrations: connectionsCount ?? 0,
        briefings_this_month: briefingsCount ?? 0,
      },
      recent_orchestrations: (recentDecisions ?? []).map(d => ({
        id: (d.id ?? '').slice(0, 8).toUpperCase(),
        // Guard against empty/null action_type
        label: (d.action_type || 'Unknown Action')
          .split('-')
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' '),
        time: d.decided_at,
        status: decisionStatusMap[d.decision] ?? 'Pending',
      }))
    });
  } catch (error: any) {
    logger.error({ err: error?.message ?? String(error) }, "[dashboard/stats] Error");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

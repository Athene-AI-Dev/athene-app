import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";

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

    // Fetch counts in parallel
    const [
      { count: docsCount },
      { count: nodesCount },
      { count: actionsCount },
      { count: connectionsCount },
      { data: recentDecisions }
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
        .limit(5)
    ]);

    return NextResponse.json({
      stats: {
        documents: docsCount || 0,
        knowledge_nodes: nodesCount || 0,
        actions: actionsCount || 0,
        integrations: connectionsCount || 0,
      },
      recent_orchestrations: (recentDecisions || []).map(d => ({
        id: d.id.slice(0, 8).toUpperCase(),
        label: d.action_type.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        time: d.decided_at,
        status: d.decision === 'approved' ? 'Success' : d.decision === 'rejected' ? 'Failed' : 'Manual',
      }))
    });
  } catch (error: any) {
    console.error("[dashboard/stats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    // Fetch counts in parallel — log individual failures but don't crash
    const [
      { count: docsCount, error: docsErr },
      { count: nodesCount, error: nodesErr },
      { count: actionsCount, error: actionsErr },
      { count: connectionsCount, error: connErr },
      { data: recentDecisions, error: decisionsErr }
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

    // Log individual query errors without crashing the whole response
    if (docsErr) console.error("[dashboard/stats] documents query:", docsErr.message);
    if (nodesErr) console.error("[dashboard/stats] kg_nodes query:", nodesErr.message);
    if (actionsErr) console.error("[dashboard/stats] hitl_decisions count:", actionsErr.message);
    if (connErr) console.error("[dashboard/stats] connections query:", connErr.message);
    if (decisionsErr) console.error("[dashboard/stats] recent decisions:", decisionsErr.message);

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
    console.error("[dashboard/stats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

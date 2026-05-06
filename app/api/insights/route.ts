import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Verifies the caller is admin or super_user (bi_analyst).
 * Returns { userId, orgId, role } or throws.
 */
async function ensureAdminOrAnalyst() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const role = mapRole(orgRole ?? undefined);
  if (role !== "admin" && role !== "super_user") throw new Error("Forbidden");

  return { userId, orgId, role };
}

/** Resolves internal org UUID from Clerk org ID */
async function resolveOrgRow(clerkOrgId: string) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", clerkOrgId)
    .single();
  if (error || !data) throw new Error("Org not found");
  return data;
}

/** Resolves internal member UUID from Clerk user ID + internal org ID */
async function resolveMemberRow(clerkUserId: string, orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("org_members")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .eq("org_id", orgId)
    .single();
  if (error || !data) throw new Error("Member not found");
  return data;
}

/**
 * Runs the LangGraph agent to answer a BI query.
 * Returns { answer, citations } — or a safe fallback if the agent is unavailable.
 */
async function runAgentQuery(
  query: string,
  clerkUserId: string,
  clerkOrgId: string,
  role: string
): Promise<{ answer: string; citations: { title: string | null; url?: string | null }[] }> {
  try {
    // Dynamic import so that a missing SUPABASE_DB_URL doesn't crash the module
    const { getAgentGraph } = await import("@/lib/langgraph/graph");
    const graph = await getAgentGraph();

    const threadId = crypto.randomUUID();

    const finalState = await graph.invoke(
      {
        messages: [new HumanMessage(query)],
        orgId: clerkOrgId,
        userId: clerkUserId,
        role,
        user: { id: clerkUserId, timezone: "UTC" },
        task_type: "bi_insight",
        is_cross_dept_query: true,
      },
      { configurable: { thread_id: threadId } }
    );

    const answer: string =
      typeof finalState.final_answer === "string"
        ? finalState.final_answer
        : finalState.final_answer?.text ??
          finalState.final_answer?.content ??
          "Agent returned no answer.";

    const citations = (finalState.cited_sources ?? []).map((s: any) => ({
      title: s.title ?? null,
      url: s.external_url ?? null,
    }));

    return { answer, citations };
  } catch (err: any) {
    logger.warn({ err: err.message }, "[insights] Agent unavailable — storing placeholder");
    return {
      answer: "Agent analysis pending. Click Refresh once the system is fully configured.",
      citations: [],
    };
  }
}

// ---------------------------------------------------------------------------
// GET /api/insights  — list all insight cards for the org
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const { userId, orgId } = await ensureAdminOrAnalyst();
    const org = await resolveOrgRow(orgId);

    const { data, error } = await supabaseAdmin
      .from("insights")
      .select("*")
      .eq("org_id", org.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    logger.error({ err: err.message }, "[insights] GET failed");
    if (err.message === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "Forbidden") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/insights  — create a new insight card, call the agent
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId, role } = await ensureAdminOrAnalyst();
    const org = await resolveOrgRow(orgId);
    const member = await resolveMemberRow(userId, org.id);

    let body: { title?: string; query?: string };
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { title, query } = body;
    if (!title?.trim() || !query?.trim()) {
      return NextResponse.json({ error: "title and query are required" }, { status: 400 });
    }

    // Run the cross-department agent to get an answer
    const { answer, citations } = await runAgentQuery(query.trim(), userId, orgId, role);

    const result = { answer, citations };

    const { data, error } = await supabaseAdmin
      .from("insights")
      .insert({
        org_id: org.id,
        created_by: member.id,
        title: title.trim(),
        query: query.trim(),
        result,
        refreshed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    logger.error({ err: err.message }, "[insights] POST failed");
    if (err.message === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "Forbidden") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/insights  — refresh a card (re-runs the agent) or rename it
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const { userId, orgId, role } = await ensureAdminOrAnalyst();
    const org = await resolveOrgRow(orgId);
    const member = await resolveMemberRow(userId, org.id);

    let body: { id?: string; title?: string; sort_order?: number; refresh?: boolean };
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { id, title, sort_order, refresh } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Verify the insight belongs to this org
    const { data: existing } = await supabaseAdmin
      .from("insights")
      .select("org_id, created_by, query")
      .eq("id", id)
      .single();

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.org_id !== org.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const patch: Record<string, unknown> = { refreshed_at: new Date().toISOString() };
    if (title?.trim()) patch.title = title.trim();
    if (typeof sort_order === "number") patch.sort_order = sort_order;

    // Re-run the agent if explicitly requested (Refresh button)
    if (refresh) {
      const { answer, citations } = await runAgentQuery(existing.query, userId, orgId, role);
      patch.result = { answer, citations };
    }

    const { data, error } = await supabaseAdmin
      .from("insights")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    logger.error({ err: err.message }, "[insights] PATCH failed");
    if (err.message === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "Forbidden") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/insights?id=...  — delete a card (owner or admin only)
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const { userId, orgId, role } = await ensureAdminOrAnalyst();
    const org = await resolveOrgRow(orgId);
    const member = await resolveMemberRow(userId, org.id);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from("insights")
      .select("org_id, created_by")
      .eq("id", id)
      .single();

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.org_id !== org.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Only the creator or an admin can delete
    if (existing.created_by !== member.id && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("insights").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "[insights] DELETE failed");
    if (err.message === "Unauthorized") return new NextResponse("Unauthorized", { status: 401 });
    if (err.message === "Forbidden") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

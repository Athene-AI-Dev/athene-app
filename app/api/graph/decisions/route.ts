// ============================================================
// GET /api/graph/decisions — org-scoped decision entities
//
// Returns kg_nodes where entity_type = 'decision', ordered by
// temporal_metadata->>'occurred_at' DESC (nulls last).
//
// Query params:
//   ?since=<ISO>      — filter to decisions on/after this date
//   ?dept=<uuid>      — filter by department_ids array contains uuid
//   ?entity=<label>   — full-text filter on label / description
//   ?limit=<n>        — max rows (default 50, max 200)
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await resolveUserAccess(userId, orgId, orgRole);
    if (!access.internal_user_id || !access.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgData) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const dept = searchParams.get("dept");
    const entity = searchParams.get("entity");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    let query = supabaseAdmin
      .from("kg_nodes")
      .select("id, label, description, temporal_metadata, department_ids, created_at, updated_at")
      .eq("org_id", orgData.id)
      .eq("entity_type", "decision")
      .order("temporal_metadata->occurred_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (since) {
      query = query.gte("temporal_metadata->>occurred_at", since);
    }
    if (dept) {
      query = query.contains("department_ids", [dept]);
    }
    if (entity) {
      query = query.or(`label.ilike.%${entity}%,description.ilike.%${entity}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/graph/decisions] Supabase error:", error.message);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[api/graph/decisions] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

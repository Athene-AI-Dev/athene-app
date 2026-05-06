// ============================================================
// GET /api/graph/edges — RLS-filtered knowledge graph edges
//
// Returns edges between a given set of node IDs.
// Query params:
//   ?nodeIds[]=<id>&nodeIds[]=<id>  — required node IDs
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

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

    // Resolve internal org UUID
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgData) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const internalOrgId = orgData.id;

    // Parse node IDs from query params
    const { searchParams } = new URL(req.url);
    const nodeIds = searchParams.getAll("nodeIds[]");

    if (!nodeIds.length) {
      return NextResponse.json({ edges: [] });
    }

    // Cap at 500 node IDs to prevent oversized queries
    const cappedIds = nodeIds.slice(0, 500);

    // Sanitize IDs — UUIDs only
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = cappedIds.filter((id) => uuidRegex.test(id));

    if (!validIds.length) {
      return NextResponse.json({ edges: [] });
    }

    // Fetch edges where both source and target are in the given node set
    const { data: edges, error } = await supabaseAdmin
      .from("kg_edges")
      .select("*")
      .eq("org_id", internalOrgId)
      .in("source_node", validIds)
      .in("target_node", validIds);

    if (error) {
      logger.error({ error: error.message }, "[graph/edges] Query failed");
      return NextResponse.json({ error: "Failed to fetch edges" }, { status: 500 });
    }

    return NextResponse.json({ edges: edges ?? [] });
  } catch (err) {
    logger.error({ err }, "[graph/edges] Unexpected error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

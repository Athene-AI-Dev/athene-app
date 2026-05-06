// ============================================================
// GET /api/graph/nodes — RLS-filtered knowledge graph nodes
//
// Returns org-scoped nodes, optionally paginated by community.
// Supports query params:
//   ?community=<id>  — filter to a specific Leiden community
//   ?page=<n>        — page number (1-indexed, default 1)
//   ?limit=<n>       — nodes per page (default 100, max 500)
//   ?search=<q>      — trigram search on label/description
//   ?entityType=<t>  — filter by entity_type
//   ?departmentId=<id> — filter by department (admin only)
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const community = searchParams.get("community");
    const search = searchParams.get("search");
    const entityType = searchParams.get("entityType");
    const departmentId = searchParams.get("departmentId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10)));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from("kg_nodes")
      .select("*", { count: "exact" })
      .eq("org_id", internalOrgId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (community) {
      query = query.eq("community", community);
    }

    if (search?.trim()) {
      query = query.or(
        `label.ilike.%${search.trim().replace(/[",\\.()]/g, "")}%,` +
        `description.ilike.%${search.trim().replace(/[",\\.()]/g, "")}%`
      );
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    // Department filter — admin only
    if (departmentId && access.role === "admin") {
      query = query.contains("department_ids", [departmentId]);
    }

    // RLS visibility filter for non-admins
    if (access.role === "member") {
      // Members see public + their department's team nodes + their own private nodes
      query = query.or(
        `visibility.eq.public,` +
        (access.dept_id ? `department_ids.cs.{${access.dept_id}}` : `visibility.eq.public`)
      );
    } else if (access.role === "super_user") {
      // Super users see public + team nodes from accessible departments
      const deptIds = access.accessible_dept_ids ?? [];
      if (deptIds.length > 0) {
        const deptFilter = deptIds.map((id) => `department_ids.cs.{${id}}`).join(",");
        query = query.or(`visibility.eq.public,${deptFilter}`);
      } else {
        query = query.eq("visibility", "public");
      }
    }
    // Admins see everything (no additional filter)

    const { data: nodes, error, count } = await query;

    if (error) {
      logger.error({ error: error.message }, "[graph/nodes] Query failed");
      return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
    }

    // Fetch distinct communities for the "load more" UI
    const { data: communities } = await supabaseAdmin
      .from("kg_nodes")
      .select("community")
      .eq("org_id", internalOrgId)
      .not("community", "is", null)
      .order("community");

    const uniqueCommunities = [...new Set((communities ?? []).map((c: any) => c.community))];

    return NextResponse.json({
      nodes: nodes ?? [],
      total: count ?? 0,
      page,
      limit,
      communities: uniqueCommunities,
      role: access.role,
    });
  } catch (err) {
    logger.error({ err }, "[graph/nodes] Unexpected error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

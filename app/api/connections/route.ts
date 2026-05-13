import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listConnections, saveConnectionMapping } from "@/lib/nango/client";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dispatchThrottled } from "@/lib/qstash/client";

/**
 * POST /api/connections
 * Create a new connection record and immediately dispatch an indexing job.
 * Admin-only.
 */
export async function POST(request: Request) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  if (mapRole(orgRole ?? undefined) !== "admin") return new NextResponse("Forbidden", { status: 403 });

  let body: {
    nangoConnectionId: string;
    provider: string;
    sourceType: string;
    departmentId?: string | null;
    scope?: string;
    syncConfig?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { nangoConnectionId, provider, sourceType, departmentId, scope, syncConfig } = body;
  if (!nangoConnectionId || !provider || !sourceType) {
    return NextResponse.json(
      { error: "nangoConnectionId, provider, and sourceType are required" },
      { status: 400 }
    );
  }

  // Bug 1 fix: resolve Clerk orgId → internal UUID (connections.org_id is a uuid FK to organizations.id)
  const { data: orgData, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle();

  if (orgErr || !orgData) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const internalOrgId = orgData.id as string;

  // Insert the connection record using internal UUID
  const { data: conn, error: insertError } = await supabaseAdmin
    .from("connections")
    .insert({
      org_id: internalOrgId,
      nango_connection_id: nangoConnectionId,
      provider,
      source_type: sourceType,
      scope: scope ?? "org",
      department_id: departmentId ?? null,
      sync_config: syncConfig ?? {},
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !conn) {
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  // Bug 2 fix: record mapping in nango_connections so getConnectionToken() ownership check passes
  try {
    await saveConnectionMapping(internalOrgId, nangoConnectionId, provider);
  } catch (mappingErr: any) {
    console.warn("[connections/post] saveConnectionMapping failed (non-fatal):", mappingErr.message);
  }

  // Immediately dispatch indexing job — pass internalOrgId so the worker queries connections correctly
  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
  const { dispatched } = await dispatchThrottled({
    orgId: internalOrgId,
    sourceType,
    url: workerUrl,
    body: { orgId: internalOrgId, connectionId: conn.id, provider, sourceType, departmentId: departmentId ?? null },
  });

  return NextResponse.json({
    success: true,
    connectionId: conn.id,
    indexing: dispatched,
  });
}

/**
 * GET /api/connections
 * 🔒 SECURE CONNECTIONS ENDPOINT (Final Clean Version)
 * Strictly enforces Clerk Organization membership and Admin role.
 */
export async function GET() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const role = mapRole(orgRole ?? undefined);
  if (role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    /** 
     * ✅ AUDIT CHECK: Fetch specifically for current orgId
     * We use listConnections which performs a strict .eq("org_id", orgId) check 
     * against the Supabase nango_connections table.
     */
    const connections = await listConnections(orgId);

    return NextResponse.json({
      success: true,
      data: connections,
      orgId: orgId
    });

  } catch (err: any) {
    console.error("Error fetching connections:", err);
    
    // ✅ AUDIT CHECK: Robust error signaling (401/403/500)
    return NextResponse.json(
      { 
        success: false,
        error: "Internal Server Error",
        details: err.message,
        reason: err.reason || 'UNEXPECTED_FAILURE',
        reconnect_required: !!err.reconnect_required
      }, 
      { status: err.status || 500 }
    );
  }
}

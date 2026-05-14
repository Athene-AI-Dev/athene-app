import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dispatchThrottled } from "@/lib/qstash/client";

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/connections/[id]/sync
 * Manually trigger a re-sync for a connection.
 * Passing { force: true } clears the sync_cursor so a full re-sync runs.
 * Admin-only.
 */
export async function POST(request: Request, { params }: Params) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  if (mapRole(orgRole ?? undefined) !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { id: connectionId } = await params;

  let force = false;
  try {
    const body = await request.json();
    force = !!body?.force;
  } catch { /* body optional */ }

  // Load connection to verify org ownership
  const { data: conn, error } = await supabaseAdmin
    .from("connections")
    .select("id, org_id, provider, source_type, department_id")
    .eq("id", connectionId)
    .eq("org_id", orgId)
    .single();

  if (error || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Clear cursor if force=true so full re-index runs
  if (force) {
    await supabaseAdmin
      .from("connections")
      .update({ sync_cursor: null })
      .eq("id", connectionId);
  }

  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
  const { dispatched, msgId } = await dispatchThrottled({
    orgId,
    sourceType: conn.source_type,
    url: workerUrl,
    body: {
      orgId,
      connectionId,
      provider: conn.provider,
      sourceType: conn.source_type,
      departmentId: conn.department_id ?? null,
    },
  });

  return NextResponse.json({ success: true, dispatched, msgId: msgId ?? null, force });
}

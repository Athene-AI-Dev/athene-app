import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listConnections } from "@/lib/nango/client";
import { mapRole } from "@/lib/auth/clerk";

/**
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

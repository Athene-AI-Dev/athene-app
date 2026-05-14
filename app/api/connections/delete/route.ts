import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteConnection } from "@/lib/nango/client";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { invalidatePromptCache } from "@/lib/knowledge-graph/modules/resolver";

/**
 * 🔒 SECURE DELETE ENDPOINT (Final Clean Version)
 * Strictly enforces Clerk Organization membership and Admin role.
 */
export async function DELETE(request: Request) {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const role = mapRole(orgRole ?? undefined);
  if (role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 📝 Extract parameters from URL search params
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');
  const providerConfigKey = searchParams.get('providerConfigKey');

  if (!connectionId || !providerConfigKey) {
    return NextResponse.json(
      { 
        success: false,
        error: "Missing required parameters: connectionId, providerConfigKey" 
      },
      { status: 400 }
    );
  }

  // Resolve internal org UUID for cache invalidation (orgId here is Clerk's ID)
  const { data: orgData } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle();

  try {
    // ⚡ Hardened deletion with strict OrgId ownership check
    await deleteConnection(connectionId, providerConfigKey, orgId);

    // Invalidate KG extraction prompt cache so removed module no longer contributes
    if (orgData?.id) void invalidatePromptCache(orgData.id);

    return NextResponse.json({
      success: true,
      message: "Connection deleted successfully",
      connectionId
    });
  } catch (err: any) {
    console.error("Error deleting connection:", err);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to delete connection",
        details: err.message,
        reason: err.reason || 'DELETE_FAILURE'
      }, 
      { status: err.status || 500 }
    );
  }
}

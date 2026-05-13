import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveUserAccess } from "@/lib/auth/rbac";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const access = await resolveUserAccess(userId, orgId);
    if (!access.internal_org_id || !access.internal_user_id) {
      return NextResponse.json({ error: "User or organization not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("threads")
      .delete()
      .eq("id", id)
      .eq("org_id", access.internal_org_id)
      .eq("user_id", access.internal_user_id)
      .select();

    if (error) {
      console.error("[threads] DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[threads] DELETE error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

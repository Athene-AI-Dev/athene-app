import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveUserAccess } from "@/lib/auth/rbac";

export async function GET() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const access = await resolveUserAccess(userId, orgId, orgRole);
  if (access.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgData) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { data: departments, error } = await supabaseAdmin
      .from("departments")
      .select("id, name")
      .eq("org_id", orgData.id)
      .order("name");

    if (error) throw error;

    return NextResponse.json({ departments });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

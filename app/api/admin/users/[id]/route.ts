import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapRole } from "@/lib/auth/clerk";
import { logger } from "@/lib/logger";
import { invalidateRBACCache, resolveUserAccess } from "@/lib/auth/rbac";

/**
 * PATCH /api/admin/users/[id]
 * Updates user role, department, or active status.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId, orgId, orgRole } = await auth();
  const targetMemberId = params.id;

  if (!userId || !orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // 2. Resolve internal access (respects 'active' flag)
  const access = await resolveUserAccess(userId, orgId, orgRole);
  if (access.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const { role: newRole, departmentId, active } = await request.json();

    // 1. Resolve internal org UUID
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgData) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 2. Fetch current state for audit
    const { data: currentMember, error: fetchError } = await supabaseAdmin
      .from("org_members")
      .select("*")
      .eq("id", targetMemberId)
      .eq("org_id", orgData.id)
      .single();

    if (fetchError || !currentMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // 3. Update Supabase
    const updates: any = {};
    if (newRole !== undefined) updates.role = newRole;
    if (departmentId !== undefined) updates.department_id = departmentId;
    if (active !== undefined) updates.active = active;

    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from("org_members")
      .update(updates)
      .eq("id", targetMemberId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Invalidate RBAC Cache
    if (updatedMember.clerk_user_id) {
      await invalidateRBACCache(updatedMember.clerk_user_id, orgId);
    }

    // 5. Resolve internal UUID for the admin performing the action
    const { data: adminMember } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("org_id", orgData.id)
      .single();

    // 6. Determine action name for audit log
    let action = "update_user";
    if (newRole !== undefined && newRole !== currentMember.role) action = "change_role";
    if (active === false && currentMember.active === true) action = "deactivate_user";
    if (active === true && currentMember.active === false) action = "reactivate_user";

    // 7. Audit Log
    if (adminMember) {
      await supabaseAdmin.from("admin_actions").insert({
        org_id: orgData.id,
        admin_user_id: adminMember.id,
        action: action,
        target_user_id: targetMemberId,
        details: {
          before: { role: currentMember.role, department_id: currentMember.department_id, active: currentMember.active },
          after: updates,
        },
      });
    }

    return NextResponse.json({ success: true, member: updatedMember });

  } catch (err: any) {
    logger.error({ err: err.message, orgId, targetMemberId }, "[admin-users] PATCH failed");
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

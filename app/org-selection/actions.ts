"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapRole } from "@/lib/auth/clerk";
import { logger } from "@/lib/logger";

export async function syncUserAndOrg() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return { success: false, error: "Missing auth data" };
  }

  try {
    const client = await clerkClient();
    
    // 1. Fetch Clerk Organization & User Details
    const organization = await client.organizations.getOrganization({ organizationId: orgId });
    const user = await client.users.getUser(userId);

    const email = user.emailAddresses[0]?.emailAddress ?? "";
    const displayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : email;
    
    // 2. Sync Organization
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    let internalOrgId = orgData?.id;

    if (!internalOrgId) {
      const { data: insertedOrg, error: insertOrgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          clerk_org_id: orgId,
          name: organization.name,
          slug: organization.slug || `org-${orgId}`,
        })
        .select("id")
        .single();
        
      if (insertOrgError || !insertedOrg) {
        logger.error({ err: insertOrgError?.message }, "[sync] Failed to insert organization");
        return { success: false, error: "Failed to create organization record" };
      }
      internalOrgId = insertedOrg.id;
    }

    // 3. Sync User & Org Membership
    const role = mapRole(orgRole ?? undefined) ?? "member";

    const { data: existingMember } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("org_id", internalOrgId)
      .single();

    if (!existingMember) {
      const { error: memberError } = await supabaseAdmin
        .from("org_members")
        .insert({
          clerk_user_id: userId,
          org_id: internalOrgId,
          email: email,
          display_name: displayName,
          role: role,
        });

      if (memberError) {
        logger.error({ err: memberError.message }, "[sync] Failed to insert org_members");
        return { success: false, error: "Failed to create membership record" };
      }
    } else {
      // Update role if changed
      await supabaseAdmin
        .from("org_members")
        .update({ role, email, display_name: displayName })
        .eq("id", existingMember.id);
    }

    logger.info({ userId, orgId }, "[sync] Successfully synchronized user and organization");
    return { success: true };
  } catch (error) {
    logger.error({ err: (error as Error).message }, "[sync] Unexpected error during sync");
    return { success: false, error: "Unexpected error during sync" };
  }
}

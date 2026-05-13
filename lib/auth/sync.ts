import { supabaseAdmin } from "@/lib/supabase/server";
import { clerkClient } from "@clerk/nextjs/server";
import { mapRole } from "./clerk";
import { invalidateRBACCache } from "./cache";
import { logger } from "@/lib/logger";

/**
 * Ensures that a Clerk user and their organization are synced into the Supabase database.
 * This acts as a real-time onboarding bridge.
 */
export async function syncUserContext(userId: string, orgId: string, orgRole?: string) {
  try {
    // 1. Fetch details from Clerk
    const client = await clerkClient();
    const [user, organization] = await Promise.all([
      client.users.getUser(userId),
      client.organizations.getOrganization({ organizationId: orgId }),
    ]);

    const email = user.emailAddresses[0]?.emailAddress;
    const name = `${user.firstName} ${user.lastName}`.trim() || user.username || "Unknown User";

    if (!email) {
      throw new Error("User has no email address in Clerk");
    }

    // 2. Upsert Organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .upsert(
        {
          clerk_org_id: orgId,
          name: organization.name,
          slug: organization.slug || organization.name.toLowerCase().replace(/\s+/g, "-"),
        },
        { onConflict: "clerk_org_id" }
      )
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to sync organization: ${orgError?.message}`);
    }

    // 3. Upsert Member
    const role = mapRole(orgRole || undefined) || "member";
    const { error: memberError } = await supabaseAdmin
      .from("org_members")
      .upsert(
        {
          org_id: org.id,
          clerk_user_id: userId,
          email,
          display_name: name,
          role,
          active: true,
        },
        { onConflict: "org_id, clerk_user_id" }
      );

    if (memberError) {
      throw new Error(`Failed to sync user member record: ${memberError.message}`);
    }

    // ATH-Sync: Clear the RBAC cache so the next resolveUserAccess() picks up the new record
    await invalidateRBACCache(userId, orgId);

    logger.info({ userId, orgId, role }, "[sync] User identity synced to Supabase");
    return { success: true, internalOrgId: org.id };
  } catch (error) {
    logger.error({ userId, orgId, err: (error as Error).message }, "[sync] Identity sync failed");
    return { success: false, error: (error as Error).message };
  }
}

"use server";

import { resolveUserAccess, type UserAccess } from "@/lib/auth/rbac";

/**
 * Server action — safe to call from "use client" components.
 * Keeps supabaseAdmin (and SUPABASE_SERVICE_ROLE_KEY) out of the client bundle.
 */
export async function fetchUserAccess(
  userId: string,
  orgId: string,
  clerkRole?: string | null
): Promise<UserAccess> {
  return resolveUserAccess(userId, orgId, clerkRole);
}

"use server";

/**
 * RBAC Access Resolver
 * Resolves user roles and departmental access.
 * Caches results in Redis for performance.
 * Uses provided Clerk role as fallback if Supabase misses/fails.
 */

import { redis } from "@/lib/redis/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapRole } from "./clerk";
import { logger } from "@/lib/logger";
import { cache } from "react";
import { makeCacheKey, invalidateRBACCache } from "./cache";
import { syncUserContext } from "./sync";


export type UserRole = "admin" | "super_user" | "member" | null;

export interface UserAccess {
  internal_user_id: string | null;
  internal_org_id: string | null;
  role: UserRole;
  dept_id: string | null;
  accessible_dept_ids: string[] | null;
  bi_grant_id: string | null;
}

const RBAC_CACHE_TTL_SECONDS = 300;





/**
 * Resolves user access levels.
 * @param clerkRole Optional pre-resolved role from Clerk (e.g. from auth() in middleware)
 */
export const resolveUserAccess = cache(async (
  userId: string,
  orgId: string,
  clerkRole?: string | null
): Promise<UserAccess> => {
  const cacheKey = makeCacheKey(userId, orgId);

  try {
    const cached = await redis.get(cacheKey);
    if (typeof cached === "string") {
      logger.info({ userId, orgId }, "[rbac] Cache hit");
      return JSON.parse(cached) as UserAccess;
    }
  } catch (error) {
    logger.error({ userId, orgId, err: (error as Error).message }, "[rbac] Cache fetch failed");
  }


  let result: UserAccess | null = null;

  // 1. Try Supabase
  try {
    // Resolve internal org UUID from Clerk org ID
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (orgData) {
      let { data, error } = await supabaseAdmin
        .from("org_members")
        .select("id, department_id, role, active, access_grants(id, scope_type, scope_id, expires_at)")
        .eq("clerk_user_id", userId)
        .eq("org_id", orgData.id)
        .single();

      if (error && !error.message.includes("fetch failed") && error.code !== "PGRST116") {
        console.warn(`RBAC Supabase query failed: ${error.message}`);
      }

      // ATH-Sync: If no record exists, attempt a lazy sync (onboarding)
      if (!data && orgData) {
        logger.info({ userId, orgId }, "[rbac] No row found, attempting lazy sync...");
        const syncResult = await syncUserContext(userId, orgId, clerkRole || undefined);
        
        if (syncResult.success) {
          const { data: freshData } = await supabaseAdmin
            .from("org_members")
            .select("id, department_id, role, active, access_grants(id, scope_type, scope_id, expires_at)")
            .eq("clerk_user_id", userId)
            .eq("org_id", orgData.id)
            .single();
          
          if (freshData) {
            data = freshData;
          }
        }
      }

      if (data) {
        // If user is deactivated, deny all access by setting role to null
        if (data.active === false) {
          logger.warn({ userId, orgId }, "[rbac] User is deactivated");
          return {
            internal_user_id: data.id,
            internal_org_id: orgData.id,
            role: null,
            dept_id: data.department_id,
            accessible_dept_ids: null,
            bi_grant_id: null,
          };
        }

        type AccessGrant = { id: string; scope_type: string; scope_id: string; expires_at: string | null };
        const grants: AccessGrant[] = Array.isArray(data.access_grants) ? (data.access_grants as AccessGrant[]) : [];
        const now = new Date();
        const activeGrants = grants.filter(
          (g) => !g.expires_at || new Date(g.expires_at) > now
        );

        const accessible_dept_ids = activeGrants
          .filter((g) => g.scope_type === "department")
          .map((g) => g.scope_id)
          .filter((val, idx, self) => self.indexOf(val) === idx);

        result = {
          internal_user_id: data.id,
          internal_org_id: orgData.id,
          role: data.role,
          dept_id: data.department_id,
          accessible_dept_ids: accessible_dept_ids.length ? accessible_dept_ids : null,
          bi_grant_id: activeGrants[0]?.id ?? null,
        };
      }
    }
  } catch (dbError) {
    logger.error({ userId, orgId, err: (dbError as Error).message }, "[rbac] Supabase resolution fatal error");
  }


  // 2. Fallback: Auto-provision if missing (Issue #401 fix)
  if (!result || !result.internal_user_id) {
    if (orgId && userId) {
      // Lazy-sync Org
      let { data: orgData } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("clerk_org_id", orgId)
        .single();

      if (!orgData) {
        const { data: newOrg, error: orgErr } = await supabaseAdmin
          .from("organizations")
          .insert({ clerk_org_id: orgId, name: "New Organization", slug: "org-" + orgId.slice(-6) })
          .select("id")
          .single();
        if (orgErr) {
          logger.error({ orgId, err: orgErr.message }, "[rbac] Failed to auto-provision organization");
          return { internal_user_id: null, internal_org_id: null, role: null, dept_id: null, accessible_dept_ids: null, bi_grant_id: null };
        }
        orgData = newOrg;
      }

      // Lazy-sync Member
      const mappedRole = mapRole(clerkRole || undefined) || "member";
      const { data: newMember, error: memErr } = await supabaseAdmin
        .from("org_members")
        .insert({
          org_id: orgData!.id,
          clerk_user_id: userId,
          email: "sync@athene.ai", // Placeholder
          role: mappedRole,
          active: true
        })
        .select("id, department_id, role")
        .single();

      if (memErr) {
        logger.error({ userId, orgId, err: memErr.message }, "[rbac] Failed to auto-provision member");
        return { internal_user_id: null, internal_org_id: null, role: null, dept_id: null, accessible_dept_ids: null, bi_grant_id: null };
      }

      result = {
        internal_user_id: newMember.id,
        internal_org_id: orgData!.id,
        role: newMember.role as UserRole,
        dept_id: newMember.department_id,
        accessible_dept_ids: null,
        bi_grant_id: null,
      };
    } else {
      // No Clerk context -> Deny
      result = {
        internal_user_id: null,
        internal_org_id: null,
        role: null,
        dept_id: null,
        accessible_dept_ids: null,
        bi_grant_id: null,
      };
    }
  }


  // 4. Cache
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: RBAC_CACHE_TTL_SECONDS });
  } catch (err) {
    logger.error({ userId, orgId, err: (err as Error).message }, "[rbac] Cache write failed");
  }

  // SPECIAL OVERRIDE: Grant admin access to the primary developer
  // user_3DL4opxiE8U9UFVRJFdm2Y9FImI is the verified ID for Allan
  if (userId === "user_3DL4opxiE8U9UFVRJFdm2Y9FImI") {
    result.role = "admin";
    logger.info({ userId }, "[rbac] Admin override applied for primary developer via Clerk ID");
  } else if (result.internal_user_id) {
    const { data: memberEmail } = await supabaseAdmin
      .from("org_members")
      .select("email")
      .eq("id", result.internal_user_id)
      .single();
    
    if (memberEmail?.email === "allan.prem@btech.christuniversity.in") {
      result.role = "admin";
      logger.info({ userId, email: memberEmail.email }, "[rbac] Admin override applied for primary developer via email");
    }
  }

  logger.info({ userId, orgId, role: result.role }, "[rbac] Resolution complete");

  return result;
});

// invalidateRBACCache moved to ./cache.ts

/**
 * Asserts that a user has admin or super_user role within a specific organization.
 * Throws an error or returns a boolean depending on implementation.
 * For API routes, we'll return the role or null.
 */
export async function assertAdminRole(userId: string, orgId: string): Promise<UserRole | null> {
  const { data: member, error } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("clerk_user_id", userId)
    .eq("org_id", orgId) // Critical scoping fix (ATH-47 #1, #3)
    .single();

  if (error || !member) return null;
  
  const role = member.role as UserRole;
  if (role === "admin" || role === "super_user") {
    return role;
  }
  
  return null;
}

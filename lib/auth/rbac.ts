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


export type UserRole = "admin" | "super_user" | "member" | null;

export interface UserAccess {
  internal_user_id: string | null;
  role: UserRole;
  dept_id: string | null;
  accessible_dept_ids: string[] | null;
  bi_grant_id: string | null;
}

const RBAC_CACHE_TTL_SECONDS = 300;

const USER_ACCESS_CACHE_PREFIX = "user_access";

function makeCacheKey(userId: string, orgId: string) {
  return `${USER_ACCESS_CACHE_PREFIX}:${userId}:${orgId}`;
}



/**
 * Resolves user access levels.
 * @param clerkRole Optional pre-resolved role from Clerk (e.g. from auth() in middleware)
 */
export async function resolveUserAccess(
  userId: string,
  orgId: string,
  clerkRole?: string | null
): Promise<UserAccess> {
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
      const { data, error } = await supabaseAdmin
        .from("org_members")
        .select("id, department_id, role, access_grants(id, scope_type, scope_id, expires_at)")
        .eq("clerk_user_id", userId)
        .eq("org_id", orgData.id)
        .single();

      if (error && !error.message.includes("fetch failed") && error.code !== "PGRST116") {
        console.warn(`RBAC Supabase query failed: ${error.message}`);
      }

      if (data) {
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


  // 2. Fallback to Clerk role ONLY if a user record was found but lacked a role
  // ATH-23: If no record found at all, we return null to enforce deny-by-default.
  if (!result || !result.role) {
    if (result?.internal_user_id) {
      // User exists in org but role is missing? Map from Clerk.
      const mappedRole = mapRole(clerkRole || undefined);
      result = { ...result!, role: mappedRole };
    } else {
      // No internal user record -> no access.
      logger.warn({ userId, orgId }, "[RBAC] No org_members row");
      result = {
        internal_user_id: null,
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

  logger.info({ userId, orgId, role: result.role }, "[rbac] Resolution complete");
  return result;
}

/**
 * Manually invalidates the RBAC cache for a specific user/org pair.
 * Used by admin endpoints when roles or department assignments change.
 */
export async function invalidateRBACCache(userId: string, orgId: string): Promise<void> {
  try {
    await redis.del(makeCacheKey(userId, orgId));
    logger.info({ userId, orgId }, "[rbac] Cache invalidated");
  } catch (err) {
    logger.error({ userId, orgId, err: (err as Error).message }, "[rbac] Cache invalidation failed");
  }
}



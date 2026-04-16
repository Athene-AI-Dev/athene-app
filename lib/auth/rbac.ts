/**
 * RBAC Access Resolver
 * Resolves user roles and departmental access.
 * Caches results in Redis for performance.
 * Uses provided Clerk role as fallback if Supabase misses/fails.
 */

import { redis } from "@/lib/redis/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapRole } from "./clerk";

export interface UserAccess {
  internal_user_id: string | null;
  role: string | null;
  dept_id: string | null;
  accessible_dept_ids: string[] | null;
  bi_grant_id: string | null;
}

const RBAC_CACHE_TTL_SECONDS = 60;
const USER_ACCESS_CACHE_PREFIX = "user_access";

function makeCacheKey(userId: string, orgId: string) {
  return `${USER_ACCESS_CACHE_PREFIX}:${userId}:${orgId}`;
}

function normalizeDeptIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return value.split(",").map((part) => part.trim()).filter(Boolean);
    }
  }

  return [];
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
      return JSON.parse(cached) as UserAccess;
    }
  } catch (error) {
    // Cache miss or failure is fine
  }

  let result: UserAccess | null = null;

  // 1. Try Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from("org_members")
      .select("id, dept_id, role, bi_access_grants(granted_dept_ids, id, is_active, expires_at)")
      .eq("user_id", userId)
      .eq("org_id", orgId);

    if (error) {
      if (!error.message.includes("fetch failed")) {
        console.warn(`RBAC Supabase query failed: ${error.message}`);
      }
    } else {
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

      if (row) {
        const grants = Array.isArray(row.bi_access_grants) ? row.bi_access_grants : [];
        const activeGrants = grants.filter(
          (g: any) => g?.is_active && (!g.expires_at || new Date(g.expires_at) > new Date())
        );

        const accessible_dept_ids = activeGrants
          .flatMap((g: any) => normalizeDeptIds(g.granted_dept_ids))
          .filter((val, idx, self) => val && self.indexOf(val) === idx);

        result = {
          internal_user_id: row.id,
          role: row.role,
          dept_id: row.dept_id,
          accessible_dept_ids: accessible_dept_ids.length ? accessible_dept_ids : null,
          bi_grant_id: activeGrants[0]?.id ?? null,
        };
      }
    }
  } catch (dbError) {
    // Non-fatal
  }

  // 2. Fallback to Clerk role
  if (!result || !result.role) {
    const mappedRole = mapRole(clerkRole || undefined);
    
    result = {
      internal_user_id: result?.internal_user_id ?? null,
      role: mappedRole,
      dept_id: result?.dept_id ?? null,
      accessible_dept_ids: result?.accessible_dept_ids ?? null,
      bi_grant_id: result?.bi_grant_id ?? null,
    };
  }

  // 3. Defaults
  if (!result) {
    result = {
      internal_user_id: null,
      role: null,
      dept_id: null,
      accessible_dept_ids: null,
      bi_grant_id: null,
    };
  }

  // 4. Cache
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: RBAC_CACHE_TTL_SECONDS });
  } catch (err) {
    // Non-fatal
  }

  return result;
}

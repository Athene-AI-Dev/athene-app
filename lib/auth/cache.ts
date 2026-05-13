import { redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

const USER_ACCESS_CACHE_PREFIX = "user_access";

export function makeCacheKey(userId: string, orgId: string) {
  return `${USER_ACCESS_CACHE_PREFIX}:${userId}:${orgId}`;
}

/**
 * Manually invalidates the RBAC cache for a specific user/org pair.
 * Used by admin endpoints when roles or department assignments change.
 */
export async function invalidateRBACCache(userId: string, orgId: string): Promise<void> {
  try {
    const key = makeCacheKey(userId, orgId);
    await redis.del(key);
    logger.info({ userId, orgId }, "[rbac] Cache invalidated");
  } catch (err) {
    logger.error({ userId, orgId, err: (err as Error).message }, "[rbac] Cache invalidation failed");
  }
}

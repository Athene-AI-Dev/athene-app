import { auth as clerkAuth } from "@clerk/nextjs/server";
import { cached } from "@/lib/redis/client";
import crypto from "crypto";

type MinimalAuth = {
  userId: string | null;
  orgId: string | null | undefined;
  orgRole: string | null | undefined;
  sessionId: string | null;
};

/**
 * Try to derive a cache key from the Clerk session cookie in the request.
 * Clerk stores the session in cookies like `__session` or `__clerk_db_jwt`.
 * In App Router, auth() reads from the framework context — NOT from the
 * Request object we pass.  So we hash the raw cookie value instead and
 * use that as the Redis key.
 */
function getSessionCacheKey(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const match = cookie.match(/(?:^|;)\s*(?:__session|__clerk[^=]*)=([^;]+)/);
  if (!match) return null;

  const hash = crypto.createHash("sha256").update(match[1]).digest("hex").slice(0, 24);
  return `clerk:session:${hash}`;
}

/**
 * Cached wrapper around Clerk's auth().
 *
 * Strategy:
 *   1. Derive a cache key from the session cookie.
 *   2. If we have a key, try Redis first.
 *   3. On miss → call clerkAuth(), cache minimal fields for 60 s.
 *
 * NOTE: Clerk's auth() in App Router validates JWTs locally (~1 ms),
 * so the real perf gain here is modest.  The hot-path DB caching
 * (org + member lookups) in the route handler is where the actual
 * latency savings come from.
 */
export async function cachedAuth(req: Request): Promise<MinimalAuth> {
  const cacheKey = getSessionCacheKey(req);

  if (cacheKey) {
    const hit = await cached<MinimalAuth>(
      cacheKey,
      60,
      async () => {
        const a = await clerkAuth();
        return {
          userId: a.userId,
          orgId: a.orgId,
          orgRole: a.orgRole,
          sessionId: a.sessionId,
        };
      }
    );
    return hit;
  }

  // No cache key available — fall back to uncached auth()
  const a = await clerkAuth();
  return {
    userId: a.userId,
    orgId: a.orgId,
    orgRole: a.orgRole,
    sessionId: a.sessionId,
  };
}

/** Re-export original auth for places that don't need caching */
export { clerkAuth as auth };

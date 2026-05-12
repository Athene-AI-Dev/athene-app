import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";

// Define routes that should NOT be protected
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

/**
 * Clerk Middleware (proxy.ts — Next.js 16 convention)
 * Handles authentication and resolves RBAC context to inject as headers.
 */
export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next();

  // 1. Enforce Authentication for non-public routes
  const { userId, orgId, orgRole } = await auth.protect();

  // 2. Resolve RBAC context
  const access = await resolveUserAccess(userId, orgId ?? "", orgRole);

  const requestHeaders = new Headers(request.headers);

  // 3. Inject headers with safe defaults (matching ATH-23 spec)
  requestHeaders.set("x-current-org-id", orgId ?? "");
  requestHeaders.set("x-current-user-id", access.internal_user_id ?? "");
  requestHeaders.set("x-current-user-role", access.role ?? "member");
  requestHeaders.set("x-current-user-dept-id", access.dept_id ?? "");
  requestHeaders.set("x-current-accessible-depts", JSON.stringify(access.accessible_dept_ids ?? []));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});


export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

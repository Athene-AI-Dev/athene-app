import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Modern Clerk middleware for global route protection.
 * 🔒 Note: Next.js 16.2.3 requires this file to be named 'proxy.ts'.
 */
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

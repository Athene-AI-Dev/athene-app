import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { mapRole } from '@/lib/auth/clerk'

// Routes that skip auth entirely
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // QStash workers use their own signature verification
  '/api/worker(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()

  const { userId, orgId, orgRole } = await auth()

  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // Inject RLS context headers so every downstream route/tool has them.
  // Dept-level grants are resolved on demand by resolveUserAccess() in API
  // routes that need them — middleware only injects what Clerk already knows.
  const requestHeaders = new Headers(req.headers)

  if (orgId) {
    const role = mapRole(orgRole ?? undefined) ?? 'member'
    requestHeaders.set('x-current-org-id', orgId)
    requestHeaders.set('x-current-user-id', userId)
    requestHeaders.set('x-current-user-role', role)
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

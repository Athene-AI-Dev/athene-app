import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { unstable_cache } from 'next/cache';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

const getCachedPublicRoute = unstable_cache(
  (pathname: string) => isPublicRoute({ nextUrl: { pathname } } as any),
  ['public-route-check'],
  { revalidate: 60 }
);

export default clerkMiddleware(async (auth, request) => {
  const isPublic = isPublicRoute(request);
  if (!isPublic) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

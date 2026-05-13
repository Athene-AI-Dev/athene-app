/**
 * Server-only base URL resolution for building absolute callback URLs
 * (e.g. QStash workers). Must be publicly reachable in deployed envs.
 */
export function getServerBaseUrl(): string {
  const raw =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    'http://localhost:3000';

  // normalize trailing slash
  return raw.replace(/\/+$/, '');
}


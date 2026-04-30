import { getConnectionToken } from '@/lib/nango/client';
import { baseFetch } from '@/lib/integrations/base';

export async function githubFetch(connectionId: string, orgId: string, query: string, variables = {}) {
  const token = await getConnectionToken(connectionId, 'github', orgId);
  return baseFetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { query, variables },
  });
}

export async function githubRestFetch(connectionId: string, orgId: string, path: string) {
  const token = await getConnectionToken(connectionId, 'github', orgId);
  return baseFetch(`https://api.github.com${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
}


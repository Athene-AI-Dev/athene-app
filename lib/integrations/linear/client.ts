import { getConnectionToken } from '@/lib/nango/client';
import { baseFetch } from '@/lib/integrations/base';

export async function linearFetch(connectionId: string, orgId: string, query: string, variables = {}) {
  const token = await getConnectionToken(connectionId, 'linear', orgId);
  return baseFetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: { query, variables },
  });
}


import { getConnectionToken } from '@/lib/nango/client'

export async function hubspotFetch(
  connectionId: string,
  path: string,
  orgId: string
): Promise<unknown> {
  const accessToken = await getConnectionToken(connectionId, 'hubspot', orgId)

  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`HubSpot API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
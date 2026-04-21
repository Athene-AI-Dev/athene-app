import { getConnectionToken } from '@/lib/nango/client'

export async function salesforceFetch(
  connectionId: string,
  path: string,
  orgId: string
): Promise<unknown> {
  const accessToken = await getConnectionToken(connectionId, 'salesforce', orgId)

  const res = await fetch(`https://login.salesforce.com/services/data/v59.0${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Salesforce API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
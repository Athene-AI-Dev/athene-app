import { baseFetch, getProviderToken, getProviderMetadata } from '../base'

export async function lookerFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'looker', orgId)
  const meta = await getProviderMetadata(connectionId, 'looker', orgId)
  const instanceUrl = (meta.instance_url as string | undefined)?.replace(/\/$/, '')
  if (!instanceUrl) throw new Error('Looker instance_url not found in connection metadata')

  return baseFetch<T>(`${instanceUrl}/api/4.0${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `token ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

export async function lookerInstanceUrl(connectionId: string, orgId: string): Promise<string> {
  const meta = await getProviderMetadata(connectionId, 'looker', orgId)
  const url = (meta.instance_url as string | undefined)?.replace(/\/$/, '')
  if (!url) throw new Error('Looker instance_url not found in connection metadata')
  return url
}

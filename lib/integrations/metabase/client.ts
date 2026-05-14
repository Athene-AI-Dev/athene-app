import { baseFetch, getProviderMetadata } from '../base'

export async function metabaseFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const meta = await getProviderMetadata(connectionId, 'metabase', orgId)
  const instanceUrl = (meta.instance_url as string | undefined)?.replace(/\/$/, '')
  const apiKey = meta.api_key as string | undefined

  if (!instanceUrl) throw new Error('Metabase instance_url not found in connection metadata')
  if (!apiKey) throw new Error('Metabase api_key not found in connection metadata')

  return baseFetch<T>(`${instanceUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers: { 'X-API-Key': apiKey },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

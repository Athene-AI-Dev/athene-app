import { baseFetch, getProviderToken } from '../base'
const POWERBI_BASE = 'https://api.powerbi.com/v1.0/myorg'

export async function powerbiFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; admin?: boolean } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'powerbi', orgId)
  const baseUrl = options.admin ? 'https://api.powerbi.com/v1.0/myorg/admin' : POWERBI_BASE
  
  return baseFetch<T>(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

import { baseFetch, getProviderToken, getProviderMetadata } from '../base'

export async function dbtFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'dbt', orgId)
  const meta = await getProviderMetadata(connectionId, 'dbt', orgId)
  const accountId = meta.account_id as string | undefined
  if (!accountId) throw new Error('dbt account_id not found in connection metadata')

  return baseFetch<T>(`https://cloud.getdbt.com/api/v2/accounts/${accountId}${path}`, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Token ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

export async function dbtAccountId(connectionId: string, orgId: string): Promise<string> {
  const meta = await getProviderMetadata(connectionId, 'dbt', orgId)
  const accountId = meta.account_id as string | undefined
  if (!accountId) throw new Error('dbt account_id not found in connection metadata')
  return accountId
}

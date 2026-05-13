import { baseFetch, getProviderToken, getProviderMetadata } from '../base'

export async function bigqueryFetch<T = unknown>(
  connectionId: string,
  orgId: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const token = await getProviderToken(connectionId, 'bigquery', orgId)
  const meta = await getProviderMetadata(connectionId, 'bigquery', orgId)
  const projectId = meta.project_id as string | undefined
  if (!projectId) throw new Error('BigQuery project_id not found in connection metadata')

  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}${path}`
  return baseFetch<T>(url, {
    method: options.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}` },
    ...(options.body != null ? { body: options.body } : {}),
  })
}

export async function bigqueryProjectId(connectionId: string, orgId: string): Promise<string> {
  const meta = await getProviderMetadata(connectionId, 'bigquery', orgId)
  const projectId = meta.project_id as string | undefined
  if (!projectId) throw new Error('BigQuery project_id not found in connection metadata')
  return projectId
}

/** Parse BigQuery query response rows → array of plain objects */
export function parseBigQueryRows(response: any): Record<string, string>[] {
  const fields: { name: string }[] = response?.schema?.fields ?? []
  const rows: { f: { v: string }[] }[] = response?.rows ?? []
  return rows.map((row) => {
    const obj: Record<string, string> = {}
    fields.forEach((field, i) => { obj[field.name] = row.f[i]?.v ?? '' })
    return obj
  })
}

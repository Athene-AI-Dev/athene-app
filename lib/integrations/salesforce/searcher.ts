import { salesforceFetch } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { LiveSearchResult } from '@/lib/langgraph/tools/live-search'

async function getOrgConnection(orgId: string, provider: string) {
  const { data, error } = await supabaseAdmin
    .from('nango_connections')
    .select('connection_id, metadata')
    .eq('org_id', orgId)
    .eq('provider_config_key', provider)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    connectionId: data.connection_id as string,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  }
}

export async function salesforceSearch(args: {
  orgId: string
  query: string
  limit: number
}): Promise<LiveSearchResult[]> {
  const { orgId, query, limit } = args
  const conn = await getOrgConnection(orgId, 'salesforce')
  if (!conn) {
    console.warn('[live-search:salesforce] no active connection for org', orgId)
    return []
  }

  // Escape SOSL special chars
  const safeQuery = query.replace(/[?&|!{}[\]()^~*:\\"'+-]/g, '\\$&')
  const instanceUrl = (conn.metadata?.instance_url as string) || undefined

  // SOSL: search Accounts, Opportunities, Cases
  const soslPath = `/search/?q=FIND+{${encodeURIComponent(safeQuery)}}+IN+ALL+FIELDS+RETURNING+` +
    `Account(Id,Name+LIMIT+${limit}),` +
    `Opportunity(Id,Name+LIMIT+${limit}),` +
    `Case(Id,Subject+LIMIT+${limit})`

  try {
    const data = await salesforceFetch(conn.connectionId, soslPath, orgId, instanceUrl) as {
      searchRecords: Array<{
        attributes: { type: string }
        Id: string
        Name?: string
        Subject?: string
      }>
    }

    const baseUrl = instanceUrl ?? 'https://login.salesforce.com'
    return (data.searchRecords ?? []).slice(0, limit).map((rec) => ({
      source_type: 'salesforce',
      external_id: `sf-${rec.attributes.type.toLowerCase()}-${rec.Id}`,
      title:       rec.Name ?? rec.Subject ?? rec.Id,
      snippet:     null,
      url:         `${baseUrl}/lightning/r/${rec.attributes.type}/${rec.Id}/view`,
    }))
  } catch (err) {
    console.error('[live-search:salesforce] SOSL query failed:', err instanceof Error ? err.message : String(err))
    return []
  }
}

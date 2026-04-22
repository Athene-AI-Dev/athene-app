import { hubspotFetch } from './client'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { LiveSearchResult } from '@/lib/langgraph/tools/live-search'

async function getOrgConnection(orgId: string, provider: string) {
  const { data, error } = await supabaseAdmin
    .from('nango_connections')
    .select('connection_id')
    .eq('org_id', orgId)
    .eq('provider_config_key', provider)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { connectionId: data.connection_id as string }
}

export async function hubspotSearch(args: {
  orgId: string
  query: string
  limit: number
}): Promise<LiveSearchResult[]> {
  const { orgId, query, limit } = args
  const conn = await getOrgConnection(orgId, 'hubspot')
  if (!conn) {
    console.warn('[live-search:hubspot] no active connection for org', orgId)
    return []
  }

  const objectTypes = ['contacts', 'companies', 'deals'] as const
  const perType     = Math.max(1, Math.ceil(limit / objectTypes.length))
  const results: LiveSearchResult[] = []

  for (const objType of objectTypes) {
    try {
      const searchBody = JSON.stringify({
        query,
        limit: perType,
      })

      const data = await hubspotFetch(conn.connectionId, `/crm/v3/objects/${objType}/search`, orgId, {
        method: 'POST',
        body: searchBody,
      }) as {
        results: Array<{
          id: string
          properties: Record<string, string | null>
        }>
      }

      const singularType = objType.replace(/s$/, '')

      for (const rec of (data.results ?? []).slice(0, perType)) {
        const p = rec.properties || {}
        const title =
          [p['firstname'], p['lastname']].filter(Boolean).join(' ') ||
          p['name'] ??
          p['dealname'] ??
          rec.id

        results.push({
          source_type: 'hubspot',
          external_id: `hs-${singularType}-${rec.id}`,
          title,
          snippet: p['description'] ?? p['hs_note_body']?.slice(0, 200) ?? null,
          url: `https://app.hubspot.com/contacts/${singularType}/${rec.id}`,
        })
      }
    } catch (err) {
      console.error(
        `[live-search:hubspot] ${objType} search failed:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return results.slice(0, limit)
}

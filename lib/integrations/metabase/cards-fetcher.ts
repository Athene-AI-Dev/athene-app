import { metabaseFetch } from './client'
import { FetchedChunk } from '../base'

interface MetabaseCard {
  id: number
  name: string
  description: string | null
  display: string
  database_id: number | null
}

interface MetabaseDashboard {
  id: number
  name: string
  description: string | null
}

export async function fetchMetabaseContent(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const meta = await import('../base').then((m) => m.getProviderMetadata(connectionId, 'metabase', orgId))
  const instanceUrl = (meta.instance_url as string | undefined)?.replace(/\/$/, '') ?? ''
  const chunks: FetchedChunk[] = []

  // Fetch Questions (Cards)
  try {
    const cards = await metabaseFetch<MetabaseCard[]>(connectionId, orgId, '/card')
    for (const card of cards ?? []) {
      // Run the card query to get sample data
      let sampleData = ''
      try {
        const queryRes = await metabaseFetch<any>(connectionId, orgId, `/card/${card.id}/query`, { method: 'POST', body: {} })
        const rows: any[][] = queryRes?.data?.rows ?? []
        const cols: { name: string }[] = queryRes?.data?.cols ?? []
        sampleData = rows.slice(0, 30).map((row) =>
          cols.map((c, i) => `${c.name}: ${row[i]}`).join(', ')
        ).join('\n')
      } catch {
        // Non-fatal — some cards require parameters
      }

      chunks.push({
        chunk_id: `metabase_card_${card.id}`,
        title: `Metabase: ${card.name}`,
        content: [card.description, sampleData].filter(Boolean).join('\n\n') || card.name,
        source_url: `${instanceUrl}/question/${card.id}`,
        metadata: {
          provider: 'metabase',
          resource_type: 'question',
          card_id: String(card.id),
          display_type: card.display,
        },
      })
    }
  } catch (err) {
    console.error('[metabase] Failed to fetch cards:', err)
  }

  // Fetch Dashboards
  try {
    const dashboards = await metabaseFetch<MetabaseDashboard[]>(connectionId, orgId, '/dashboard')
    for (const dash of dashboards ?? []) {
      chunks.push({
        chunk_id: `metabase_dashboard_${dash.id}`,
        title: `Metabase Dashboard: ${dash.name}`,
        content: dash.description ?? dash.name,
        source_url: `${instanceUrl}/dashboard/${dash.id}`,
        metadata: {
          provider: 'metabase',
          resource_type: 'dashboard',
          dashboard_id: String(dash.id),
        },
      })
    }
  } catch (err) {
    console.error('[metabase] Failed to fetch dashboards:', err)
  }

  return chunks
}

import { supabaseAdmin }           from '@/lib/supabase/server'
import { fetchHubSpotContacts }    from '@/lib/integrations/hubspot/contacts-fetcher'
import { fetchHubSpotCompanies }   from '@/lib/integrations/hubspot/companies-fetcher'
import { fetchHubSpotDeals }       from '@/lib/integrations/hubspot/deals-fetcher'
import { fetchHubSpotNotes }       from '@/lib/integrations/hubspot/notes-fetcher'
import { indexDocument }           from '@/lib/langgraph/tools/indexer'
import type { RLSContext }         from '@/lib/supabase/rls-client'
import type { FetchedChunk }       from '@/lib/integrations/types'
import type { Visibility }         from '@/lib/knowledge-graph/types'

export interface NangoHubSpotInput {
  orgId:          string
  connectionId:   string
  dbConnectionId: string
  deptId?:        string | null
  ownerUserId?:   string | null
  visibility:     Visibility
  rlsContext?:    RLSContext
}

export interface NangoHubSpotResult {
  indexed: number
  skipped: number
  failed:  number
}

export async function runHubSpotIndexPipeline(
  input: NangoHubSpotInput
): Promise<NangoHubSpotResult> {
  const {
    orgId, connectionId, dbConnectionId,
    deptId = null, ownerUserId = null, visibility, rlsContext,
  } = input

  const [contacts, companies, deals, notes] = await Promise.all([
    fetchHubSpotContacts(connectionId, orgId),
    fetchHubSpotCompanies(connectionId, orgId),
    fetchHubSpotDeals(connectionId, orgId),
    fetchHubSpotNotes(connectionId, orgId),
  ])

  const allChunks: FetchedChunk[] = [...contacts, ...companies, ...deals, ...notes]

  let indexed = 0, skipped = 0, failed = 0

  for (const chunk of allChunks) {
    try {
      await indexDocument({
        orgId,
        deptId,
        sourceType:  'hubspot',
        content:     chunk.content,
        visibility,
        ownerUserId,
        documentData: {
          connectionId: dbConnectionId,
          externalId: chunk.chunk_id,
          title: chunk.title,
          sourceUrl: chunk.source_url,
        },
        metadata: {
          title:       chunk.title,
          provider:    chunk.metadata['provider'],
          object_type: chunk.metadata['object_type'],
          hs_id:       chunk.metadata['id'],
        },
        buildGraph: true,
        rlsContext,
      })

      indexed++
    } catch (err) {
      console.error(`[nango-hubspot] failed for ${chunk.chunk_id}:`, err instanceof Error ? err.message : String(err))
      failed++
    }
  }

  return { indexed, skipped, failed }
}
import { supabaseAdmin }           from '@/lib/supabase/server'
import { fetchHubSpotContacts }    from '@/lib/integrations/hubspot/contacts-fetcher'
import { fetchHubSpotCompanies }   from '@/lib/integrations/hubspot/companies-fetcher'
import { fetchHubSpotDeals }       from '@/lib/integrations/hubspot/deals-fetcher'
import { fetchHubSpotNotes }       from '@/lib/integrations/hubspot/notes-fetcher'
import { indexDocument }           from '@/lib/langgraph/tools/indexer'
import type { RLSContext }         from '@/lib/supabase/rls-client'
import type { FetchedChunk }       from '@/lib/integrations/salesforce/accounts-fetcher'
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
      const { data: docRow, error: docErr } = await supabaseAdmin
        .from('documents')
        .upsert(
          {
            org_id:        orgId,
            connection_id: dbConnectionId,
            external_id:   chunk.chunk_id,
            title:         chunk.title,
            source_type:   'hubspot',
            department_id: deptId,
            owner_user_id: ownerUserId,
            visibility,
            external_url:  chunk.source_url,
            metadata: {
              provider:    chunk.metadata['provider'],
              object_type: chunk.metadata['object_type'],
              hs_id:       chunk.metadata['id'],
            },
          },
          { onConflict: 'org_id,connection_id,external_id' }
        )
        .select('id')
        .single()

      if (docErr || !docRow) {
        console.error(`[nango-hubspot] doc upsert failed for ${chunk.chunk_id}:`, docErr?.message)
        failed++
        continue
      }

      await indexDocument({
        orgId,
        documentId:  docRow.id,
        deptId,
        sourceType:  'hubspot',
        content:     chunk.content,
        visibility,
        ownerUserId,
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
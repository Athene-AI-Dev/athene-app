import { supabaseAdmin }                from '@/lib/supabase/server'
import { fetchSalesforceAccounts }      from '@/lib/integrations/salesforce/accounts-fetcher'
import { fetchSalesforceOpportunities } from '@/lib/integrations/salesforce/opportunities-fetcher'
import { fetchSalesforceCases }         from '@/lib/integrations/salesforce/cases-fetcher'
import { indexDocument }                from '@/lib/langgraph/tools/indexer'
import type { RLSContext }              from '@/lib/supabase/rls-client'
import type { FetchedChunk }            from '@/lib/integrations/types'
import type { Visibility }              from '@/lib/knowledge-graph/types'

export interface NangoSalesforceInput {
  orgId:          string
  connectionId:   string
  dbConnectionId: string
  instanceUrl:    string
  deptId?:        string | null
  ownerUserId?:   string | null
  visibility:     Visibility
  rlsContext?:    RLSContext
}

export interface NangoSalesforceResult {
  indexed: number
  skipped: number
  failed:  number
}

export async function runSalesforceIndexPipeline(
  input: NangoSalesforceInput
): Promise<NangoSalesforceResult> {
  const {
    orgId, connectionId, dbConnectionId, instanceUrl,
    deptId = null, ownerUserId = null, visibility, rlsContext,
  } = input

  const [accounts, opportunities, cases] = await Promise.all([
    fetchSalesforceAccounts(connectionId, instanceUrl, orgId),
    fetchSalesforceOpportunities(connectionId, instanceUrl, orgId),
    fetchSalesforceCases(connectionId, instanceUrl, orgId),
  ])

  const allChunks: FetchedChunk[] = [...accounts, ...opportunities, ...cases]

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
            source_type:   'salesforce',
            department_id: deptId,
            owner_user_id: ownerUserId,
            visibility,
            external_url:  chunk.source_url,
            metadata: {
              provider:    chunk.metadata['provider'],
              object_type: chunk.metadata['object_type'],
              sf_id:       chunk.metadata['id'],
            },
          },
          { onConflict: 'org_id,connection_id,external_id' }
        )
        .select('id')
        .single()

      if (docErr || !docRow) {
        console.error(`[nango-salesforce] doc upsert failed for ${chunk.chunk_id}:`, docErr?.message)
        failed++
        continue
      }

      await indexDocument({
        orgId,
        documentId:  docRow.id,
        deptId,
        sourceType:  'salesforce',
        content:     chunk.content,
        visibility,
        ownerUserId,
        metadata: {
          title:       chunk.title,
          provider:    chunk.metadata['provider'],
          object_type: chunk.metadata['object_type'],
          sf_id:       chunk.metadata['id'],
        },
        buildGraph: true,
        rlsContext,
      })

      indexed++
    } catch (err) {
      console.error(`[nango-salesforce] failed for ${chunk.chunk_id}:`, err instanceof Error ? err.message : String(err))
      failed++
    }
  }

  return { indexed, skipped, failed }
}
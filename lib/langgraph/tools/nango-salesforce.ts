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
      await indexDocument({
        orgId,
        deptId,
        sourceType:  'salesforce',
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
export const dynamic = 'force-dynamic';

// ============================================================
// api/worker/nango-fetch/route.ts — Background fetch worker
//
// Called by QStash after dispatchThrottled() publishes a job.
// Flow:
//   1. Verify QStash signature (security)
//   2. Extract { orgId, connectionId, provider } from body
//   3. Look up the correct fetcher from providerFetcherMap
//   4. Call fetcher → get FetchedChunk[]
//   5. Pass each chunk through indexDocuments()
//   6. Enqueue graph-build job
//   7. Call releaseSlot() to free QStash concurrency
//
// Security rules:
//   • QStash signature verification required
//   • Nango token obtained inside fetcher, used once, discarded
//   • No tokens or raw content logged
// ============================================================

import { NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/verify'
import { releaseSlot, qstash } from '@/lib/qstash/client'
import { indexDocuments } from '@/lib/integrations/indexing'
import { logger } from '@/lib/logger'

// --- Google ---
import { fetchCalendarChunks } from '@/lib/integrations/google/calendar-fetcher'
import { fetchDriveChunks } from '@/lib/integrations/google/drive-fetcher'
// indexEmailChunks: background indexer — fetches full bodies, chunks at 2000 chars
// searchEmailChunks: live agent search — uses snippets only, never for indexing
import { indexEmailChunks } from '@/lib/integrations/google/gmail-fetcher'

// --- Microsoft ---
import { microsoftFetcher } from '@/lib/integrations/microsoft/index'

// --- Productivity & CRM ---
import { fetchSlackMessages } from '@/lib/integrations/slack/channels-fetcher'
import { fetchAllDatabases } from '@/lib/integrations/notion/databases-fetcher'
import { fetchAllPages } from '@/lib/integrations/notion/pages-fetcher'
import { fetchHubSpotCompanies } from '@/lib/integrations/hubspot/companies-fetcher'
import { fetchHubSpotContacts } from '@/lib/integrations/hubspot/contacts-fetcher'
import { fetchHubSpotDeals } from '@/lib/integrations/hubspot/deals-fetcher'
import { fetchHubSpotNotes } from '@/lib/integrations/hubspot/notes-fetcher'
import { fetchSalesforceAccounts } from '@/lib/integrations/salesforce/accounts-fetcher'
import { fetchSalesforceCases } from '@/lib/integrations/salesforce/cases-fetcher'
import { fetchSalesforceOpportunities } from '@/lib/integrations/salesforce/opportunities-fetcher'
import { fetchZendeskTickets } from '@/lib/integrations/zendesk/tickets-fetcher'
import { fetchZendeskArticles } from '@/lib/integrations/zendesk/articles-fetcher'

// --- Dev tools ---
import { githubIssuesFetcher } from '@/lib/integrations/github/issues-fetcher'
import { githubPrsFetcher } from '@/lib/integrations/github/prs-fetcher'
import { githubWikiFetcher } from '@/lib/integrations/github/wiki-fetcher'
import { linearIssuesFetcher } from '@/lib/integrations/linear/issues-fetcher'
import { linearCyclesFetcher } from '@/lib/integrations/linear/cycles-fetcher'
import { linearProjectsFetcher } from '@/lib/integrations/linear/projects-fetcher'
import { fetchJiraIssues } from '@/lib/integrations/atlassian/jira-fetcher'
import { fetchConfluencePages } from '@/lib/integrations/atlassian/confluence-fetcher'

// --- Data warehouse & BI ---
import { fetchSnowflakeSamples } from '@/lib/integrations/snowflake/sample-fetcher'
import { fetchBigQueryDatasets } from '@/lib/integrations/bigquery/datasets-fetcher'
import { fetchRedshiftTables } from '@/lib/integrations/redshift/tables-fetcher'
import { fetchLookerContent } from '@/lib/integrations/looker/looks-fetcher'
import { fetchTableauWorkbooks } from '@/lib/integrations/tableau/workbooks-fetcher'
import { fetchMetabaseContent } from '@/lib/integrations/metabase/cards-fetcher'
import { fetchDbtContent } from '@/lib/integrations/dbt/models-fetcher'
import { fetchPowerBIContent } from '@/lib/integrations/powerbi/reports-fetcher'

import { getProviderMetadata } from '@/lib/integrations/base'
import type { FetchedChunk } from '@/lib/integrations/base'
import { supabaseAdmin } from '@/lib/supabase/server'

// ---- Provider Fetcher Map ---------------------------------------

type FetcherFn = (
  connectionId: string,
  orgId: string,
  options?: { since?: string; limit?: number }
) => Promise<FetchedChunk[]>

/**
 * Map of provider keys to their full-sync fetcher functions.
 * Each entry produces FetchedChunk[] that are embedded and indexed.
 * Adding a new connector = one entry here + the fetcher file.
 */
const providerFetcherMap: Record<string, FetcherFn[]> = {
  // ── Google Workspace ─────────────────────────────────────────
  google_drive:     [(cid, oid) => fetchDriveChunks(cid, oid)],
  // Use indexEmailChunks (full body, chunked) for background indexing — NOT searchEmailChunks
  gmail:            [(cid, oid, opts) => indexEmailChunks(cid, oid, { limit: opts?.limit ?? 200 })],
  google_calendar:  [(cid, oid) => {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + 30)
    return fetchCalendarChunks(cid, oid, now, future)
  }],

  // ── Microsoft 365 ────────────────────────────────────────────
  sharepoint:   [microsoftFetcher],
  onedrive:     [microsoftFetcher],
  outlook:      [microsoftFetcher],
  ms_calendar:  [microsoftFetcher],

  // ── Communication ────────────────────────────────────────────
  slack: [fetchSlackMessages],

  // ── Productivity ─────────────────────────────────────────────
  notion: [fetchAllDatabases, fetchAllPages],

  // ── CRM ──────────────────────────────────────────────────────
  hubspot: [
    fetchHubSpotCompanies,
    fetchHubSpotContacts,
    fetchHubSpotDeals,
    fetchHubSpotNotes,
  ],
  salesforce: [
    async (connectionId, orgId) => {
      const metadata = await getProviderMetadata(connectionId, 'salesforce', orgId)
      const instanceUrl = metadata.instance_url
      if (!instanceUrl) throw new Error(`Salesforce instance_url not found for connection ${connectionId}`)
      const [accounts, cases, opportunities] = await Promise.all([
        fetchSalesforceAccounts(connectionId, instanceUrl, orgId),
        fetchSalesforceCases(connectionId, instanceUrl, orgId),
        fetchSalesforceOpportunities(connectionId, instanceUrl, orgId),
      ])
      return [...accounts, ...cases, ...opportunities]
    },
  ],
  zendesk: [
    async (connectionId, orgId) => {
      const metadata = await getProviderMetadata(connectionId, 'zendesk', orgId)
      const subdomain = metadata.subdomain
      if (!subdomain) throw new Error(`Zendesk subdomain not found for connection ${connectionId}`)
      const [tickets, articles] = await Promise.all([
        fetchZendeskTickets(connectionId, orgId, subdomain),
        fetchZendeskArticles(connectionId, orgId, subdomain),
      ])
      return [...tickets, ...articles]
    },
  ],

  // ── Dev Tools ────────────────────────────────────────────────
  github: [
    async (connectionId, orgId) => {
      const metadata = await getProviderMetadata(connectionId, 'github', orgId)
      const { owner, repo } = metadata
      if (!owner || !repo) throw new Error(`GitHub owner or repo not found for connection ${connectionId}`)
      const [issues, prs, wiki] = await Promise.all([
        githubIssuesFetcher(connectionId, orgId, owner, repo),
        githubPrsFetcher(connectionId, orgId, owner, repo),
        githubWikiFetcher(connectionId, orgId, owner, repo),
      ])
      return [...issues, ...prs, ...wiki]
    },
  ],
  linear: [
    async (connectionId, orgId) => {
      const [issues, cycles, projects] = await Promise.all([
        linearIssuesFetcher(connectionId, orgId),
        linearCyclesFetcher(connectionId, orgId),
        linearProjectsFetcher(connectionId, orgId),
      ])
      return [...issues, ...cycles, ...projects]
    },
  ],
  jira:       [fetchJiraIssues],
  confluence: [fetchConfluencePages],

  // ── Data Warehouse ───────────────────────────────────────────
  snowflake: [fetchSnowflakeSamples],
  bigquery:  [fetchBigQueryDatasets],
  redshift:  [fetchRedshiftTables],

  // ── BI Tools ─────────────────────────────────────────────────
  looker:   [fetchLookerContent],
  tableau:  [fetchTableauWorkbooks],
  metabase: [fetchMetabaseContent],
  dbt:      [fetchDbtContent],
  powerbi:  [fetchPowerBIContent],

  // ── Legacy umbrella keys (backwards compatibility) ───────────
  google: [
    (cid, oid) => fetchDriveChunks(cid, oid),
    (cid, oid, opts) => indexEmailChunks(cid, oid, { limit: opts?.limit ?? 200 }),
    (cid, oid) => {
      const now = new Date()
      const future = new Date()
      future.setDate(future.getDate() + 30)
      return fetchCalendarChunks(cid, oid, now, future)
    },
  ],
  microsoft:        [microsoftFetcher],
  'microsoft-graph':[microsoftFetcher],
}

// ---- Request body type ------------------------------------------

interface NangoFetchJobBody {
  orgId: string
  connectionId: string       // Supabase connections.id UUID — used for indexDocuments FK
  nangoConnectionId?: string // Nango connection string — used for all Nango API calls
  provider: string
  sourceType: string
  departmentId?: string | null
  since?: string
}

// ---- POST handler -----------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const isValid = await verifyQStashSignature(request)
  if (!isValid) return new Response('Invalid QStash signature', { status: 401 })

  let body: NangoFetchJobBody
  try {
    body = (await request.json()) as NangoFetchJobBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orgId, connectionId, nangoConnectionId, provider, sourceType, departmentId, since } = body

  if (!orgId || !connectionId || !provider) {
    return NextResponse.json(
      { error: 'Missing required fields: orgId, connectionId, provider' },
      { status: 400 }
    )
  }

  // Fetchers need the Nango connection string to call Nango APIs.
  // connectionId is the Supabase UUID used only for indexDocuments (FK).
  const fetcherConnectionId = nangoConnectionId ?? connectionId

  const fetchers = providerFetcherMap[provider]
  if (!fetchers) {
    return NextResponse.json(
      { error: `Unknown provider: ${provider}. Available: ${Object.keys(providerFetcherMap).join(', ')}` },
      { status: 400 }
    )
  }

  let fetchResult: { indexed: number; documentIds: string[]; errors: number } | null = null
  let allChunks: FetchedChunk[] = []
  let workerErr: unknown = null

  try {
    for (const fetcher of fetchers) {
      const chunks = await fetcher(fetcherConnectionId, orgId, { since })
      allChunks.push(...chunks)
    }

    const indexResult = await indexDocuments(allChunks, orgId, connectionId, departmentId ?? null)
    fetchResult = indexResult

    if (indexResult.indexed > 0 && indexResult.documentIds.length > 0) {
      const graphBuildUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/worker/graph-build`
      try {
        await qstash.publishJSON({
          url: graphBuildUrl,
          body: { org_id: orgId, document_ids: indexResult.documentIds, job_type: 'incremental' },
        })
      } catch (gErr) {
        logger.error({ err: gErr instanceof Error ? gErr.message : String(gErr) }, '[nango-fetch] Failed to enqueue graph-build')
      }
    }
  } catch (err) {
    workerErr = err
    logger.error(
      { provider, orgId, err: err instanceof Error ? err.message : String(err) },
      '[nango-fetch] Worker error'
    )
  } finally {
    // Always release the concurrency slot — even on crash, OOM, or early return.
    // Without this, the slot counter increments forever and future jobs queue up
    // in pending_background_jobs but never dispatch.
    try { await releaseSlot(orgId, sourceType || provider) } catch { /* best-effort */ }

    // Reset connection status so the admin UI reflects final state
    try {
      await supabaseAdmin
        .from('connections')
        .update({ status: workerErr ? 'error' : 'active' })
        .eq('id', connectionId)
    } catch { /* best-effort */ }
  }

  if (workerErr) {
    return NextResponse.json(
      { error: workerErr instanceof Error ? workerErr.message : 'Internal error' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    provider,
    chunks_fetched: allChunks.length,
    chunks_indexed: fetchResult?.indexed ?? 0,
    errors: fetchResult?.errors ?? 0,
  })
}

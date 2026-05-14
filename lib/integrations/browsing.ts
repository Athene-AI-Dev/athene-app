// ============================================================
// integrations/browsing.ts — Resource discovery for selective sync
//
// Provides a ProviderBrowser interface and per-provider
// implementations that list browsable resources (folders,
// channels, repos, etc.) without fetching any content.
//
// Used by GET /api/connections/[id]/browse to let the
// frontend present a tree picker before syncing.
//
// Security:
//   • All API calls go through the provider-specific client
//     (googleFetch, slackFetch, etc.) which handles OAuth tokens
//   • No content is fetched — metadata only
//   • orgId is always passed for ownership verification
// ============================================================

import { googleFetch } from './google/api-client'
import { slackFetch } from './slack/client'
import { notionFetch } from './notion/client'
import { githubRestFetch } from './github/client'
import { listSnowflakeTables } from './snowflake/schema-fetcher'
import { listBigQueryTables } from './bigquery/client'
import { listRedshiftTables } from './redshift/client'
import type { ProviderKey } from './providers'

// ---- Types --------------------------------------------------

/**
 * A single browsable resource node in the tree.
 * The frontend renders these as expandable tree items with checkboxes.
 */
export interface BrowsableResource {
  /** Provider-specific ID (folder ID, channel ID, repo full_name, etc.) */
  id: string
  /** Human-readable display name */
  name: string
  /** Resource kind — determines icon and behavior in the UI */
  type: 'folder' | 'file' | 'channel' | 'repo' | 'database' | 'page' | 'space' | 'project' | 'object_type'
  /** True if this node can be expanded to show children */
  hasChildren: boolean
  /** Breadcrumb path for display (e.g. "My Drive / Engineering / Docs") */
  path: string
  /** Provider-specific metadata for display (icon, count, last modified, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * Result of a browse operation. Supports pagination.
 */
export interface BrowseResult {
  resources: BrowsableResource[]
  /** Pagination token for the next page, if there is one */
  nextPageToken?: string
}

/**
 * Signature for a provider's browse function.
 *
 * @param connectionId - Nango connection ID
 * @param orgId        - Organization ID for ownership verification
 * @param parentId     - ID of the parent to list children of (null = root)
 * @param options      - Pagination options
 */
export type ProviderBrowser = (
  connectionId: string,
  orgId: string,
  parentId?: string | null,
  options?: { pageToken?: string; limit?: number }
) => Promise<BrowseResult>

// ---- Provider Implementations --------------------------------

/**
 * Google Drive browser — lists folders and files.
 * At root level, lists folders first.
 * When parentId is provided, lists children of that folder.
 */
async function browseDrive(
  connectionId: string,
  orgId: string,
  parentId?: string | null,
  options?: { pageToken?: string; limit?: number }
): Promise<BrowseResult> {
  const parent = parentId ?? 'root'
  const pageSize = Math.min(options?.limit ?? 50, 100)

  const q = `'${parent}' in parents and trashed=false`
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,owners),nextPageToken',
    pageSize: String(pageSize),
    orderBy: 'folder,name',
  })
  if (options?.pageToken) params.set('pageToken', options.pageToken)

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  const listing = await googleFetch<{
    files: Array<{
      id: string
      name: string
      mimeType: string
      webViewLink?: string
      modifiedTime?: string
      owners?: Array<{ displayName: string }>
    }>
    nextPageToken?: string
  }>(connectionId, orgId, url)

  const resources: BrowsableResource[] = listing.files.map((file) => {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
    return {
      id: file.id,
      name: file.name,
      type: isFolder ? 'folder' as const : 'file' as const,
      hasChildren: isFolder,
      path: parent === 'root' ? `/${file.name}` : `/${file.name}`,
      metadata: {
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        owner: file.owners?.[0]?.displayName,
        webViewLink: file.webViewLink,
      },
    }
  })

  return {
    resources,
    nextPageToken: listing.nextPageToken,
  }
}

/**
 * Slack browser — lists public channels.
 * Slack has a flat structure, so parentId is ignored.
 */
async function browseSlack(
  connectionId: string,
  orgId: string,
  _parentId?: string | null,
  options?: { pageToken?: string; limit?: number }
): Promise<BrowseResult> {
  const params: Record<string, string> = {
    exclude_archived: 'true',
    types: 'public_channel',
    limit: String(Math.min(options?.limit ?? 100, 200)),
  }
  if (options?.pageToken) params.cursor = options.pageToken

  const res = await slackFetch<{
    channels: Array<{
      id: string
      name: string
      num_members?: number
      topic?: { value: string }
      purpose?: { value: string }
    }>
    response_metadata?: { next_cursor?: string }
  }>(connectionId, orgId, 'conversations.list', params)

  const resources: BrowsableResource[] = res.channels
    .filter((ch: any) => !ch.is_archived)
    .map((ch) => ({
      id: ch.id,
      name: `#${ch.name}`,
      type: 'channel' as const,
      hasChildren: false,
      path: `/#${ch.name}`,
      metadata: {
        memberCount: ch.num_members,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value,
      },
    }))

  return {
    resources,
    nextPageToken: res.response_metadata?.next_cursor || undefined,
  }
}

/**
 * Notion browser — lists pages and databases at the workspace root.
 * Notion's API uses search, so parentId is used as a filter hint.
 */
async function browseNotion(
  connectionId: string,
  orgId: string,
  _parentId?: string | null,
  options?: { pageToken?: string; limit?: number }
): Promise<BrowseResult> {
  const searchBody: Record<string, unknown> = {
    page_size: Math.min(options?.limit ?? 50, 100),
  }
  if (options?.pageToken) searchBody.start_cursor = options.pageToken

  const res = await notionFetch(connectionId, orgId, '/search', searchBody)

  const resources: BrowsableResource[] = []

  for (const item of res.results ?? []) {
    if (item.object === 'database') {
      const title = item.title?.map((t: any) => t.plain_text).join('') || 'Untitled Database'
      resources.push({
        id: item.id,
        name: title,
        type: 'database',
        hasChildren: true,
        path: `/${title}`,
        metadata: {
          lastEdited: item.last_edited_time,
          url: item.url,
        },
      })
    } else if (item.object === 'page') {
      const props = item.properties ?? {}
      const titleProp = Object.values(props).find((p: any) => p.type === 'title') as any
      const title = titleProp?.title?.map((t: any) => t.plain_text).join('') || 'Untitled Page'
      resources.push({
        id: item.id,
        name: title,
        type: 'page',
        hasChildren: false,
        path: `/${title}`,
        metadata: {
          lastEdited: item.last_edited_time,
          url: item.url,
        },
      })
    }
  }

  return {
    resources,
    nextPageToken: res.has_more ? res.next_cursor : undefined,
  }
}

/**
 * GitHub browser — lists repos for the authenticated user.
 * parentId is not used at root level.
 */
async function browseGitHub(
  connectionId: string,
  orgId: string,
  _parentId?: string | null,
  options?: { pageToken?: string; limit?: number }
): Promise<BrowseResult> {
  const perPage = Math.min(options?.limit ?? 30, 100)
  const page = options?.pageToken ? parseInt(options.pageToken, 10) : 1

  const repos = await githubRestFetch(
    connectionId,
    orgId,
    `/user/repos?per_page=${perPage}&page=${page}&sort=updated&type=all`
  ) as Array<{
    full_name: string
    name: string
    description?: string
    html_url: string
    language?: string
    updated_at: string
    default_branch: string
    private: boolean
    has_wiki: boolean
    has_issues: boolean
  }>

  const resources: BrowsableResource[] = repos.map((repo) => ({
    id: repo.full_name,
    name: repo.name,
    type: 'repo' as const,
    hasChildren: false,
    path: `/${repo.full_name}`,
    metadata: {
      description: repo.description,
      language: repo.language,
      updatedAt: repo.updated_at,
      htmlUrl: repo.html_url,
      isPrivate: repo.private,
      hasWiki: repo.has_wiki,
      hasIssues: repo.has_issues,
    },
  }))

  // GitHub uses page-based pagination — encode next page number as token
  const hasMore = repos.length === perPage
  return {
    resources,
    nextPageToken: hasMore ? String(page + 1) : undefined,
  }
}

/**
 * Snowflake browser — lists available tables.
 */
async function browseSnowflake(
  connectionId: string,
  orgId: string
): Promise<BrowseResult> {
  const tables = await listSnowflakeTables(connectionId, orgId)
  return {
    resources: tables.map((t) => ({
      id: t.fullName,
      name: t.fullName,
      type: 'database' as const,
      hasChildren: false,
      path: `/${t.fullName}`,
    })),
  }
}

/**
 * BigQuery browser — lists available tables.
 */
async function browseBigQuery(
  connectionId: string,
  orgId: string
): Promise<BrowseResult> {
  const tables = await listBigQueryTables(connectionId, orgId)
  return {
    resources: tables.map((t) => ({
      id: t.fullName,
      name: t.fullName,
      type: 'database' as const,
      hasChildren: false,
      path: `/${t.fullName}`,
    })),
  }
}

/**
 * Redshift browser — lists available tables.
 */
async function browseRedshift(
  connectionId: string,
  orgId: string
): Promise<BrowseResult> {
  const tables = await listRedshiftTables(connectionId, orgId)
  return {
    resources: tables.map((t) => ({
      id: t.fullName,
      name: t.fullName,
      type: 'database' as const,
      hasChildren: false,
      path: `/${t.fullName}`,
    })),
  }
}

// ---- Registry -----------------------------------------------

/**
 * Map of provider keys to their browse function.
 * Only Tier 1 providers have browse implementations.
 * Other providers will return a "sync all" fallback.
 */
const providerBrowserMap: Partial<Record<ProviderKey, ProviderBrowser>> = {
  google_drive: browseDrive,
  google: browseDrive,
  slack: browseSlack,
  notion: browseNotion,
  github: browseGitHub,
  snowflake: browseSnowflake,
  bigquery: browseBigQuery,
  redshift: browseRedshift,
}

/**
 * Returns the browse function for a given provider, or null if unsupported.
 */
export function getProviderBrowser(provider: ProviderKey): ProviderBrowser | null {
  return providerBrowserMap[provider] ?? null
}

/**
 * Returns true if the provider supports granular resource browsing.
 */
export function isBrowsable(provider: ProviderKey): boolean {
  return provider in providerBrowserMap
}

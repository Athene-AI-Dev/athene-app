// ============================================================
// tools/live-search.ts — Live search tool for real-time queries
//
// Searcher registry pattern: each integration registers a
// search function that queries the provider's native search API.
// Results are NEVER persisted — ephemeral for the current turn.
//
// Registered searchers:
//   • slack   → searchSlack (search.messages API)
//   • zendesk → searchZendesk (unified search API)
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { FetchedChunk, ProviderSearcher } from '@/lib/integrations/base'
import { getProviderMetadata } from '@/lib/integrations/base'
import { searchSlack } from '@/lib/integrations/slack/searcher'
import { searchZendesk } from '@/lib/integrations/zendesk/searcher'
import { notionSearch } from '@/lib/integrations/notion/searcher'
import { snowflakeSearch } from '@/lib/integrations/snowflake/searcher'
import { registerTool } from './registry'
import { logger } from '@/lib/logger'

// ---- Searcher Registry ------------------------------------------

const searcherRegistry = new Map<string, ProviderSearcher>()

/**
 * Registers a search function for a provider.
 * Called at module load time for built-in providers.
 */
export function registerSearcher(name: string, searcher: ProviderSearcher): void {
  searcherRegistry.set(name, searcher)
}

/**
 * Returns a registered searcher, or undefined if not found.
 */
export function getSearcher(name: string): ProviderSearcher | undefined {
  return searcherRegistry.get(name)
}

/**
 * Returns all registered searcher names.
 */
export function listSearchers(): string[] {
  return Array.from(searcherRegistry.keys())
}

// ---- Built-in Searcher Wrappers ---------------------------------

const slackSearcher: ProviderSearcher = async (
  connectionId,
  orgId,
  query,
  options = {}
) => {
  return searchSlack(connectionId, orgId, query, options.limit)
}

const zendeskSearcher: ProviderSearcher = async (
  connectionId,
  orgId,
  query,
  options = {}
) => {
  const metadata = await getProviderMetadata(connectionId, 'zendesk', orgId)
  const subdomain = metadata.subdomain as string | undefined
  if (!subdomain) return []

  return searchZendesk(connectionId, orgId, subdomain, query, options.limit)
}

// ---- Register built-in searchers --------------------------------

registerSearcher('slack', slackSearcher)
registerSearcher('zendesk', zendeskSearcher)

// Register notion searcher
registerSearcher('notion', async (connectionId, orgId, query, options = {}) => {
  return notionSearch(connectionId, orgId, query)
})

// Register snowflake searcher
registerSearcher('snowflake', async (connectionId, orgId, query, options = {}) => {
  return snowflakeSearch(connectionId, orgId, query)
})

// ---- Core function ----------------------------------------------

/**
 * Live search — core logic used by both the LangGraph tool and
 * any direct callers.
 */
export async function liveSearch(
  provider: string,
  connectionId: string,
  orgId: string,
  query: string,
  options: { limit?: number } = {}
): Promise<FetchedChunk[]> {
  const searcher = searcherRegistry.get(provider)

  if (!searcher) {
    logger.warn({ provider, available: listSearchers() }, '[live-search] Unknown provider')
    return []
  }

  try {
    return await searcher(connectionId, orgId, query, options)
  } catch (err) {
    logger.error({ provider, err: err instanceof Error ? err.message : String(err) }, '[live-search] Error searching provider')
    return []
  }
}

// ---- LangGraph Tool Export --------------------------------------

/**
 * DynamicStructuredTool wrapper around liveSearch.
 * Used by the retrieval-agent node to perform real-time searches
 * against provider native search APIs during a conversation.
 * Auto-registered in the global tool registry on module load.
 */
export const liveSearchTool = new DynamicStructuredTool({
  name: 'live_search',
  description:
    'Performs a real-time search across an external integration (e.g. Slack messages, Zendesk tickets/articles) for a specific query.',
  schema: z.object({
    provider: z
      .string()
      .describe("The integration provider (e.g., 'slack', 'zendesk', 'github', 'linear')"),
    connectionId: z
      .string()
      .describe("The Nango connection ID for the user's integration"),
    query: z.string().describe('The search query string'),
    orgId: z.string().optional().describe('The Organization ID'),
    limit: z.number().optional().describe('Max number of results to return'),
  }),
  func: async ({ provider, connectionId, query, orgId, limit }) => {
    const results: FetchedChunk[] = await liveSearch(
      provider,
      connectionId,
      orgId ?? 'unknown',
      query,
      { limit }
    )

    if (results.length === 0) {
      return `No results found for query: "${query}" on provider '${provider}'.`
    }

    return JSON.stringify(
      results.map((r: FetchedChunk) => ({
        title: r.title,
        content: r.content,
        url: r.source_url,
      })),
      null,
      2
    )
  },
})

// Auto-register with the tool registry
registerTool(liveSearchTool)

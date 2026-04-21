// ============================================================
// tools/live-search.ts — Live search tool for real-time queries
//
// Searcher registry pattern: each integration registers a
// search function that queries the provider's native search API.
// Results are NEVER persisted — ephemeral for the current turn.
// ============================================================

import type { FetchedChunk, ProviderSearcher } from '@/lib/integrations/base'
import { searchSlack } from '@/lib/integrations/slack/searcher'
import { searchZendesk } from '@/lib/integrations/zendesk/searcher'
import { getProviderMetadata } from '@/lib/integrations/base'

// ---- Searcher Registry ------------------------------------------

const searcherRegistry = new Map<string, ProviderSearcher>()

/**
 * Registers a search function for a provider.
 */
export function registerSearcher(
  name: string,
  searcher: ProviderSearcher
): void {
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

// ---- Slack Searcher Wrapper -------------------------------------

const slackSearcher: ProviderSearcher = async (
  connectionId,
  orgId,
  query,
  options = {}
) => {
  return searchSlack(connectionId, orgId, query, options.limit)
}

// ---- Zendesk Searcher Wrapper -----------------------------------

const zendeskSearcher: ProviderSearcher = async (
  connectionId,
  orgId,
  query,
  options = {}
) => {
  const metadata = await getProviderMetadata(connectionId, 'zendesk', orgId)
  const subdomain = metadata.subdomain
  if (!subdomain) return []

  return searchZendesk(connectionId, orgId, subdomain, query, options.limit)
}

// ---- Register built-in searchers --------------------------------

registerSearcher('slack', slackSearcher)
registerSearcher('zendesk', zendeskSearcher)

// ---- Tool function ----------------------------------------------

/**
 * Live search — called by the retrieval-agent tool.
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
    console.warn(
      `[live-search] Unknown provider "${provider}". Available: ${listSearchers().join(', ')}`
    )
    return []
  }

  try {
    return await searcher(connectionId, orgId, query, options)
  } catch (err) {
    console.error(
      `[live-search] Error searching ${provider}:`,
      err instanceof Error ? err.message : String(err)
    )
    return []
  }
}

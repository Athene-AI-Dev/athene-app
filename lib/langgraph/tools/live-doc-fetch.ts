// ============================================================
// tools/live-doc-fetch.ts — Ephemeral content fetcher tool
//
// Provider registry pattern: each integration registers a
// fetcher function. When the retrieval-agent calls this tool,
// it looks up the provider and calls the fetcher with limited
// scope (recent content only). Results are NEVER persisted —
// they exist only for the current agent turn.
//
// Registered providers:
//   • slack   → fetchSlackChannels (limited to recent messages)
//   • zendesk → fetchZendeskTickets + fetchZendeskArticles
// ============================================================

import type { FetchedChunk, ProviderFetcher } from '@/lib/integrations/base'
import { fetchSlackMessages } from '@/lib/integrations/slack/channels-fetcher'
import { fetchZendeskTickets } from '@/lib/integrations/zendesk/tickets-fetcher'
import { fetchZendeskArticles } from '@/lib/integrations/zendesk/articles-fetcher'
import { getProviderMetadata } from '@/lib/integrations/base'

// ---- Provider Registry ------------------------------------------

const providerRegistry = new Map<string, ProviderFetcher>()

/**
 * Registers a fetcher function for a provider.
 * Called at module load time for built-in providers, or dynamically
 * for custom integrations.
 */
export function registerProvider(name: string, fetcher: ProviderFetcher): void {
  providerRegistry.set(name, fetcher)
}

/**
 * Returns a registered provider fetcher, or undefined if not found.
 */
export function getProvider(name: string): ProviderFetcher | undefined {
  return providerRegistry.get(name)
}

/**
 * Returns all registered provider names.
 */
export function listProviders(): string[] {
  return Array.from(providerRegistry.keys())
}

// ---- Built-in Provider Wrappers ---------------------------------

/**
 * Slack provider: fetches recent public channel messages.
 * Limited to last 7 days for live context (vs 90 days for full sync).
 */
const slackProvider: ProviderFetcher = async (
  connectionId,
  orgId,
  options = {}
) => {
  // For live fetch, default to last 7 days (not 90)
  const since =
    options.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return fetchSlackMessages(connectionId, orgId)
}

/**
 * Zendesk provider: fetches recent tickets + knowledge base articles.
 * Both are merged into a single FetchedChunk[] result.
 */
const zendeskProvider: ProviderFetcher = async (
  connectionId,
  orgId,
  options = {}
) => {
  const since =
    options.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const metadata = await getProviderMetadata(connectionId, 'zendesk', orgId)
  const subdomain = metadata.subdomain
  if (!subdomain) return []

  const [tickets, articles] = await Promise.all([
    fetchZendeskTickets(connectionId, orgId, subdomain),
    fetchZendeskArticles(connectionId, orgId, subdomain),
  ])

  return [...tickets, ...articles]
}

// ---- Register built-in providers --------------------------------

registerProvider('slack', slackProvider)
registerProvider('zendesk', zendeskProvider)

// ---- Tool function ----------------------------------------------

/**
 * Live document fetch — called by the retrieval-agent tool.
 *
 * Fetches ephemeral content from a registered provider.
 * Results are NOT persisted to Supabase — they exist only
 * for the current agent turn as part of retrieved_chunks.
 *
 * @param provider - Provider name (e.g. 'slack', 'zendesk')
 * @param connectionId - Nango connection ID
 * @param orgId - Organization ID
 * @param options - Optional filters
 * @returns FetchedChunk[] — ephemeral, never stored
 */
export async function liveDocFetch(
  provider: string,
  connectionId: string,
  orgId: string,
  options: { since?: string; limit?: number } = {}
): Promise<FetchedChunk[]> {
  const fetcher = providerRegistry.get(provider)

  if (!fetcher) {
    console.warn(
      `[live-doc-fetch] Unknown provider "${provider}". Available: ${listProviders().join(', ')}`
    )
    return []
  }

  try {
    return await fetcher(connectionId, orgId, options)
  } catch (err) {
    console.error(
      `[live-doc-fetch] Error fetching from ${provider}:`,
      err instanceof Error ? err.message : String(err)
    )
    return []
  }
}

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
//   • slack   → fetchSlackMessages (last 30 days)
//   • zendesk → fetchZendeskTickets + fetchZendeskArticles
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type { FetchedChunk, ProviderFetcher } from '@/lib/integrations/base'
import { getProviderMetadata } from '@/lib/integrations/base'
import { fetchSlackMessages } from '@/lib/integrations/slack/channels-fetcher'
import { fetchZendeskTickets } from '@/lib/integrations/zendesk/tickets-fetcher'
import { fetchZendeskArticles } from '@/lib/integrations/zendesk/articles-fetcher'
import { registerTool } from './registry'

// ---- Provider Registry ------------------------------------------

const providerRegistry = new Map<string, ProviderFetcher>()

/**
 * Registers a fetcher function for a provider.
 * Called at module load time for built-in providers, or dynamically
 * for custom integrations (GitHub, Linear, etc.).
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
 * Limited to last 7 days for live context (vs 30 days for full sync).
 */
const slackProvider: ProviderFetcher = async (
  connectionId,
  orgId,
  _options = {}
) => {
  return fetchSlackMessages(connectionId, orgId)
}

/**
 * Zendesk provider: fetches recent tickets + knowledge base articles.
 * Both are merged into a single FetchedChunk[] result.
 */
const zendeskProvider: ProviderFetcher = async (
  connectionId,
  orgId,
  _options = {}
) => {
  const metadata = await getProviderMetadata(connectionId, 'zendesk', orgId)
  const subdomain = metadata.subdomain as string | undefined
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

// ---- Core function ----------------------------------------------

/**
 * Live document fetch — core logic used by both the LangGraph tool
 * and any direct callers.
 *
 * Fetches ephemeral content from a registered provider.
 * Results are NOT persisted to Supabase — they exist only
 * for the current agent turn as part of retrieved_chunks.
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

// ---- LangGraph Tool Export --------------------------------------

/**
 * DynamicStructuredTool wrapper around liveDocFetch.
 * Used by the retrieval-agent node to pull live content during a conversation.
 * Auto-registered in the global tool registry on module load.
 */
export const liveDocFetchTool = new DynamicStructuredTool({
  name: 'live_doc_fetch',
  description:
    "Fetches live, ephemeral content from an external integration given a provider and connectionId. Use this when you need the most up-to-date data that might not be indexed yet.",
  schema: z.object({
    provider: z
      .string()
      .describe("The integration provider (e.g., 'slack', 'zendesk', 'github', 'linear')"),
    connectionId: z
      .string()
      .describe("The Nango connection ID for the user's integration"),
    orgId: z.string().optional().describe('The Organization ID'),
    since: z
      .string()
      .optional()
      .describe('ISO timestamp — only return content newer than this'),
    limit: z.number().optional().describe('Max number of chunks to return'),
  }),
  func: async ({ provider, connectionId, orgId, since, limit }) => {
    const chunks: FetchedChunk[] = await liveDocFetch(
      provider,
      connectionId,
      orgId ?? 'unknown',
      { since, limit }
    )

    if (chunks.length === 0) {
      return `No content found for provider '${provider}'.`
    }

    return JSON.stringify(
      chunks.map((c: FetchedChunk) => ({
        title: c.title,
        content: c.content,
        url: c.source_url,
      })),
      null,
      2
    )
  },
})

// Auto-register with the tool registry
registerTool(liveDocFetchTool)

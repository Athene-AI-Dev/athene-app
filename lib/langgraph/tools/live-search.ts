// ============================================================
// live-search.ts — Mode B: zero-indexing search (ATH-28)
//
// For orgs that refuse ANY indexing — we hit the source provider's
// native search API live and return the top few results. Nothing
// is written to Supabase.
//
// Each provider plugs in a search handler. live-search dispatches
// the query across all enabled sources for the org and returns a
// unified shape.
// ============================================================

export type LiveSearchResult = {
  source_type: string;
  external_id: string;
  title: string | null;
  snippet: string | null;
  url: string | null;
  /** Provider-specific relevance score, when available. */
  score?: number;
};

export type ProviderSearcher = (args: {
  orgId: string;
  query: string;
  limit: number;
}) => Promise<LiveSearchResult[]>;

const searcherRegistry = new Map<string, ProviderSearcher>();

export function registerSearcher(sourceType: string, searcher: ProviderSearcher): void {
  searcherRegistry.set(sourceType, searcher);
}

export function getRegisteredSearchers(): string[] {
  return Array.from(searcherRegistry.keys());
}

export type LiveSearchOptions = {
  /** Max results per source. Default 5. */
  perSourceLimit?: number;
  /** Overall cap across all sources. Default 15. */
  totalLimit?: number;
};

/**
 * Live-search across the requested sources. Unknown / unregistered
 * sources are skipped with a warning (no throw). Per-source failures
 * are logged and the other sources still return their results.
 */
export async function liveSearch(
  orgId: string,
  query: string,
  sources: string[],
  options: LiveSearchOptions = {}
): Promise<LiveSearchResult[]> {
  if (!orgId) throw new Error("orgId is required");
  if (!query || query.trim().length === 0) return [];
  if (!Array.isArray(sources) || sources.length === 0) return [];

  const perSourceLimit = options.perSourceLimit ?? 5;
  const totalLimit = options.totalLimit ?? 15;

  const settled = await Promise.all(
    sources.map(async (sourceType) => {
      const searcher = searcherRegistry.get(sourceType);
      if (!searcher) {
        console.warn(`[live-search] no searcher registered for "${sourceType}"`);
        return [] as LiveSearchResult[];
      }
      try {
        const res = await searcher({ orgId, query, limit: perSourceLimit });
        return res.slice(0, perSourceLimit);
      } catch (err) {
        console.error(
          `[live-search] searcher "${sourceType}" failed:`,
          err instanceof Error ? err.message : String(err)
        );
        return [] as LiveSearchResult[];
      }
    })
  );

  // Flatten, then rank: provider scores aren't comparable across
  // systems, so we interleave round-robin up to the total cap.
  return interleaveCap(settled, totalLimit);
}

function interleaveCap(
  groups: LiveSearchResult[][],
  cap: number
): LiveSearchResult[] {
  const out: LiveSearchResult[] = [];
  const cursors = groups.map(() => 0);
  let hasMore = true;
  while (out.length < cap && hasMore) {
    hasMore = false;
    for (let g = 0; g < groups.length && out.length < cap; g++) {
      const c = cursors[g];
      if (c < groups[g].length) {
        out.push(groups[g][c]);
        cursors[g] = c + 1;
        hasMore = true;
      }
    }
  }
  return out;
}

import { getConnectionToken } from '@/lib/nango/client'
import { salesforceFetch }    from '@/lib/integrations/salesforce/client'
import { hubspotFetch }       from '@/lib/integrations/hubspot/client'

registerSearcher('salesforce', async ({ orgId, query, limit }) => {
  // requires connectionId — get from org's active connection
  // This searcher is a stub until connection lookup is wired in ATH-71
  return []
})

registerSearcher('hubspot', async ({ orgId, query, limit }) => {
  return []
})

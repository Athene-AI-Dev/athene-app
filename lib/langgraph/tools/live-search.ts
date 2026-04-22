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

// ============================================================
// Salesforce searcher — SOSL query via REST API (ATH-67)
//
// Uses Salesforce SOSL (Salesforce Object Search Language) to
// search across Accounts, Opportunities, and Cases.
// Requires an active connection for the org (looked up from
// nango_connections via Supabase).
// ============================================================

import { salesforceFetch } from '@/lib/integrations/salesforce/client'
import { hubspotFetch }    from '@/lib/integrations/hubspot/client'
import { supabaseAdmin }   from '@/lib/supabase/server'

/**
 * Look up the active Nango connection for a given org + provider.
 * Returns { connectionId, metadata } or null if none found.
 */
async function getOrgConnection(orgId: string, provider: string) {
  const { data, error } = await supabaseAdmin
    .from('nango_connections')
    .select('connection_id, metadata')
    .eq('org_id', orgId)
    .eq('provider_config_key', provider)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    connectionId: data.connection_id as string,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  }
}

registerSearcher('salesforce', async ({ orgId, query, limit }) => {
  const conn = await getOrgConnection(orgId, 'salesforce')
  if (!conn) {
    console.warn('[live-search:salesforce] no active connection for org', orgId)
    return []
  }

  // Escape SOSL special chars
  const safeQuery = query.replace(/[?&|!{}[\]()^~*:\\"'+\-]/g, '\\$&')
  const instanceUrl = (conn.metadata?.instance_url as string) || undefined

  // SOSL: search Accounts, Opportunities, Cases
  const soslPath = `/search/?q=FIND+{${encodeURIComponent(safeQuery)}}+IN+ALL+FIELDS+RETURNING+` +
    `Account(Id,Name+LIMIT+${limit}),` +
    `Opportunity(Id,Name+LIMIT+${limit}),` +
    `Case(Id,Subject+LIMIT+${limit})`

  try {
    const data = await salesforceFetch(conn.connectionId, soslPath, orgId, instanceUrl) as {
      searchRecords: Array<{
        attributes: { type: string }
        Id: string
        Name?: string
        Subject?: string
      }>
    }

    const baseUrl = instanceUrl ?? 'https://login.salesforce.com'
    return (data.searchRecords ?? []).slice(0, limit).map((rec) => ({
      source_type: 'salesforce',
      external_id: `sf-${rec.attributes.type.toLowerCase()}-${rec.Id}`,
      title:       rec.Name ?? rec.Subject ?? rec.Id,
      snippet:     null,
      url:         `${baseUrl}/lightning/r/${rec.attributes.type}/${rec.Id}/view`,
    }))
  } catch (err) {
    console.error('[live-search:salesforce] SOSL query failed:', err instanceof Error ? err.message : String(err))
    return []
  }
})

// ============================================================
// HubSpot searcher — CRM search API (ATH-67)
//
// Uses the HubSpot CRM search endpoint to find contacts,
// companies, deals, and notes matching the query.
// ============================================================

registerSearcher('hubspot', async ({ orgId, query, limit }) => {
  const conn = await getOrgConnection(orgId, 'hubspot')
  if (!conn) {
    console.warn('[live-search:hubspot] no active connection for org', orgId)
    return []
  }

  const objectTypes = ['contacts', 'companies', 'deals'] as const
  const perType     = Math.max(1, Math.ceil(limit / objectTypes.length))
  const results: LiveSearchResult[] = []

  for (const objType of objectTypes) {
    try {
      // HubSpot CRM search API — POST /crm/v3/objects/{type}/search
      const searchBody = JSON.stringify({
        query,
        limit: perType,
      })

      // hubspotFetch is GET-oriented, but search requires POST.
      // We use the raw fetch with the same token pattern.
      const { getConnectionToken } = await import('@/lib/nango/client')
      const accessToken = await getConnectionToken(conn.connectionId, 'hubspot', orgId)

      const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objType}/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: searchBody,
      })

      if (!res.ok) continue

      const data = await res.json() as {
        results: Array<{
          id: string
          properties: Record<string, string | null>
        }>
      }

      const singularType = objType.replace(/s$/, '') // contacts → contact

      for (const rec of (data.results ?? []).slice(0, perType)) {
        const p = rec.properties
        const title =
          [p['firstname'], p['lastname']].filter(Boolean).join(' ') ||
          p['name'] ??
          p['dealname'] ??
          rec.id

        results.push({
          source_type: 'hubspot',
          external_id: `hs-${singularType}-${rec.id}`,
          title,
          snippet: p['description'] ?? p['hs_note_body']?.slice(0, 200) ?? null,
          url: `https://app.hubspot.com/contacts/${singularType}/${rec.id}`,
        })
      }
    } catch (err) {
      console.error(
        `[live-search:hubspot] ${objType} search failed:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return results.slice(0, limit)
})

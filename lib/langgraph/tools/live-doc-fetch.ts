// ============================================================
// live-doc-fetch.ts — Query-time doc fetcher (ATH-28)
//
// Used at synthesis time. Given chunk IDs returned from vector
// search, this module:
//   1. Looks up metadata (document_id, source_type, external_url,
//      etc.) from document_embeddings + documents.
//   2. Dispatches to the provider-specific Nango fetcher to pull
//      the fresh content from the source system.
//   3. Returns { chunk_id, content, title, source_url } in RAM.
//
// Rule #2: the caller is responsible for discarding `content`
// after synthesis. This module never writes content back anywhere.
// ============================================================
import '@/lib/integrations/salesforce/provider'
import '@/lib/integrations/hubspot/provider'
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RLSContext } from "@/lib/supabase/rls-client";
import { withRLS } from "@/lib/supabase/rls-client";

export type FetchedChunk = {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  title: string | null;
  source_url: string | null;
  source_type: string;
  content: string;
};

type ChunkMetadataRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  source_type: string;
  documents: {
    id: string;
    title: string | null;
    external_id: string;
    external_url: string | null;
    connection_id: string;
  } | null;
};

/**
 * Provider fetch contract. Each source adapter (gdrive, sharepoint,
 * jira, confluence, outlook, etc.) implements this interface.
 */
export type ProviderFetcher = (args: {
  orgId: string;
  connectionId: string;
  externalId: string;
  chunkIndex: number;
}) => Promise<{ content: string; title?: string | null } | null>;

const providerRegistry = new Map<string, ProviderFetcher>();

export function registerProvider(sourceType: string, fetcher: ProviderFetcher): void {
  providerRegistry.set(sourceType, fetcher);
}

export function getRegisteredProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

/**
 * Fetch fresh content for a batch of chunk IDs. RLS-scoped: only
 * chunks the caller is authorized to see will resolve.
 */
export async function liveDocFetch(
  ctx: RLSContext,
  chunkIds: string[]
): Promise<FetchedChunk[]> {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) return [];

  // 1. Load metadata under RLS
  const rows = await withRLS(ctx, async (supabase) => {
    const { data, error } = await supabase
      .from("document_embeddings")
      .select(
        "id, document_id, chunk_index, source_type, documents(id, title, external_id, external_url, connection_id)"
      )
      .in("id", chunkIds);
    if (error) throw new Error(`live-doc-fetch metadata lookup failed: ${error.message}`);
    return (data ?? []) as unknown as ChunkMetadataRow[];
  });

  if (rows.length === 0) return [];

  // 2. Dispatch to provider fetchers in parallel, bounded
  const CONCURRENCY = 8;
  const results: FetchedChunk[] = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (row) => {
        if (!row.documents) return null;
        const fetcher = providerRegistry.get(row.source_type);
        if (!fetcher) {
          console.warn(`[live-doc-fetch] no provider registered for "${row.source_type}"`);
          return null;
        }
        try {
          const out = await fetcher({
            orgId: ctx.org_id,
            connectionId: row.documents.connection_id,
            externalId: row.documents.external_id,
            chunkIndex: row.chunk_index,
          });
          if (!out) return null;
          return {
            chunk_id: row.id,
            document_id: row.document_id,
            chunk_index: row.chunk_index,
            title: out.title ?? row.documents.title ?? null,
            source_url: row.documents.external_url,
            source_type: row.source_type,
            content: out.content,
          } satisfies FetchedChunk;
        } catch (err) {
          console.error(
            `[live-doc-fetch] provider "${row.source_type}" failed:`,
            err instanceof Error ? err.message : String(err)
          );
          return null;
        }
      })
    );
    for (const r of settled) if (r) results.push(r);
  }

  return results;
}

/**
 * Admin variant — used by server-side maintenance scripts that
 * already hold service-role context. Skips RLS. Do NOT expose to
 * user-facing code paths.
 */
export async function liveDocFetchAdmin(
  orgId: string,
  chunkIds: string[]
): Promise<FetchedChunk[]> {
  if (!Array.isArray(chunkIds) || chunkIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("document_embeddings")
    .select(
      "id, document_id, chunk_index, source_type, documents(id, title, external_id, external_url, connection_id)"
    )
    .eq("org_id", orgId)
    .in("id", chunkIds);
  if (error) throw new Error(`live-doc-fetch admin metadata lookup failed: ${error.message}`);

  const rows = (data ?? []) as unknown as ChunkMetadataRow[];
  const results: FetchedChunk[] = [];
  for (const row of rows) {
    if (!row.documents) continue;
    const fetcher = providerRegistry.get(row.source_type);
    if (!fetcher) continue;
    const out = await fetcher({
      orgId,
      connectionId: row.documents.connection_id,
      externalId: row.documents.external_id,
      chunkIndex: row.chunk_index,
    }).catch(() => null);
    if (!out) continue;
    results.push({
      chunk_id: row.id,
      document_id: row.document_id,
      chunk_index: row.chunk_index,
      title: out.title ?? row.documents.title ?? null,
      source_url: row.documents.external_url,
      source_type: row.source_type,
      content: out.content,
    });
  }
  return results;
}

// ============================================================
// types.ts — Shared CRM integration types (ATH-67)
//
// Single source of truth for the FetchedChunk shape returned by
// all CRM fetchers (Salesforce, HubSpot). Prevents type drift
// across multiple fetcher files.
// ============================================================

/**
 * A chunk of content fetched from a CRM provider.
 * This shape is the contract between fetchers and the indexing pipeline.
 */
export interface FetchedChunk {
  /** Unique identifier: `<provider-prefix>-<object_type>-<external_id>` */
  chunk_id: string
  /** Human-readable title of the record */
  title: string
  /** Assembled text content for embedding (never persisted) */
  content: string
  /** Deep-link URL back to the source system */
  source_url: string
  /** Provider-specific metadata (provider, object_type, id, etc.) */
  metadata: Record<string, unknown>
}

import { getConnectionToken } from '@/lib/nango/client';
import { Nango } from '@nangohq/node';

/**
 * The standard output every fetcher must return.
 * RAM only, never written to DB.
 */
export interface FetchedChunk {
  /** unique ID — prefix with provider: "slack-msg-C012AB-171412..." */
  chunk_id: string;
  /** shown in citations — e.g. "#general: Deployment went live..." */
  title: string;
  /** the actual text — RAM only, never written to DB */
  content: string;
  /** deep link back to the original message/ticket */
  source_url: string;
  /** standard metadata bag */
  metadata: {
    provider: string; // always 'slack' or 'zendesk'
    resource_type: string; // e.g. 'channel_message', 'ticket', 'article'
    last_modified?: string; // ISO 8601 timestamp
    author?: string;
    [key: string]: unknown; // any extra fields (channel name, ticket status, etc.)
  };
}

/**
 * Signature for a background fetcher (full sync).
 */
export type ProviderFetcher = (
  connectionId: string,
  orgId: string,
  options?: { since?: string; limit?: number }
) => Promise<FetchedChunk[]>

/**
 * Signature for a live searcher (query-time, ephemeral).
 */
export type ProviderSearcher = (
  connectionId: string,
  orgId: string,
  query: string,
  options?: { limit?: number }
) => Promise<FetchedChunk[]>

/**
 * Standard HTTP fetcher for integrations.
 * Handles 429 rate-limit retries and 500 exponential backoff.
 */
export async function baseFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
  retries = 3,
  backoff = 1000
): Promise<T> {
  try {
    const res = await fetch(url, options);

    // Handle 429 Too Many Requests
    if (res.status === 429 && retries > 0) {
      const retryAfter = res.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return baseFetch(url, options, retries - 1, backoff * 2);
    }

    // Handle 500+ Internal Server Error
    if (res.status >= 500 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return baseFetch(url, options, retries - 1, backoff * 2);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return baseFetch(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

/**
 * Fetches an OAuth access token from Nango for a specific provider.
 * Verified against orgId to prevent cross-org leaks.
 */
export async function getProviderToken(
  connectionId: string,
  providerConfigKey: string,
  orgId: string
): Promise<string> {
  return getConnectionToken(connectionId, providerConfigKey, orgId);
}

/**
 * Fetches connection metadata from Nango.
 * Used to retrieve subdomains, account IDs, etc.
 * 🔒 Rule 1: Always pass orgId for verification.
 */
export async function getProviderMetadata(
  connectionId: string,
  providerConfigKey: string,
  orgId: string
): Promise<Record<string, any>> {
  if (!orgId) {
    throw new Error('orgId is required to fetch connection metadata');
  }

  const nangoSecretKey = process.env.NANGO_SECRET_KEY;
  if (!nangoSecretKey) {
    throw new Error('Missing NANGO_SECRET_KEY environment variable');
  }

  const nango = new Nango({ secretKey: nangoSecretKey });
  const connection = await nango.getConnection(providerConfigKey, connectionId);
  
  // Security check: verify metadata org_id matches
  if (connection.metadata?.org_id && connection.metadata.org_id !== orgId) {
    throw new Error('Unauthorized: Connection metadata orgId mismatch');
  }

  return {
    ...connection.metadata,
    ...connection.connection_config,
    ...(connection as any).credentials?.raw,
  };
}

/**
 * Security guard: ensures metadata doesn't contain content fields.
 */
export function assertSafeMetadata(metadata: Record<string, unknown>): void {
  const forbiddenKeys = ['content', 'body', 'text', 'raw', 'html', 'markdown'];
  for (const key of forbiddenKeys) {
    if (key in metadata) {
      throw new Error(`Security Violation: metadata contains forbidden key "${key}"`);
    }
  }
}

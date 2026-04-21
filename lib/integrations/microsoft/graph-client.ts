/**
 * Microsoft Graph API client — built on top of the shared baseFetch.
 * All Microsoft fetchers (Outlook, SharePoint, Calendar) use this
 * instead of calling fetch() directly.
 *
 * Each fetcher passes its specific ProviderKey so that the correct
 * Nango integration is used for token retrieval.
 */
import { baseFetch, baseFetchRaw, getProviderToken } from '@/lib/integrations/base'
import type { ProviderKey } from '@/lib/integrations/providers'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Authenticated fetch wrapper for Microsoft Graph API.
 * Retrieves the Nango token for the specified Microsoft service and
 * delegates to baseFetch for automatic retry + rate-limit handling.
 *
 * @param connectionId - Nango connection ID.
 * @param orgId        - Organization ID for ownership verification.
 * @param providerKey  - The registry key for the Microsoft service (e.g. 'outlook', 'sharepoint').
 * @param path         - The Graph API path (e.g. '/me/messages').
 * @param options      - Optional method, headers, body overrides.
 * @returns Parsed JSON response of type T.
 */
export async function graphFetch<T = any>(
  connectionId: string,
  orgId: string,
  providerKey: ProviderKey,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: unknown
  } = {},
): Promise<T> {
  const token = await getProviderToken(connectionId, providerKey, orgId)
  const url = `${GRAPH_BASE}${path}`

  return baseFetch<T>(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

/**
 * Raw response variant of graphFetch for binary downloads.
 * Used for file content downloads from OneDrive/SharePoint.
 */
export async function graphFetchRaw(
  connectionId: string,
  orgId: string,
  providerKey: ProviderKey,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: unknown
  } = {},
): Promise<Response> {
  const token = await getProviderToken(connectionId, providerKey, orgId)
  const url = `${GRAPH_BASE}${path}`

  return baseFetchRaw(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

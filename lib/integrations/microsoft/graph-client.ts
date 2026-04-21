/**
 * Microsoft Graph API client — built on top of the shared baseFetch.
 * All Microsoft fetchers (Outlook, SharePoint, Calendar) use this
 * instead of calling fetch() directly.
 */
import { baseFetch, baseFetchRaw, getProviderToken } from '@/lib/integrations/base'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Authenticated fetch wrapper for Microsoft Graph API.
 * Retrieves the Nango token for the Microsoft service and
 * delegates to baseFetch for automatic retry + rate-limit handling.
 *
 * @param connectionId - Nango connection ID.
 * @param orgId        - Organization ID for ownership verification.
 * @param path         - The Graph API path (e.g. '/me/messages').
 * @param options      - Optional method, headers, body overrides.
 * @returns Parsed JSON response of type T.
 */
export async function graphFetch<T = any>(
  connectionId: string,
  orgId: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: unknown
  } = {},
): Promise<T> {
  const token = await getProviderToken(connectionId, 'microsoft', orgId)
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
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: unknown
  } = {},
): Promise<Response> {
  const token = await getProviderToken(connectionId, 'microsoft', orgId)
  const url = `${GRAPH_BASE}${path}`

  return baseFetchRaw(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

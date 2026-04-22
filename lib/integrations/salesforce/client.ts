// ============================================================
// Salesforce base client (ATH-67)
//
// Uses baseFetch<T>() for retry + rate-limit handling.
// Critical rule: token is fetched from Nango per-request,
// used once, then falls out of scope. Never stored, never logged.
// ============================================================

import { baseFetch, type BaseFetchOptions } from '@/lib/integrations/base'

/**
 * Make an authenticated GET request to the Salesforce REST API.
 *
 * @param connectionId – Nango connection ID for this org's Salesforce link
 * @param path – API path appended to `/services/data/v59.0` (e.g. `/query?q=...`)
 * @param orgId – Clerk org ID for ownership verification
 * @param instanceUrl – Salesforce instance URL (e.g. `https://myorg.my.salesforce.com`).
 *   If omitted, falls back to `https://login.salesforce.com` (sandbox/dev orgs).
 * @param fetchOptions – Optional retry/method configuration passed to baseFetch
 */
export async function salesforceFetch<T = unknown>(
  connectionId: string,
  path: string,
  orgId: string,
  instanceUrl?: string,
  fetchOptions?: BaseFetchOptions
): Promise<T> {
  const baseUrl = instanceUrl ?? 'https://login.salesforce.com'
  const url = `${baseUrl}/services/data/v59.0${path}`

  return baseFetch<T>(connectionId, 'salesforce', orgId, url, fetchOptions)
}
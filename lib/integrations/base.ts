// ============================================================
// base.ts — Shared base fetcher with retry + rate-limit (ATH-72)
//
// Common token fetch, retry with exponential backoff, 429/5xx
// rate-limit handling, and FetchedChunk typing. All integration
// clients (Salesforce, HubSpot, Microsoft, Google) should use
// baseFetch<T>() instead of calling fetch() directly.
//
// Critical rule: token is fetched once per request, used
// immediately, and never stored or logged.
// ============================================================

import { getConnectionToken } from '@/lib/nango/client'

export type { FetchedChunk } from './types'

// ─── Token helper ────────────────────────────────────────────────────────────

/**
 * Retrieves an OAuth access token for the given provider via Nango.
 * Centralizes auth so individual fetchers never touch Nango directly.
 *
 * @param connectionId - The Nango connectionId tied to a specific user/org.
 * @param providerKey  - The canonical registry key (e.g. 'salesforce', 'hubspot').
 * @param orgId        - The organization ID for ownership verification.
 * @returns The raw OAuth access token string.
 */
export async function getProviderToken(
  connectionId: string,
  providerKey: string,
  orgId: string,
): Promise<string> {
  return getConnectionToken(connectionId, providerKey, orgId)
}

// ─── Retry + rate-limit fetch ────────────────────────────────────────────────

export interface BaseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  /** Max retries on 429 / 5xx. Default 3. */
  maxRetries?: number
  /** Initial backoff delay in ms. Doubles each retry. Default 500. */
  initialBackoffMs?: number
  /** Max backoff delay in ms. Default 30000 (30s). */
  maxBackoffMs?: number
}

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_INITIAL_BACKOFF_MS = 500
const DEFAULT_MAX_BACKOFF_MS = 30_000

/** HTTP status codes that warrant a retry. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

/**
 * Make an HTTP request with automatic retry and rate-limit handling.
 *
 * - **429 Too Many Requests**: Respects `Retry-After` header if
 *   present, otherwise uses exponential backoff.
 * - **5xx Server Errors**: Retried with exponential backoff.
 * - **4xx Client Errors** (except 429): Thrown immediately, no retry.
 *
 * @param url Full URL to fetch
 * @param options Retry and request configuration
 * @returns Parsed JSON response typed as T
 */
export async function baseFetch<T = unknown>(
  url: string,
  options: BaseFetchOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const initialBackoff = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS
  const maxBackoff = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS
  const method = options.method ?? 'GET'

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...(options.body ? { body: options.body } : {}),
      })

      // ---- Success ----
      if (res.ok) {
        return (await res.json()) as T
      }

      // ---- Non-retryable error ----
      if (!RETRYABLE_STATUS_CODES.has(res.status)) {
        const body = await res.text().catch(() => '')
        throw new Error(
          `API error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
        )
      }

      // ---- Retryable: calculate backoff ----
      if (attempt < maxRetries) {
        const backoff = calculateBackoff(res, attempt, initialBackoff, maxBackoff)
        console.warn(
          `[baseFetch] returned ${res.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`
        )
        await sleep(backoff)
      } else {
        throw new Error(
          `API error: ${res.status} ${res.statusText} after ${maxRetries} retries`
        )
      }
    } catch (err) {
      if (err instanceof TypeError || (err instanceof Error && isNetworkError(err))) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxRetries) {
          const backoff = Math.min(initialBackoff * 2 ** attempt, maxBackoff)
          console.warn(
            `[baseFetch] network error: ${lastError.message}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`
          )
          await sleep(backoff)
          continue
        }
      }
      throw err
    }
  }

  throw lastError ?? new Error(`Request failed after ${maxRetries} retries`)
}

// ─── Metadata safety guard ───────────────────────────────────────────────────

const FORBIDDEN_METADATA_KEYS = new Set([
  'content',
  'body',
  'text',
  'raw',
  'html',
  'markdown',
  'plaintext',
])

export function assertSafeMetadata(
  metadata: Record<string, unknown>,
): void {
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `[baseFetch] Forbidden metadata key "${key}" — content must never be stored in metadata`,
      )
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateBackoff(
  res: Response,
  attempt: number,
  initialBackoff: number,
  maxBackoff: number
): number {
  const retryAfter = res.headers.get('Retry-After')

  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds)) {
      return Math.min(seconds * 1000, maxBackoff)
    }
    const date = new Date(retryAfter)
    if (!isNaN(date.getTime())) {
      const delayMs = date.getTime() - Date.now()
      return Math.min(Math.max(delayMs, 0), maxBackoff)
    }
  }

  const exponential = initialBackoff * 2 ** attempt
  const jitter = Math.random() * initialBackoff
  return Math.min(exponential + jitter, maxBackoff)
}

function isNetworkError(err: Error): boolean {
  const msg = err.message.toLowerCase()
  return (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

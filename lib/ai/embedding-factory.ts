// ============================================================
// embedding-factory.ts — Provider-agnostic embedding layer
//
// Priority (system):
//   1. JINA_API_KEY  → Jina AI  (jina-embeddings-v3, 768 dims, free 1M/mo)
//   2. TOGETHER_API_KEY → Together AI  (nomic-embed-text-v1.5, 768 dims)
//   3. NOMIC_API_KEY → Nomic Atlas API (nomic-embed-text-v1.5, 768 dims)
//
// Per-org BYOK (checked before system env):
//   • provider=openai  → text-embedding-3-small with dimensions:768 (MRL)
//   • provider=jina    → Jina AI with org key
//
// All paths produce 768-dim vectors to match the DB column.
// ============================================================

import OpenAI from "openai"
import { supabaseAdmin } from "@/lib/supabase/server"

// ---- Dimension constant -------------------------------------------------

/** Must match document_embeddings.embedding vector(N) in the DB schema */
export const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS ?? "768")

// ---- Provider config types ---------------------------------------------

type EmbeddingProviderName = "openai" | "jina" | "together" | "nomic"

interface EmbeddingConfig {
  provider: EmbeddingProviderName
  model: string
  dims: number
  apiKey: string
  baseUrl?: string
}

// ---- System default resolution -----------------------------------------

function resolveSystemConfig(): EmbeddingConfig | null {
  if (process.env.JINA_API_KEY) {
    return {
      provider: "jina",
      model: "jina-embeddings-v3",
      dims: EMBEDDING_DIMS,
      apiKey: process.env.JINA_API_KEY,
    }
  }
  if (process.env.TOGETHER_API_KEY) {
    return {
      provider: "together",
      model: "togethercomputer/m2-bert-80M-8k-base",
      dims: EMBEDDING_DIMS,
      apiKey: process.env.TOGETHER_API_KEY,
      baseUrl: "https://api.together.xyz/v1",
    }
  }
  if (process.env.NOMIC_API_KEY) {
    return {
      provider: "nomic",
      model: "nomic-embed-text-v1.5",
      dims: EMBEDDING_DIMS,
      apiKey: process.env.NOMIC_API_KEY,
      baseUrl: "https://api-atlas.nomic.ai/v1",
    }
  }
  return null
}

// ---- BYOK resolution ---------------------------------------------------

type DecryptedKeyRow = { provider: string; plaintext: string }

async function fetchByokEmbeddingConfig(orgId: string): Promise<EmbeddingConfig | null> {
  const kmsKey = process.env.KMS_KEY
  if (!kmsKey || !orgId) return null

  const { data, error } = await supabaseAdmin.rpc("get_decrypted_llm_key", {
    p_org_id: orgId,
    p_kms_key: kmsKey,
  })

  if (error) return null

  const rows = (data ?? []) as DecryptedKeyRow[]

  // Prefer BYOK OpenAI (supports MRL dimension reduction)
  const openaiRow = rows.find((r) => r.provider === "openai")
  if (openaiRow?.plaintext) {
    return {
      provider: "openai",
      model: "text-embedding-3-small",
      dims: EMBEDDING_DIMS,
      apiKey: openaiRow.plaintext,
    }
  }

  // BYOK Jina
  const jinaRow = rows.find((r) => r.provider === "jina")
  if (jinaRow?.plaintext) {
    return {
      provider: "jina",
      model: "jina-embeddings-v3",
      dims: EMBEDDING_DIMS,
      apiKey: jinaRow.plaintext,
    }
  }

  return null
}

// ---- Provider implementations ------------------------------------------

async function embedWithOpenAI(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  const client = new OpenAI({ apiKey: config.apiKey })
  const res = await client.embeddings.create({
    model: config.model,
    input: texts,
    dimensions: config.dims,
  })
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

async function embedWithOpenAICompat(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  // Together AI and Nomic AI both expose an OpenAI-compatible /v1/embeddings endpoint
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
  const res = await client.embeddings.create({ model: config.model, input: texts })
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

async function embedWithJina(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      dimensions: config.dims,
      task: "retrieval.passage",
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`[EmbeddingFactory] Jina API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { data: Array<{ embedding: number[]; index: number }> }
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

// ---- Provider call with retry ------------------------------------------

const MAX_PROVIDER_RETRIES = 2

async function callProviderWithRetry(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
    try {
      switch (config.provider) {
        case "openai":
          return await embedWithOpenAI(texts, config)
        case "jina":
          return await embedWithJina(texts, config)
        case "together":
        case "nomic":
          return await embedWithOpenAICompat(texts, config)
      }
    } catch (err) {
      lastErr = err
      if (attempt < MAX_PROVIDER_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

// ---- Core embed function -----------------------------------------------

async function embedTexts(
  texts: string[],
  orgId?: string
): Promise<number[][]> {
  if (texts.length === 0) return []

  // 1. Try per-org BYOK first
  const byokConfig = orgId
    ? await fetchByokEmbeddingConfig(orgId).catch(() => null)
    : null

  // 2. Build fallback chain: BYOK → system providers in priority order
  const systemConfig = resolveSystemConfig()
  const candidates: EmbeddingConfig[] = []

  if (byokConfig) candidates.push(byokConfig)
  if (systemConfig) candidates.push(systemConfig)

  // Add remaining system providers not already in the chain
  const systemFallbacks: Array<() => EmbeddingConfig | null> = [
    () => process.env.JINA_API_KEY ? { provider: "jina", model: "jina-embeddings-v3", dims: EMBEDDING_DIMS, apiKey: process.env.JINA_API_KEY! } : null,
    () => process.env.TOGETHER_API_KEY ? { provider: "together", model: "togethercomputer/m2-bert-80M-8k-base", dims: EMBEDDING_DIMS, apiKey: process.env.TOGETHER_API_KEY!, baseUrl: "https://api.together.xyz/v1" } : null,
    () => process.env.NOMIC_API_KEY ? { provider: "nomic", model: "nomic-embed-text-v1.5", dims: EMBEDDING_DIMS, apiKey: process.env.NOMIC_API_KEY!, baseUrl: "https://api-atlas.nomic.ai/v1" } : null,
  ]

  for (const fn of systemFallbacks) {
    const c = fn()
    if (c && !candidates.some(x => x.provider === c.provider && x.apiKey === c.apiKey)) {
      candidates.push(c)
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      "[EmbeddingFactory] No embedding provider configured. Set JINA_API_KEY, TOGETHER_API_KEY, or NOMIC_API_KEY in environment."
    )
  }

  // 3. Try each provider in order, falling back on failure
  let lastErr: unknown
  for (const config of candidates) {
    try {
      return await callProviderWithRetry(texts, config)
    } catch (err) {
      lastErr = err
      console.warn(
        `[EmbeddingFactory] Provider '${config.provider}' failed (${err instanceof Error ? err.message : String(err)}), ` +
        `trying next in fallback chain…`
      )
    }
  }

  throw new Error(
    `[EmbeddingFactory] All embedding providers exhausted. Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  )
}

// ---- Startup assertion --------------------------------------------------

let _dimLogged = false
function assertDims(vec: number[]): void {
  if (!_dimLogged) {
    _dimLogged = true
    console.log(`[EmbeddingFactory] dims=${vec.length} configured=${EMBEDDING_DIMS}`)
    if (vec.length !== EMBEDDING_DIMS) {
      console.error(
        `[EmbeddingFactory] DIMENSION MISMATCH: provider returned ${vec.length}-dim vectors ` +
        `but DB column is vector(${EMBEDDING_DIMS}). ` +
        `Indexing jobs will fail. Check EMBEDDING_DIMS env and migration state.`
      )
    }
  }
}

// ---- Public API --------------------------------------------------------

/** Embed a single text string. Uses org BYOK if orgId provided. */
export async function embed(text: string, orgId?: string): Promise<number[]> {
  const results = await embedTexts([text], orgId)
  assertDims(results[0])
  return results[0]
}

/** Embed multiple texts in one API call. Uses org BYOK if orgId provided. */
export async function embedBatch(
  texts: string[],
  orgId?: string
): Promise<number[][]> {
  const results = await embedTexts(texts, orgId)
  if (results.length > 0) assertDims(results[0])
  return results
}

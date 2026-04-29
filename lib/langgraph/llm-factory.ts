import { ChatAnthropic } from "@langchain/anthropic";
import { supabaseAdmin } from "../supabase/server";

// ---------------------------------------------------------------------------
// Model tier → Anthropic model name
// Spec: simple=Haiku, medium=Sonnet (supervisor default), complex=Opus
// ---------------------------------------------------------------------------
const TIER_MODELS: Record<ModelTier, string> = {
  simple: "claude-haiku-4-5-20251001",
  medium: "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
};

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

// ---------------------------------------------------------------------------
// Per-(org, tier) client cache — avoids re-creating SDK instances on hot paths
// ---------------------------------------------------------------------------
const clientCache = new Map<string, ChatAnthropic>();

// ---------------------------------------------------------------------------
// BYOK: fetch & decrypt org-specific Anthropic key from llm_keys table.
// Uses the decrypt_llm_key() Postgres function (pgp_sym_decrypt with
// app.kms_key set to process.env.ENCRYPTION_SECRET server-side).
// Returns null when no active BYOK key exists for this org.
// ---------------------------------------------------------------------------
async function fetchOrgApiKey(orgId: string): Promise<string | null> {
  try {
    // Set the KMS session variable required by decrypt_llm_key()
    const kmsKey = process.env.ENCRYPTION_SECRET;
    if (!kmsKey) return null;

    // Call the RPC that sets the session var and decrypts atomically
    const { data, error } = await supabaseAdmin.rpc("decrypt_llm_key_for_org", {
      p_org_id: orgId,
      p_provider: "anthropic",
      p_kms_key: kmsKey,
    });

    if (error || !data) return null;
    return data as string;
  } catch {
    // Never let BYOK failure crash the agent — fall back to platform key
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveModelClient — async, BYOK-aware, tier-routed
// ---------------------------------------------------------------------------
export async function resolveModelClient(
  orgId: string,
  tier: ModelTier = "medium"
): Promise<ChatAnthropic> {
  const cacheKey = `${orgId}:${tier}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  // 1. Try BYOK first; fall back to platform key
  const byokKey = await fetchOrgApiKey(orgId);
  const apiKey = byokKey ?? process.env.ANTHROPIC_API_KEY;

  // 2. Guard: defer env check to call time (not module load)
  if (!apiKey) {
    throw new Error(
      `[llm-factory] No Anthropic API key available for org "${orgId}". ` +
        `Set ANTHROPIC_API_KEY in your environment or configure a BYOK key ` +
        `in the llm_keys table.`
    );
  }

  const client = new ChatAnthropic({
    model: TIER_MODELS[tier],
    apiKey,
  });

  clientCache.set(cacheKey, client);
  return client;
}

// ---------------------------------------------------------------------------
// Legacy synchronous helper — kept for backward compatibility with existing
// node imports that call getModel(). Uses platform key only (no BYOK).
// Callers should migrate to resolveModelClient(orgId, tier) when possible.
// ---------------------------------------------------------------------------
export function getModel(tier: ModelTier = "medium"): ChatAnthropic {
  const cacheKey = `__platform__:${tier}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  // Defer env check to first call, not module load
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[llm-factory] ANTHROPIC_API_KEY is not set. " +
        "Add it to your .env.local file or use resolveModelClient() for BYOK orgs."
    );
  }

  const client = new ChatAnthropic({
    model: TIER_MODELS[tier],
    apiKey,
  });

  clientCache.set(cacheKey, client);
  return client;
}

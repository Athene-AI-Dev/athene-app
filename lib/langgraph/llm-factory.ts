// ============================================================
// llm-factory.ts — resolveModelClient
//
// Resolves the correct LLM client for a given org + complexity tier.
//
// Priority order:
//   1. Org BYOK key from llm_keys table (decrypted via Supabase RPC)
//   2. Platform fallback from env vars (ANTHROPIC_API_KEY etc.)
//
// Model selection matrix (Chapter 7):
//   simple  → claude-haiku-4-5 / gpt-4o-mini / gemini-2.0-flash
//   medium  → claude-sonnet-4-6 / gpt-4o / gemini-2.5-pro
//   complex → claude-opus-4-6  / gpt-4o / gemini-2.5-pro
//
// BYOK decryption note:
//   decrypt_llm_key() in Postgres requires app.kms_key to be set as
//   a session variable. Until a dedicated RPC wrapper is added
//   (ATH-22), BYOK decryption is skipped and the factory falls back
//   to platform keys. The BYOK query still runs so key presence is
//   validated. See byokDecrypt() below.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Complexity } from "./state";

// ---- Provider / tier types ----------------------------------

export type ModelProvider = "anthropic" | "openai" | "google";

export type ModelTier = Complexity; // "simple" | "medium" | "complex"

// ---- Model selection matrix ---------------------------------

const MODEL_MATRIX: Record<ModelProvider, Record<ModelTier, string>> = {
  anthropic: {
    simple: "claude-haiku-4-5-20251001",
    medium: "claude-sonnet-4-6",
    complex: "claude-opus-4-6",
  },
  openai: {
    simple: "gpt-4o-mini",
    medium: "gpt-4o",
    complex: "gpt-4o",
  },
  google: {
    simple: "gemini-2.0-flash",
    medium: "gemini-2.5-pro",
    complex: "gemini-2.5-pro",
  },
};

// ---- Resolved client union ----------------------------------

export interface ResolvedModelClient {
  provider: ModelProvider;
  modelId: string;
  /** Use when provider === "anthropic" */
  anthropic?: Anthropic;
  /** Use when provider === "openai" */
  openai?: OpenAI;
  /** Use when provider === "google" */
  google?: GoogleGenerativeAI;
}

// ---- BYOK helpers -------------------------------------------

interface LlmKeyRow {
  provider: string;
  key_encrypted: string; // returned as base64 by Supabase
}

/**
 * Attempt to decrypt a BYOK key.
 *
 * Full implementation requires a Supabase RPC that sets
 * app.kms_key and calls pgp_sym_decrypt in the same transaction
 * (tracked in ATH-22). Until then, returns null so the caller
 * falls back to platform keys.
 */
async function byokDecrypt(
  _supabase: SupabaseClient,
  _encryptedKey: string,
): Promise<string | null> {
  // TODO (ATH-22): call supabase.rpc('get_decrypted_llm_key', {
  //   p_org_id, p_provider, p_kms_key: process.env.KMS_SECRET
  // }) once the wrapper RPC is added to migrations.
  return null;
}

/**
 * Fetch the active BYOK key row for an org+provider.
 * Returns null if none exists or on query error.
 */
async function fetchByokRow(
  supabase: SupabaseClient,
  orgId: string,
  provider: ModelProvider,
): Promise<LlmKeyRow | null> {
  const { data, error } = await supabase
    .from("llm_keys")
    .select("provider, key_encrypted")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as LlmKeyRow;
}

// ---- Tier resolution ----------------------------------------

/**
 * Returns the higher of the two tiers.
 * Used to enforce agent minimum tiers (e.g. cross_dept ≥ complex).
 */
export function maxTier(a: ModelTier, b: ModelTier): ModelTier {
  const rank: Record<ModelTier, number> = { simple: 0, medium: 1, complex: 2 };
  return rank[a] >= rank[b] ? a : b;
}

// ---- Main factory -------------------------------------------

/**
 * Resolve the correct LLM client for a given org and request.
 *
 * @param supabase  Service-role Supabase client (reads llm_keys).
 * @param orgId     The requesting org's UUID.
 * @param complexity  Task complexity from AtheneState.
 * @param agentMinTier  Minimum tier required by the calling agent.
 */
export async function resolveModelClient(
  supabase: SupabaseClient,
  orgId: string,
  complexity: ModelTier,
  agentMinTier: ModelTier = "simple",
): Promise<ResolvedModelClient> {
  const tier = maxTier(complexity, agentMinTier);

  // Attempt BYOK — try Anthropic first, then OpenAI, then Google
  const providers: ModelProvider[] = ["anthropic", "openai", "google"];

  for (const provider of providers) {
    const row = await fetchByokRow(supabase, orgId, provider);
    if (!row) continue;

    const plainKey = await byokDecrypt(supabase, row.key_encrypted);
    if (!plainKey) continue; // ATH-22 not yet implemented

    const modelId = MODEL_MATRIX[provider][tier];

    if (provider === "anthropic") {
      return { provider, modelId, anthropic: new Anthropic({ apiKey: plainKey }) };
    }
    if (provider === "openai") {
      return { provider, modelId, openai: new OpenAI({ apiKey: plainKey }) };
    }
    if (provider === "google") {
      return { provider, modelId, google: new GoogleGenerativeAI(plainKey) };
    }
  }

  // Platform fallback — use Anthropic by default
  const platformKey = process.env.ANTHROPIC_API_KEY;
  if (platformKey) {
    return {
      provider: "anthropic",
      modelId: MODEL_MATRIX.anthropic[tier],
      anthropic: new Anthropic({ apiKey: platformKey }),
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: "openai",
      modelId: MODEL_MATRIX.openai[tier],
      openai: new OpenAI({ apiKey: openaiKey }),
    };
  }

  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    return {
      provider: "google",
      modelId: MODEL_MATRIX.google[tier],
      google: new GoogleGenerativeAI(googleKey),
    };
  }

  throw new Error(
    "No LLM key available: set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY, " +
      "or configure BYOK keys in the admin panel.",
  );
}

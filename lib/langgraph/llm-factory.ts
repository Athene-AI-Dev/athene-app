import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { supabaseAdmin } from "../supabase/server";

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

const TIER_MAP: Record<ModelTier, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o-mini",
  complex: "gpt-4o-mini",
};

type DecryptedKeyRow = { provider: string; plaintext: string };

/**
 * Fetches decrypted BYOK material for an org via SECURITY DEFINER RPC.
 * Returns null if KMS is missing, RPC fails, or no key for that provider.
 */
export async function fetchByokPlaintext(
  orgId: string,
  provider: "openai" | "anthropic" | "google"
): Promise<string | null> {
  const kmsKey = process.env.KMS_KEY;
  if (!kmsKey || !orgId) return null;

  const { data, error } = await supabaseAdmin.rpc("get_decrypted_llm_key", {
    p_org_id: orgId,
    p_kms_key: kmsKey,
  });

  if (error) {
    console.warn(`[LLMFactory] get_decrypted_llm_key failed:`, error.message);
    return null;
  }

  const rows = (data ?? []) as DecryptedKeyRow[];
  const row = rows.find((r) => r.provider === provider);
  return row?.plaintext ?? null;
}

function resolveOpenAiModelName(tierOrName: ModelTier | string): string {
  return TIER_MAP[tierOrName as ModelTier] || tierOrName;
}

/**
 * LLM Factory to ensure we use singletons for model instances.
 */
class LLMFactory {
  private static instances: Map<string, any> = new Map();

  static getModel(tierOrName: ModelTier | string = "gpt-4o", temperature: number = 0) {
    const modelName = resolveOpenAiModelName(tierOrName);
    const cacheKey = `${modelName}-${temperature}`;

    if (!this.instances.has(cacheKey)) {
      this.instances.set(
        cacheKey,
        new ChatOpenAI({
          modelName,
          temperature,
        })
      );
    }
    return this.instances.get(cacheKey)!;
  }

  /**
   * 🔑 BYOK (Bring Your Own Key) — returns a provider-specific chat model.
   * Uses KMS + get_decrypted_llm_key; falls back to system env via getModel.
   */
  static async getBYOKModel(orgId: string, provider: string, temperature: number = 0) {
    const cacheKey = `byok-${orgId}-${provider}-${temperature}`;
    if (this.instances.has(cacheKey)) return this.instances.get(cacheKey);

    if (provider !== "openai" && provider !== "anthropic" && provider !== "google") {
      return this.getModel("gpt-4o", temperature);
    }

    const apiKey = await fetchByokPlaintext(orgId, provider);

    if (!apiKey) {
      console.warn(
        `[LLMFactory] No active BYOK key found for org ${orgId} / ${provider}. Falling back to system keys.`
      );
      return this.getModel("gpt-4o", temperature);
    }

    let instance;
    if (provider === "anthropic") {
      instance = new ChatAnthropic({
        apiKey,
        modelName: "claude-3-5-sonnet-20240620",
        temperature,
      });
    } else if (provider === "openai") {
      instance = new ChatOpenAI({
        apiKey,
        modelName: "gpt-4o",
        temperature,
      });
    } else {
      instance = new ChatGoogleGenerativeAI({
        apiKey,
        model: "gemini-1.5-pro",
        temperature,
      });
    }

    this.instances.set(cacheKey, instance);
    return instance;
  }

  /**
   * Resolves the chat model for agent nodes: **BYOK OpenAI first** (when org + key exist),
   * then system OpenAI via env.
   */
  static async resolveModelClient(
    tierOrName: ModelTier | string = "medium",
    orgId?: string,
    temperature: number = 0
  ) {
    const modelName = resolveOpenAiModelName(tierOrName);
    if (orgId) {
      const apiKey = await fetchByokPlaintext(orgId, "openai");
      if (apiKey) {
        const cacheKey = `resolve-openai-${orgId}-${modelName}-${temperature}`;
        if (!this.instances.has(cacheKey)) {
          this.instances.set(
            cacheKey,
            new ChatOpenAI({
              apiKey,
              modelName,
              temperature,
            })
          );
        }
        return this.instances.get(cacheKey)!;
      }
    }
    return this.getModel(tierOrName, temperature);
  }
}

export const model = LLMFactory.getModel();
export const getModel = LLMFactory.getModel.bind(LLMFactory);
export const getBYOKModel = LLMFactory.getBYOKModel.bind(LLMFactory);
export const resolveModelClient = LLMFactory.resolveModelClient.bind(LLMFactory);

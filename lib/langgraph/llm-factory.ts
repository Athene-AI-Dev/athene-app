import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { supabaseAdmin } from "../supabase/server";
import { logger } from "@/lib/logger";

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

// OpenAI model names per tier
const OPENAI_TIER_MAP: Record<ModelTier, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o-mini",
  complex: "gpt-4o",
};

// DeepSeek model names per tier (OpenAI-compatible API)
const DEEPSEEK_TIER_MAP: Record<ModelTier, string> = {
  simple: "deepseek-chat",
  medium: "deepseek-chat",
  complex: "deepseek-reasoner",
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

type DecryptedKeyRow = { provider: string; plaintext: string };

/** Returns true when DeepSeek should be used as the system default provider. */
function useDeepSeekByDefault(): boolean {
  return !process.env.OPENAI_API_KEY && !!process.env.DEEPSEEK_API_KEY;
}

function resolveModelName(tierOrName: ModelTier | string): string {
  if (useDeepSeekByDefault()) {
    return DEEPSEEK_TIER_MAP[tierOrName as ModelTier] ?? tierOrName;
  }
  return OPENAI_TIER_MAP[tierOrName as ModelTier] ?? tierOrName;
}

/**
 * Fetches decrypted BYOK material for an org via SECURITY DEFINER RPC.
 * Returns null if KMS is missing, RPC fails, or no key for that provider.
 */
export async function fetchByokPlaintext(
  orgId: string,
  provider: "openai" | "anthropic" | "google" | "deepseek"
): Promise<string | null> {
  const kmsKey = process.env.KMS_KEY;
  if (!orgId) return null;
  if (!kmsKey) {
    logger.error({ orgId }, "[LLMFactory] KMS_KEY is not set — cannot decrypt BYOK key; falling back to system provider. Set KMS_KEY in environment.");
    return null;
  }

  const { data, error } = await supabaseAdmin.rpc("get_decrypted_llm_key", {
    p_org_id: orgId,
    p_kms_key: kmsKey,
  });

  if (error) {
    logger.warn({ orgId, err: error.message }, "[LLMFactory] get_decrypted_llm_key RPC failed — falling back to system provider");
    return null;
  }

  const rows = (data ?? []) as DecryptedKeyRow[];
  const row = rows.find((r) => r.provider === provider);
  return row?.plaintext ?? null;
}

/** Build a DeepSeek chat client using the OpenAI-compatible endpoint. */
function makeDeepSeekModel(modelName: string, temperature: number, apiKey?: string) {
  return new ChatOpenAI({
    modelName,
    temperature,
    apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY ?? "",
    configuration: { baseURL: DEEPSEEK_BASE_URL },
  });
}

class LLMFactory {
  private static instances: Map<string, any> = new Map();

  /**
   * Returns a system-key model instance (singleton per model+temperature).
   * Prefers OpenAI when OPENAI_API_KEY is set; falls back to DeepSeek
   * when only DEEPSEEK_API_KEY is present.
   */
  static getModel(tierOrName: ModelTier | string = "medium", temperature: number = 0) {
    const modelName = resolveModelName(tierOrName);
    const provider = useDeepSeekByDefault() ? "deepseek" : "openai";
    const cacheKey = `${provider}-${modelName}-${temperature}`;

    if (!this.instances.has(cacheKey)) {
      const instance = useDeepSeekByDefault()
        ? makeDeepSeekModel(modelName, temperature)
        : new ChatOpenAI({ modelName, temperature });
      this.instances.set(cacheKey, instance);
    }
    return this.instances.get(cacheKey)!;
  }

  /**
   * BYOK — returns a provider-specific model using a decrypted org key.
   * Supports: openai | anthropic | google | deepseek.
   * Falls back to system default when no BYOK key is found.
   */
  static async getBYOKModel(orgId: string, provider: string, temperature: number = 0) {
    const cacheKey = `byok-${orgId}-${provider}-${temperature}`;
    if (this.instances.has(cacheKey)) return this.instances.get(cacheKey);

    const validProviders = ["openai", "anthropic", "google", "deepseek"];
    if (!validProviders.includes(provider)) {
      return this.getModel("medium", temperature);
    }

    const apiKey = await fetchByokPlaintext(
      orgId,
      provider as "openai" | "anthropic" | "google" | "deepseek"
    );

    if (!apiKey) {
      logger.warn({ orgId, provider }, "[LLMFactory] No BYOK key found for org — using system default provider");
      return this.getModel("medium", temperature);
    }

    let instance: any;
    if (provider === "anthropic") {
      instance = new ChatAnthropic({
        apiKey,
        modelName: "claude-sonnet-4-6",
        temperature,
      });
    } else if (provider === "openai") {
      instance = new ChatOpenAI({ apiKey, modelName: "gpt-4o", temperature });
    } else if (provider === "deepseek") {
      instance = makeDeepSeekModel("deepseek-chat", temperature, apiKey);
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
   * Resolves the chat model for agent nodes.
   * Priority: org BYOK openai → org BYOK deepseek → system env (openai or deepseek).
   */
  static async resolveModelClient(
    tierOrName: ModelTier | string = "medium",
    orgId?: string,
    temperature: number = 0
  ) {
    const openAiModelName = OPENAI_TIER_MAP[tierOrName as ModelTier] ?? tierOrName;
    const deepseekModelName = DEEPSEEK_TIER_MAP[tierOrName as ModelTier] ?? tierOrName;

    if (orgId) {
      // Try BYOK OpenAI first
      const openaiKey = await fetchByokPlaintext(orgId, "openai");
      if (openaiKey) {
        const cacheKey = `resolve-openai-${orgId}-${openAiModelName}-${temperature}`;
        if (!this.instances.has(cacheKey)) {
          this.instances.set(
            cacheKey,
            new ChatOpenAI({ apiKey: openaiKey, modelName: openAiModelName, temperature })
          );
        }
        return this.instances.get(cacheKey)!;
      }

      // Try BYOK DeepSeek
      const deepseekKey = await fetchByokPlaintext(orgId, "deepseek");
      if (deepseekKey) {
        const cacheKey = `resolve-deepseek-${orgId}-${deepseekModelName}-${temperature}`;
        if (!this.instances.has(cacheKey)) {
          this.instances.set(
            cacheKey,
            makeDeepSeekModel(deepseekModelName, temperature, deepseekKey)
          );
        }
        return this.instances.get(cacheKey)!;
      }
    }

    // System default (OpenAI or DeepSeek depending on env)
    return this.getModel(tierOrName, temperature);
  }
}

export const model = LLMFactory.getModel();
export const getModel = LLMFactory.getModel.bind(LLMFactory);
export const getBYOKModel = LLMFactory.getBYOKModel.bind(LLMFactory);
export const resolveModelClient = LLMFactory.resolveModelClient.bind(LLMFactory);

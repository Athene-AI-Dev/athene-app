import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { supabaseAdmin } from "../supabase/server";

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

const TIER_MAP: Record<ModelTier, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o",
  complex: "gpt-4o",
};

/**
 * LLM Factory to ensure we use singletons for model instances.
 */
class LLMFactory {
  private static instances: Map<string, any> = new Map();

  static getModel(tierOrName: ModelTier | string = "gpt-4o", temperature: number = 0) {
    const modelName = TIER_MAP[tierOrName as ModelTier] || tierOrName;
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
   * 🔑 BYOK (Bring Your Own Key) Resolver
   * Fetches the decrypted key for an organization and returns a provider-specific client.
   */
  static async getBYOKModel(orgId: string, provider: string, temperature: number = 0) {
    const cacheKey = `byok-${orgId}-${provider}-${temperature}`;
    if (this.instances.has(cacheKey)) return this.instances.get(cacheKey);

    // Fetch decrypted key via SECURITY DEFINER RPC
    const { data: apiKey, error } = await supabaseAdmin.rpc("get_decrypted_llm_key", {
      p_org_id: orgId,
      p_provider: provider,
    });

    if (error || !apiKey) {
      console.warn(`[LLMFactory] No active BYOK key found for org ${orgId} / ${provider}. Falling back to system keys.`);
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
    } else if (provider === "google") {
      instance = new ChatGoogleGenerativeAI({
        apiKey,
        modelName: "gemini-1.5-pro",
        temperature,
      });
    } else {
      return this.getModel("gpt-4o", temperature);
    }

    this.instances.set(cacheKey, instance);
    return instance;
  }

  static async resolveModelClient(tier: ModelTier = "medium") {
    return this.getModel(tier);
  }
}

export const model = LLMFactory.getModel();
export const getModel = LLMFactory.getModel.bind(LLMFactory);
export const getBYOKModel = LLMFactory.getBYOKModel.bind(LLMFactory);
export const resolveModelClient = LLMFactory.resolveModelClient.bind(LLMFactory);

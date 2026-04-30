import { ChatOpenAI } from "@langchain/openai";

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

const TIER_MAP: Record<ModelTier, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o",
  complex: "gpt-4o",
};

/**
 * LLM Factory to ensure we use singletons for model instances.
 * This prevents unnecessary overhead and potential memory leaks from creating new instances on every request.
 */
class LLMFactory {
  private static instances: Map<string, ChatOpenAI> = new Map();

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
   * Resolves a model client based on tier or specific configuration.
   * Currently a wrapper around getModel, but designed for BYOK/Multi-provider expansion.
   */
  static async resolveModelClient(tier: ModelTier = "medium") {
    return this.getModel(tier);
  }
}

export const model = LLMFactory.getModel();
export const getModel = LLMFactory.getModel.bind(LLMFactory);
export const resolveModelClient = LLMFactory.resolveModelClient.bind(LLMFactory);

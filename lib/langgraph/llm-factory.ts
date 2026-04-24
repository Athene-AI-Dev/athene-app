import { ChatOpenAI } from "@langchain/openai";

export type ModelTier = "simple" | "medium" | "complex";

// simple  → fast, cheap  (routing, classification, short answers)
// medium  → balanced     (retrieval summarisation, report drafts)
// complex → highest quality (multi-step reasoning, synthesis with citations)
const MODEL_MAP: Record<ModelTier, string> = {
  simple: "gpt-4o-mini",
  medium: "gpt-4o",
  complex: "gpt-4o",
};

// Temperature per tier — complex uses 0 for determinism, simple allows a touch of creativity
const TEMP_MAP: Record<ModelTier, number> = {
  simple: 0.2,
  medium: 0,
  complex: 0,
};

class LLMFactory {
  private static instances = new Map<string, ChatOpenAI>();

  static getModel(tier: ModelTier = "medium"): ChatOpenAI {
    const modelName = MODEL_MAP[tier];
    const temperature = TEMP_MAP[tier];
    const key = `${modelName}:${temperature}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new ChatOpenAI({ modelName, temperature }));
    }
    return this.instances.get(key)!;
  }

  /**
   * Returns the appropriate model given the supervisor's complexity label.
   * Falls back to "medium" if the label is absent or unrecognised.
   */
  static getModelForComplexity(complexity?: string | null): ChatOpenAI {
    const tier: ModelTier =
      complexity === "simple" || complexity === "medium" || complexity === "complex"
        ? complexity
        : "medium";
    return this.getModel(tier);
  }
}

export const model = LLMFactory.getModel("medium");
export { LLMFactory };

/** Convenience alias used by agent files that import getModel directly. */
export const getModel = (tier: ModelTier = "medium") => LLMFactory.getModel(tier);

/** Alias used by email-agent — returns a standard OpenAI client. */
export const resolveModelClient = async (_ctx?: unknown, tier: ModelTier = "medium") =>
  LLMFactory.getModel(tier);

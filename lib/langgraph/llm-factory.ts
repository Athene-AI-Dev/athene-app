import { ChatOpenAI } from "@langchain/openai";

/**
 * LLM Factory to ensure we use singletons for model instances.
 * This prevents unnecessary overhead and potential memory leaks from creating new instances on every request.
 */
class LLMFactory {
  private static instance: ChatOpenAI | null = null;

  static getModel(modelName: string = "gpt-4o", temperature: number = 0) {
    if (!this.instance) {
      this.instance = new ChatOpenAI({
        modelName,
        temperature,
      });
    }
    return this.instance;
  }
}

export const model = LLMFactory.getModel();

/** LLM tier used by the agent registry to select model complexity */
export type ModelTier = "simple" | "medium" | "complex";

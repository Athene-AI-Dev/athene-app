import { ChatOpenAI } from "@langchain/openai";

/** Model complexity tier — mirrors AtheneState.complexity */
export type ModelTier = "simple" | "medium" | "complex";

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

// We export both the instance and a getter for maximum compatibility
export const getModel = () => LLMFactory.getModel();
export const model = LLMFactory.getModel();

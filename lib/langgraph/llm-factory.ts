// ============================================================
// lib/langgraph/llm-factory.ts — LLM client for agent nodes
//
// Exports a shared ChatOpenAI instance used by all agent nodes.
// ChatOpenAI supports LangGraph's streamEvents natively — tokens
// are streamed automatically when the graph is invoked via
// graph.streamEvents() (wired in ATH-46 / SSE endpoint).
//
// Model: gpt-4o  (synthesis-tier, high quality)
// Temperature: 0 for deterministic, citable answers
//
// TODO ATH-22: replace with resolveModelClient() for BYOK + tier-
//              based model selection (haiku/sonnet/opus per complexity).
// ============================================================

import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
  streaming: true,
});

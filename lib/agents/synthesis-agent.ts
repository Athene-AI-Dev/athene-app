import fs from "fs";
import path from "path";
import type { AtheneState, AtheneStateUpdate, CitedSource, RetrievedChunk } from "../langgraph/state";
import { model } from "../langgraph/llm-factory";

const PROMPT_PATH = path.join(process.cwd(), "lib/agents/prompts/synthesis.md");

/**
 * synthesisAgentNode — Synthesis Agent
 * 
 * Uses LangChain model from factory for consistency with main branch.
 * Handles both Standard and BI (analytical) modes.
 */
export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  const { 
    retrieval_results, 
    messages, 
    task_type,
    is_cross_dept_query 
  } = state;

  // 1. Hallucination Prevention
  if (!retrieval_results || retrieval_results.length === 0) {
    return {
      final_answer: "I don't have enough info in your connected sources.",
      citations: [],
      retrieval_results: [],
      next: "__end__", // Close the loop
    };
  }

  // 2. Prepare Prompt & Context
  let promptTemplate = "";
  try {
    promptTemplate = fs.readFileSync(PROMPT_PATH, "utf-8");
  } catch (err) {
    console.error("Failed to load synthesis prompt:", err);
    throw new Error("Synthesis prompt file missing");
  }
  
  const mode = (task_type === "analytical" || is_cross_dept_query)
    ? "BI (BUSINESS INTELLIGENCE) MODE"
    : "STANDARD MODE";

  const context = retrieval_results
    .map((c) => `[document_id: ${c.document_id}]\nContent: ${c.content_preview}`)
    .join("\n\n---\n\n");

  const systemPrompt = promptTemplate
    .replace("{{MODE}}", mode)
    .replace("{{CONTEXT}}", context);

  // 3. Generate Answer using LangChain model (Supports streaming via streamEvents)
  let finalAnswer = "";

  try {
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: (m as any)._getType() === "human" ? "user" : "assistant",
        content: m.content
      }))
    ]);

    finalAnswer = response.content as string;
  } catch (err) {
    console.error("LLM Call failed:", err);
    throw err;
  }

  // 4. Post-process: Extract citations and update state
  const citedSources = extractCitations(finalAnswer, retrieval_results);

  return {
    final_answer: finalAnswer,
    citations: citedSources,
    retrieval_results: [], // Ephemeral clear
  };
}

function extractCitations(text: string, chunks: RetrievedChunk[]): CitedSource[] {
  const docIdRegex = /\[([a-zA-Z0-9_-]+)\]/g;
  const matches = [...text.matchAll(docIdRegex)];
  const uniqueDocIds = Array.from(new Set(matches.map((m) => m[1])));

  return uniqueDocIds
    .map((docId): CitedSource | null => {
      const chunk = chunks.find((c) => c.document_id === docId);
      if (!chunk) return null;
      
      return {
        document_id: chunk.document_id,
        title: null as string | null,
        external_url: chunk.external_url,
        chunk_index: chunk.chunk_index,
        source_type: chunk.source_type,
      };
    })
    .filter((s): s is CitedSource => s !== null);
}

// ============================================================
// lib/agents/synthesis-agent.ts — Synthesis Agent (ATH-39)
//
// Final stage of the retrieval pipeline. Takes raw chunks from
// state.retrieval_results and writes a clean, cited, human-readable
// answer into state.final_answer + state.citations[].
//
// Dual mode:
//   STANDARD — clarity-first, direct answer + supporting detail
//   BI       — analytical, patterns + data gaps, structured bullets
//              Activated when task_type === "analytical" OR
//              is_cross_dept_query === true
//
// Streaming:
//   Uses ChatOpenAI (streaming: true). Tokens flow automatically
//   when the graph is invoked via graph.streamEvents() — no manual
//   buffering needed here. SSE wiring is handled in ATH-46.
//
// Hallucination prevention:
//   If retrieval_results is empty, returns a refusal string and
//   clears citations. No LLM call is made.
// ============================================================

import fs from "fs";
import path from "path";
import { SystemMessage } from "@langchain/core/messages";
import type { MessageContentComplex } from "@langchain/core/messages";
import type { AtheneState, AtheneStateUpdate, CitedSource, RetrievedChunk } from "../langgraph/state";
import { model } from "../langgraph/llm-factory";

const PROMPT_PATH = path.join(process.cwd(), "lib", "agents", "prompts", "synthesis.md");

// ---- Main node -----------------------------------------------

export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  const { retrieval_results, messages, task_type, is_cross_dept_query } = state;

  // 1. Hallucination prevention — no chunks, no LLM call
  if (!retrieval_results || retrieval_results.length === 0) {
    return {
      final_answer: "I don't have enough info in your connected sources.",
      citations: [],
      retrieval_results: [],
    };
  }

  // 2. Load prompt template
  let promptTemplate: string;
  try {
    promptTemplate = fs.readFileSync(PROMPT_PATH, "utf-8");
  } catch (err) {
    console.error("[synthesis] Failed to load prompt template:", err);
    throw new Error("Synthesis prompt file missing at " + PROMPT_PATH);
  }

  // 3. Select mode — BI for analytical queries or cross-dept access
  const isBIMode = task_type === "analytical" || is_cross_dept_query === true;
  const mode = isBIMode
    ? "BI (BUSINESS INTELLIGENCE) MODE"
    : "STANDARD MODE";

  // 4. Build context block from retrieval chunks
  const context = retrieval_results
    .map((c) => `[document_id: ${c.document_id}]\nContent: ${c.content_preview}`)
    .join("\n\n---\n\n");

  const systemPrompt = promptTemplate
    .replace("{{MODE}}", mode)
    .replace("{{CONTEXT}}", context);

  // 5. Invoke LLM — pass BaseMessage[] directly; ChatOpenAI handles them natively.
  //    LangGraph's streamEvents will emit tokens from this invoke() call
  //    automatically when the graph is run in streaming mode (ATH-46).
  let finalAnswer: string;
  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      ...messages,
    ]);

    // response.content is string | MessageContentComplex[]
    finalAnswer =
      typeof response.content === "string"
        ? response.content
        : (response.content as MessageContentComplex[])
            .map((c) =>
              typeof c === "string" ? c : (c as { type: string; text?: string }).text ?? ""
            )
            .join("");
  } catch (err) {
    console.error("[synthesis] LLM call failed:", err);
    throw err;
  }

  // 6. Extract citations from the answer text
  const citations = extractCitations(finalAnswer, retrieval_results);

  return {
    final_answer: finalAnswer,
    citations,
    retrieval_results: [], // ephemeral — clear so stale context never leaks into the next turn
  };
}

// ---- Citation extraction ------------------------------------

/**
 * Scans the answer text for [doc_id] patterns and resolves each ID
 * back to a CitedSource from the retrieval chunks.
 * Unknown IDs (hallucinated references) are silently dropped.
 */
function extractCitations(text: string, chunks: RetrievedChunk[]): CitedSource[] {
  const docIdRegex = /\[([a-zA-Z0-9_-]+)\]/g;
  const uniqueDocIds = Array.from(
    new Set([...text.matchAll(docIdRegex)].map((m) => m[1]))
  );

  return uniqueDocIds
    .flatMap((docId): CitedSource[] => {
      const chunk = chunks.find((c) => c.document_id === docId);
      if (!chunk) return []; // hallucinated ID — drop it
      return [
        {
          document_id: chunk.document_id,
          title: null,
          external_url: chunk.external_url,
          chunk_index: chunk.chunk_index,
          source_type: chunk.source_type,
        },
      ];
    });
}

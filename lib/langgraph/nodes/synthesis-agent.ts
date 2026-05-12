// ============================================================
// lib/langgraph/nodes/synthesis-agent.ts — Synthesis node (ATH-63)
//
// Full implementation lives here. The wrapper at
// lib/agents/synthesis-agent.ts re-exports from this file.
// ============================================================

import { SystemMessage } from "@langchain/core/messages";
import type { MessageContentComplex } from "@langchain/core/messages";
import type { AtheneState, AtheneStateUpdate, CitedSource, RetrievedChunk } from "../state";
import { model } from "../llm-factory";
import { withLLMSpan } from "../../telemetry/spans";

const SYNTHESIS_PROMPT = `You are an AI assistant synthesizing retrieved information into a clear, cited answer.

MODE: {{MODE}}

CONTEXT (retrieved chunks):
{{CONTEXT}}

{{GRAPH_CONTEXT}}

INSTRUCTIONS:
- Answer the user's question using ONLY the provided context.
- Cite sources inline using [document_id] format for document chunks.
- For graph-sourced relationships, cite with [EXTRACTED] to distinguish from document sources.
- If the context is insufficient, say so clearly.
- In BI mode: focus on patterns, trends, and data gaps with structured bullets.
- In standard mode: provide a direct, readable answer.
{{BOUNDARY_NOTE}}`;

// ---- Helpers ------------------------------------------------

interface GraphResult {
  type: "graph";
  raw: string;
  relationships: string[];
  boundaryReached: boolean;
}

function isGraphResult(item: unknown): item is GraphResult {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as Record<string, unknown>).type === "graph"
  );
}

function isVectorChunk(item: unknown): item is RetrievedChunk & { type?: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as Record<string, unknown>).type !== "graph"
  );
}

/**
 * Builds the graph context section for the synthesis prompt.
 */
function buildGraphContext(graphResults: GraphResult[]): string {
  if (graphResults.length === 0) return "";

  const sections: string[] = ["KNOWLEDGE GRAPH RELATIONSHIPS:"];

  for (const gr of graphResults) {
    if (gr.relationships.length > 0) {
      for (const rel of gr.relationships) {
        sections.push(`  ${rel} [EXTRACTED]`);
      }
    }
    if (gr.raw && !gr.raw.startsWith("No ")) {
      const entityLine = gr.raw.split("\n").find((l) => l.startsWith("Entities found:"));
      if (entityLine) {
        sections.push(`  ${entityLine}`);
      }
    }
  }

  return sections.join("\n");
}

// ---- Main ---------------------------------------------------

/**
 * Resolve the model name from the LangChain model object for span attribution.
 * Different providers expose the name via different fields.
 */
function getModelName(): string {
  const m = model as Record<string, unknown>;
  return (m.modelName as string) || (m.model as string) || "unknown";
}

export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  const { retrieved_chunks, messages, task_type, is_cross_dept_query } = state;

  if (!retrieved_chunks || retrieved_chunks.length === 0) {
    return {
      final_answer: "I don't have enough information in your connected sources to answer that.",
      cited_sources: [],
      retrieved_chunks: [],
    };
  }

  // ── Separate vector chunks from graph results ─────────────
  const vectorChunks: RetrievedChunk[] = retrieved_chunks.filter(isVectorChunk);
  const graphResults: GraphResult[] = retrieved_chunks.filter(isGraphResult);

  const boundaryReached = graphResults.some((gr) => gr.boundaryReached);

  const isBIMode = task_type === "analytical" || is_cross_dept_query === true;
  const mode = isBIMode ? "BI (BUSINESS INTELLIGENCE) MODE" : "STANDARD MODE";

  const context =
    vectorChunks.length > 0
      ? vectorChunks
          .map(
            (c: RetrievedChunk) =>
              `[document_id: ${c.document_id}]\nContent: ${c.content_preview}`
          )
          .join("\n\n---\n\n")
      : "No document chunks retrieved.";

  const graphContext = buildGraphContext(graphResults);

  const boundaryNote = boundaryReached
    ? "IMPORTANT: The knowledge graph traversal reached a boundary. Append this note to your answer: \"Note: there may be related information in areas you don't have access to.\""
    : "";

  const systemPrompt = SYNTHESIS_PROMPT
    .replace("{{MODE}}", mode)
    .replace("{{CONTEXT}}", context)
    .replace("{{GRAPH_CONTEXT}}", graphContext)
    .replace("{{BOUNDARY_NOTE}}", boundaryNote);

  const llmResult = await withLLMSpan(
    getModelName(),
    systemPrompt.length + messages.reduce((acc, m) => acc + (typeof m.content === "string" ? m.content.length : 0), 0),
    async (span) => {
      const stream = await model.stream([
        new SystemMessage(systemPrompt),
        ...messages,
      ]);

      let fullContent = "";
      let tokenCount = 0;

      for await (const chunk of stream) {
        const token = typeof chunk.content === "string"
          ? chunk.content
          : Array.isArray(chunk.content)
            ? chunk.content.map((c: any) => c.text || "").join("")
            : "";

        if (token) {
          fullContent += token;
          tokenCount++;
        }
      }

      span.setAttribute("llm.token_count", tokenCount);
      span.setAttribute("llm.total_chars", fullContent.length);

      return {
        content: fullContent,
        lc_kwargs: { content: fullContent },
      };
    }
  );

  // Extract final answer from streamed result
  const rawContent = (llmResult as any).content ?? (llmResult as any).lc_kwargs?.content ?? "";
  const finalAnswer = typeof rawContent === "string"
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.map((c: any) => (typeof c === "string" ? c : c.text ?? "")).join("")
      : String(rawContent);

  const cited_sources = extractCitations(finalAnswer, vectorChunks);

  return {
    final_answer: finalAnswer,
    cited_sources,
    retrieved_chunks: [],
  };
}

function extractCitations(text: string, chunks: RetrievedChunk[]): CitedSource[] {
  const docIdRegex = /\[([a-zA-Z0-9_-]+)\]/g;
  const uniqueDocIds = Array.from(
    new Set([...text.matchAll(docIdRegex)].map((m) => m[1]))
  );

  const realDocIds = uniqueDocIds.filter(
    (id) => id !== "EXTRACTED" && id !== "document_id"
  );

  return realDocIds.flatMap((docId): CitedSource[] => {
    const chunk = chunks.find((c: RetrievedChunk) => c.document_id === docId);
    if (!chunk) return [];
    return [{
      document_id: chunk.document_id,
      title: null,
      external_url: chunk.external_url,
      chunk_index: chunk.chunk_index,
      source_type: chunk.source_type,
    }];
  });
}

import { SystemMessage } from "@langchain/core/messages";
import type { MessageContentComplex } from "@langchain/core/messages";
import type { AtheneState, AtheneStateUpdate, CitedSource, RetrievedChunk } from "../langgraph/state";
import { getModel } from "../langgraph/llm-factory";

const SYNTHESIS_PROMPT = `You are an AI assistant synthesizing retrieved information into a clear, cited answer.

MODE: {{MODE}}

CONTEXT (retrieved chunks):
{{CONTEXT}}

INSTRUCTIONS:
- Answer the user's question using ONLY the provided context.
- Cite sources inline using [document_id] format.
- If the context is insufficient, say so clearly.
- In BI mode: focus on patterns, trends, and data gaps with structured bullets.
- In standard mode: provide a direct, readable answer.`;

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

  const isBIMode = task_type === "analytical" || is_cross_dept_query === true;
  const mode = isBIMode ? "BI (BUSINESS INTELLIGENCE) MODE" : "STANDARD MODE";

  const context = retrieved_chunks
    .map((c: RetrievedChunk) => `[document_id: ${c.document_id}]\nContent: ${c.content_preview}`)
    .join("\n\n---\n\n");

  const systemPrompt = SYNTHESIS_PROMPT
    .replace("{{MODE}}", mode)
    .replace("{{CONTEXT}}", context);

  const response = await getModel("complex").invoke([
    new SystemMessage(systemPrompt),
    ...messages,
  ]);

  const finalAnswer =
    typeof response.content === "string"
      ? response.content
      : (response.content as MessageContentComplex[])
          .map((c: MessageContentComplex) =>
            typeof c === "string" ? c : (c as { type: string; text?: string }).text ?? ""
          )
          .join("");

  const cited_sources = extractCitations(finalAnswer, retrieved_chunks);

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

  return uniqueDocIds.flatMap((docId): CitedSource[] => {
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

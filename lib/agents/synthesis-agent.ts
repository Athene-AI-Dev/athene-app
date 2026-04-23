import fs from "fs";
import path from "path";
import type { AtheneState, AtheneStateUpdate, CitedSource, RetrievedChunk } from "../langgraph/state";
import { resolveModelClient, type ResolvedModelClient } from "../langgraph/llm-factory";
import { supabaseAdmin } from "../supabase/server";

const PROMPT_PATH = path.join(process.cwd(), "lib/agents/prompts/synthesis.md");

/**
 * synthesisAgentNode — Synthesis Agent
 * 
 * Optimized for performance using raw SDKs to avoid dependency overhead.
 * Handles both Standard and BI (analytical) modes.
 */
export async function synthesisAgentNode(
  state: AtheneState,
): Promise<AtheneStateUpdate> {
  const { 
    retrieved_chunks, 
    messages, 
    org_id, 
    complexity, 
    task_type,
    is_cross_dept_query 
  } = state;

  // 1. Hallucination Prevention
  if (!retrieved_chunks || retrieved_chunks.length === 0) {
    return {
      final_answer: "I don't have enough info in your connected sources.",
      cited_sources: [],
      retrieved_chunks: [],
      run_status: "completed",
    };
  }

  // 2. Resolve the pre-instantiated LLM client from the factory
  const resolved = await resolveModelClient(supabaseAdmin, org_id, complexity, "medium");

  // 3. Prepare Prompt & Context
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

  const context = retrieved_chunks
    .map((c) => `[document_id: ${c.document_id}]\nContent: ${c.content_preview}`)
    .join("\n\n---\n\n");

  const systemPrompt = promptTemplate
    .replace("{{MODE}}", mode)
    .replace("{{CONTEXT}}", context);

  // 5. Generate Answer using Raw SDK (Supports fast streaming)
  let finalAnswer = "";

  try {
    if (resolved.provider === "anthropic" && resolved.anthropic) {
      // Convert State messages to Anthropic messages
      const anthropicMsg: any[] = messages.map(m => ({
        role: m._getType() === "human" ? "user" as const : "assistant" as const,
        content: m.content as string
      }));

      const stream = await resolved.anthropic.messages.create({
        model: resolved.modelId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: anthropicMsg,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          finalAnswer += chunk.delta.text;
        }
      }
    } 
    else if (resolved.provider === "openai" && resolved.openai) {
      const openaiMsg: any[] = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m._getType() === "human" ? "user" as const : "assistant" as const,
          content: m.content as string
        }))
      ];

      const stream = await resolved.openai.chat.completions.create({
        model: resolved.modelId,
        messages: openaiMsg,
        stream: true,
      });

      for await (const chunk of stream) {
        finalAnswer += chunk.choices[0]?.delta?.content || "";
      }
    }
    else if (resolved.provider === "google" && resolved.google) {
      const model = resolved.google.getGenerativeModel({ model: resolved.modelId });
      const prompt = `${systemPrompt}\n\nConversation History:\n${messages.map(m => `${m._getType()}: ${m.content}`).join("\n")}`;
      
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        finalAnswer += chunk.text();
      }
    }
    else {
      throw new Error(`Synthesis Agent: Client for ${resolved.provider} not initialized in factory.`);
    }
  } catch (err) {
    console.error(`LLM Call failed (${resolved.provider}):`, err);
    throw err;
  }

  // 6. Post-process: Extract citations and update state
  const citedSources = extractCitations(finalAnswer, retrieved_chunks);

  return {
    final_answer: finalAnswer,
    cited_sources: citedSources,
    retrieved_chunks: [], // Ephemeral clear
    run_status: "completed",
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

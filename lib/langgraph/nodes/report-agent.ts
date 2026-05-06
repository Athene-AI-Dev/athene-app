import type { AtheneStateType, AtheneStateUpdate } from "../state";
import { vectorSearch } from "@/lib/tools/vector-search";
import { graphQueryTool } from "../tools/graph-query";
import { SystemMessage, HumanMessage, type MessageContent } from "@langchain/core/messages";
import { getModel } from "../llm-factory";

// Lightweight model for the planning step — only produces a JSON array of titles.
const plannerModel = getModel("simple", 0);
// Slightly higher temperature for prose generation
const synthesisModel = getModel("simple", 0.2);

// Inlined prompt template
const PLAN_PROMPT_TEMPLATE = `# Report Planning Prompt

You are an expert analyst tasked with planning a comprehensive report.
Given the user's query, your job is to outline a structured report by breaking it down into logical sections.

Return a JSON array containing 3 to 6 section titles.
Each section title should be a concise string representing a distinct topic to be covered in the report.

Query: {{query}}

Example Output:
["Executive Summary", "Key Metrics", "Recent Developments", "Challenges & Risks", "Conclusion"]`;

/**
 * Extract plain text from a LangChain message content value.
 */
function extractText(
  content: MessageContent,
  fallback = "Generate a report"
): string {
  if (typeof content === "string") return content || fallback;
  const text = content
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text"
    )
    .map((block) => block.text)
    .join(" ")
    .trim();
  return text || fallback;
}

/**
 * Report Agent Node
 * 
 * Flow:
 * 1. Plan sections (LLM)
 * 2. For each section:
 *    a. Vector search for context
 *    b. Graph search for "Connected Concepts" (ATH-CONTEXT fix)
 *    c. Synthesis with citations
 * 3. Combine into final report
 */
export async function reportAgent(
  state: AtheneStateType,
  _config: unknown
): Promise<AtheneStateUpdate> {
  const {
    orgId,
    userId,
    role,
    messages,
  } = state;

  // Extract the latest query
  const lastMessage =
    messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const query: string = lastMessage
    ? extractText(
        lastMessage.content as MessageContent
      )
    : "Generate a report";

  // 1. Plan sections using LLM
  const planPrompt = PLAN_PROMPT_TEMPLATE.replace("{{query}}", query);

  const planResponse = await plannerModel.invoke([
    new SystemMessage(planPrompt),
  ]);

  let sections: string[] = [];
  try {
    let rawContent = extractText(
      planResponse.content as MessageContent
    );
    if (rawContent.startsWith("```json")) {
      rawContent = rawContent
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "");
    }
    sections = JSON.parse(rawContent);
    if (!Array.isArray(sections)) {
      sections = ["Introduction", "Key Findings", "Conclusion"];
    }
  } catch (error) {
    console.error("Failed to parse report plan:", error);
    sections = ["Introduction", "Key Findings", "Conclusion"];
  }

  sections = sections.slice(0, 6);

  // 2. Process sections in chunks (concurrency control)
  const CONCURRENCY_LIMIT = 3;
  const compiledSections: string[] = [];
  
  for (let i = 0; i < sections.length; i += CONCURRENCY_LIMIT) {
    const batch = sections.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map(async (section) => {
        // a. Vector Search
        const results = await vectorSearch({
        orgId,
        userId,
        user_role: role as "member" | "super_user" | "admin",
        query: `${query} - ${section}`,
        topK: 5,
      });

      const sourceDocs = results.map((r: any, i: number) => ({
        index: i + 1,
        chunk_id: r.chunk_id ?? r.id ?? `chunk_${i}`,
        document_id: r.document_id ?? "unknown",
        content:
          r.content_preview ??
          r.metadata?.text_preview ??
          r.metadata?.content ??
          r.metadata?.text ??
          (typeof r.metadata === "object"
            ? JSON.stringify(r.metadata)
            : String(r.metadata ?? "")),
      }));

      const sourceBlock = sourceDocs
        .map(
          (s: { index: number; chunk_id: string; document_id: string; content: string }) =>
            `[Source ${s.index}] chunk_id=${s.chunk_id}, document_id=${s.document_id}\n${s.content}`
        )
        .join("\n\n");

      // b. Graph Search for Connected Concepts
      let connectedConcepts = "";
      try {
        const graphResult = await (graphQueryTool as any).func(
          { question: section, maxHops: 2 },
          undefined,
          { configurable: { orgId, role } }
        );

        if (graphResult && !graphResult.includes("No knowledge graph data")) {
          // Use regex to find relationship patterns: Entity -> RELATION -> Entity
          const relRegex = /([^\n→]+) → ([^\n→]+) → ([^\n→\s\[]+)/g;
          const matches = [...graphResult.matchAll(relRegex)];
          
          if (matches.length > 0) {
            const relLines = matches.slice(0, 5).map(m => m[0].trim());
            connectedConcepts = `\n\n**Connected concepts:** ${relLines.join(" | ")}`;
          }
        }
      } catch (err) {
        console.warn(`[report-agent] Graph query failed for section "${section}":`, err);
      }

      // c. Synthesize
      const synthesizePrompt = `You are a helpful analyst writing a section for a report.
Section Title: ${section}

Below are the source documents retrieved for this section. Each source has a chunk_id.

${sourceBlock}

INSTRUCTIONS:
- Write the section content in markdown format.
- Do NOT include the section title as a heading, just write the body content.
- You MUST cite sources inline using the format [source: <chunk_id>] for every claim derived from a source document.
- Every section must contain at least one citation.`;

      const synthesizeResponse = await synthesisModel.invoke([
        new SystemMessage(synthesizePrompt),
        new HumanMessage("Write the section now."),
      ]);

        const sectionContent = extractText(
          synthesizeResponse.content as MessageContent
        );
        return `## ${section}\n\n${sectionContent}${connectedConcepts}`;
      })
    );
    compiledSections.push(...batchResults);
  }

  const finalReport = compiledSections.join("\n\n");

  return {
    final_answer: finalReport,
  };
}

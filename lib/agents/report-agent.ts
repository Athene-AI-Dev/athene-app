import { AtheneStateType, AtheneStateUpdate } from "../langgraph/state";
import { model as synthesisModel } from "../langgraph/llm-factory";
import { vectorSearch } from "../tools/vector-search";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// Lightweight model for the planning step — only produces a JSON array of titles.
const plannerModel = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });

// Inlined prompt template — avoids fs.readFileSync which crashes in Edge Runtime.
const PLAN_PROMPT_TEMPLATE = `# Report Planning Prompt

You are an expert analyst tasked with planning a comprehensive report.
Given the user's query, your job is to outline a structured report by breaking it down into logical sections.

Return a JSON array containing 3 to 6 section titles.
Each section title should be a concise string representing a distinct topic to be covered in the report.

Query: {{query}}

Example Output:
["Executive Summary", "Key Metrics", "Recent Developments", "Challenges & Risks", "Conclusion"]`;

export async function reportAgent(
  state: AtheneStateType,
  config: any
): Promise<AtheneStateUpdate> {
  const { orgId, userId, role, messages } = state;

  // Extract the latest query.
  // LangChain .content can be a string OR an array of content blocks
  // (e.g. [{ type: "text", text: "..." }]).  Template-string interpolation
  // on an array silently produces "[object Object]", so we normalise here.
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const rawContent = lastMessage?.content;
  const query: string =
    typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join(" ")
          || "Generate a report"
        : "Generate a report";

  // 1. Plan sections using LLM
  const planPrompt = PLAN_PROMPT_TEMPLATE.replace("{{query}}", query);

  const planResponse = await plannerModel.invoke([
    new SystemMessage(planPrompt),
  ]);

  let sections: string[] = [];
  try {
    // Attempt to parse the content as JSON.
    let content = planResponse.content.toString();
    if (content.startsWith("\`\`\`json")) {
      content = content.replace(/^\`\`\`json\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    sections = JSON.parse(content);
    if (!Array.isArray(sections)) {
      sections = ["Introduction", "Key Findings", "Conclusion"];
    }
  } catch (error) {
    console.error("Failed to parse report plan:", error);
    sections = ["Introduction", "Key Findings", "Conclusion"];
  }

  // Guard: clamp to a maximum of 6 sections per spec
  sections = sections.slice(0, 6);

  // 2. For each section, search and synthesize — in parallel for speed.
  const compiledSections = await Promise.all(
    sections.map(async (section) => {
      // Vector search
      const results = await vectorSearch({
        orgId,
        userId,
        role: role as "member" | "admin" | "bi_analyst",
        query: `${query} - ${section}`,
        topK: 5,
      });

      // Build a structured source list with chunk_id + document_id for citations
      const sourceDocs = results.map((r: any, i: number) => ({
        index: i + 1,
        chunk_id: r.chunk_id ?? `chunk_${i}`,
        document_id: r.document_id ?? "unknown",
        content: r.metadata?.text_preview ?? r.metadata?.content ?? (typeof r.metadata === "object" ? JSON.stringify(r.metadata) : String(r.metadata)),
      }));

      const sourceBlock = sourceDocs
        .map(
          (s) =>
            `[Source ${s.index}] chunk_id=${s.chunk_id}, document_id=${s.document_id}\n${s.content}`
        )
        .join("\n\n");

      // Synthesize with mandatory citation format
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

      return `## ${section}\n\n${synthesizeResponse.content}`;
    })
  );

  // Combine into final report
  const finalReport = compiledSections.join("\n\n");

  return {
    final_answer: finalReport,
  };
}

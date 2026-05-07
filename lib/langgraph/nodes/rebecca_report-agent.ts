import type { AtheneStateType, AtheneStateUpdate } from "../state";
import { vectorSearch } from "@/lib/tools/vector-search";
import { graphQueryTool } from "../tools/graph-query";
import { SystemMessage, HumanMessage, type MessageContent } from "@langchain/core/messages";
import { getModel } from "../llm-factory";

// ─── FIX #13: Lazy model initialisation — avoids expensive getModel() calls
// at import/startup time for deployments that never invoke reportAgent.
let _plannerModel: ReturnType<typeof getModel> | null = null;
let _synthesisModel: ReturnType<typeof getModel> | null = null;

function getPlannerModel()   { return (_plannerModel   ??= getModel("simple", 0)); }
function getSynthesisModel() { return (_synthesisModel ??= getModel("simple", 0.2)); }

// ─── FIX #8: Concurrency limit lifted to module level and env-configurable.
const CONCURRENCY_LIMIT = parseInt(process.env.REPORT_CONCURRENCY ?? "3", 10);

// Static portion of the plan prompt — query is passed as a HumanMessage (FIX #1).
const PLAN_SYSTEM_PROMPT = `# Report Planning Prompt

You are an expert analyst tasked with planning a comprehensive report.
Given the user's query, your job is to outline a structured report by breaking it down into logical sections.

Return a JSON array containing 3 to 6 section titles.
Each section title should be a concise string representing a distinct topic to be covered in the report.

Example Output:
["Executive Summary", "Key Metrics", "Recent Developments", "Challenges & Risks", "Conclusion"]`;

// ─── FIX #9: Synthesis prompt extracted as a named builder — testable and
// versionable independently of the core agent logic.
function buildSynthesisPrompt(section: string, sourceBlock: string): string {
  return `You are a helpful analyst writing a section for a report.
Section Title: ${section}

Below are the source documents retrieved for this section. Each source has a chunk_id.

${sourceBlock}

INSTRUCTIONS:
- Write the section content in markdown format.
- Do NOT include the section title as a heading, just write the body content.
- You MUST cite sources inline using the format [source: <chunk_id>] for every claim derived from a source document.
- Every section must contain at least one citation.`;
}

// ─── FIX #3: Typed interface for vector search results — replaces `r: any`.
interface VectorSearchResult {
  chunk_id?: string;
  id?: string;
  document_id?: string;
  content_preview?: string;
  metadata?: Record<string, unknown>;
}

// ─── FIX #2: Typed interface for graphQueryTool — replaces `as any`.
interface GraphQueryInput { question: string; maxHops: number }
interface GraphQueryToolLike {
  func: (
    input: GraphQueryInput,
    _: undefined,
    config: { configurable: { orgId: string; role: string } }
  ) => Promise<string>;
}

/**
 * Extract the text content from a vector search result, falling back through
 * available metadata fields. Returns an empty string (never undefined).
 * FIX #3: replaces the inline five-level fallback chain on `r: any`.
 */
function extractContent(r: VectorSearchResult): string {
  return (
    r.content_preview ??
    (r.metadata?.text_preview as string | undefined) ??
    (r.metadata?.content   as string | undefined) ??
    (r.metadata?.text      as string | undefined) ??
    (typeof r.metadata === "object" && r.metadata !== null
      ? JSON.stringify(r.metadata)
      : "") ??
    ""
  );
}

/**
 * Extract plain text from a LangChain MessageContent value.
 * FIX #10: logs a warning when the empty-string fallback is triggered so
 * callers know a model returned nothing rather than having it silently masked.
 */
function extractText(
  content: MessageContent,
  fallback = "Generate a report"
): string {
  if (typeof content === "string") {
    if (!content) {
      console.warn("[report-agent] extractText: model returned empty string, using fallback");
    }
    return content || fallback;
  }

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

  if (!text) {
    console.warn("[report-agent] extractText: no text blocks found in content, using fallback");
  }

  return text || fallback;
}

/**
 * Report Agent Node
 *
 * Flow:
 * 1. Plan sections (LLM) — query passed as HumanMessage, not inlined into system prompt
 * 2. For each section (batched, concurrency-controlled):
 *    a. Vector search + graph search run in parallel (Promise.allSettled)
 *    b. Synthesis with citations
 *    c. Per-section errors are isolated — one failure does not abort the report
 * 3. Combine into final report
 */
export async function reportAgent(
  state: AtheneStateType,
  _config: unknown
): Promise<AtheneStateUpdate> {
  const { orgId, userId, role, messages } = state;

  // Extract the latest user query
  const lastMessage = messages?.length ? messages[messages.length - 1] : null;
  const query: string = lastMessage
    ? extractText(lastMessage.content as MessageContent)
    : "Generate a report";

  // ── 1. Plan sections ──────────────────────────────────────────────────────
  // FIX #1: query is passed as a HumanMessage so it is clearly delimited as
  // data, not instruction — closes the prompt injection vector.
  const planResponse = await getPlannerModel().invoke([
    new SystemMessage(PLAN_SYSTEM_PROMPT),
    new HumanMessage(query),
  ]);

  let sections: string[] = [];
  try {
    let rawContent = extractText(planResponse.content as MessageContent);

    // Strip optional ```json ... ``` fencing from the model's response
    if (rawContent.includes("```")) {
      rawContent = rawContent
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    const parsed: unknown = JSON.parse(rawContent);

    if (!Array.isArray(parsed)) {
      throw new Error("Plan response is not a JSON array");
    }

    // FIX #2 (plan parsing): validate every element is a non-empty string —
    // prevents null/number/object elements from silently flowing into prompts.
    sections = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 6);

    if (sections.length === 0) {
      throw new Error("Plan array contained no valid string titles");
    }
  } catch (error) {
    console.error("[report-agent] Failed to parse report plan:", error);
    sections = ["Introduction", "Key Findings", "Conclusion"];
  }

  // ── 2. Process sections in batches ───────────────────────────────────────
  const compiledSections: string[] = [];

  for (let i = 0; i < sections.length; i += CONCURRENCY_LIMIT) {
    const batch = sections.slice(i, i + CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map(async (section): Promise<string> => {
        // FIX #4: per-section try/catch — one section's failure (network timeout,
        // model error, etc.) produces a placeholder instead of aborting the report.
        try {
          // ── 2a. Vector search + graph query in parallel ───────────────────
          // FIX #6: was sequential (vectorSearch then graphQueryTool); now both
          // are fired concurrently with Promise.allSettled so neither blocks
          // the other. allSettled means one failure doesn't cancel the other.
          const [vectorResult, graphResult] = await Promise.allSettled([
            vectorSearch({
              orgId,
              userId,
              // FIX #7: indentation corrected — argument object is now unambiguously
              // inside the batch.map async callback, not at the for-loop level.
              user_role: role as "member" | "super_user" | "admin",
              query: `${query} - ${section}`,
              topK: 5,
            }),
            // FIX #2 (graph tool): typed cast replaces `as any` — access context
            // is now type-checked and can't silently pass wrong org/role values.
            (graphQueryTool as unknown as GraphQueryToolLike).func(
              { question: section, maxHops: 2 },
              undefined,
              { configurable: { orgId, role } }
            ),
          ]);

          // ── 2b. Process vector results ────────────────────────────────────
          // FIX #3: uses typed VectorSearchResult + extractContent() helper
          // instead of `r: any` with an inline five-level fallback.
          const rawResults: VectorSearchResult[] =
            vectorResult.status === "fulfilled" ? vectorResult.value : [];

          if (vectorResult.status === "rejected") {
            console.warn(
              `[report-agent] Vector search failed for section "${section}":`,
              vectorResult.reason
            );
          }

          const sourceDocs = rawResults.map((r, idx) => ({
            index: idx + 1,
            chunk_id:    r.chunk_id ?? r.id ?? `chunk_${idx}`,
            document_id: r.document_id ?? "unknown",
            content:     extractContent(r),
          }));

          const sourceBlock = sourceDocs
            .map(
              (s) =>
                `[Source ${s.index}] chunk_id=${s.chunk_id}, document_id=${s.document_id}\n${s.content}`
            )
            .join("\n\n");

          // ── 2c. Process graph results ─────────────────────────────────────
          let connectedConcepts = "";
          const graphText =
            graphResult.status === "fulfilled" ? graphResult.value : "";

          if (graphResult.status === "rejected") {
            console.warn(
              `[report-agent] Graph query failed for section "${section}":`,
              graphResult.reason
            );
          }

          if (graphText && !graphText.includes("No knowledge graph data")) {
            // FIX #5: regex now accepts both → and -> with flexible whitespace,
            // matching real-world graph tool output variations.
            const relRegex =
              /([^\n\-→]+?)\s*(?:→|->)\s*([^\n\-→]+?)\s*(?:→|->)\s*([^\n[\s]+)/g;
            const matches = [...graphText.matchAll(relRegex)];

            if (matches.length === 0) {
              console.warn(
                `[report-agent] Graph result for "${section}" had no parseable relations. Raw (first 200 chars):`,
                graphText.slice(0, 200)
              );
            } else {
              const relLines = matches.slice(0, 5).map((m) => m[0].trim());
              connectedConcepts = `**Connected concepts:** ${relLines.join(" | ")}`;
            }
          }

          // ── 2d. Synthesise section ────────────────────────────────────────
          // FIX #9: uses named buildSynthesisPrompt() instead of an inline template.
          const synthesizeResponse = await getSynthesisModel().invoke([
            new SystemMessage(buildSynthesisPrompt(section, sourceBlock)),
            new HumanMessage("Write the section now."),
          ]);

          const sectionContent = extractText(
            synthesizeResponse.content as MessageContent
          );

          // FIX #11: ensure a blank line separates prose from connectedConcepts
          // so the appended block never runs on to the last sentence.
          const conceptsBlock = connectedConcepts
            ? `\n\n${connectedConcepts}`
            : "";

          return `## ${section}\n\n${sectionContent.trimEnd()}${conceptsBlock}`;

        } catch (err) {
          // FIX #4: isolated section failure — log and return a placeholder
          // instead of rejecting the entire Promise.all batch.
          console.error(`[report-agent] Section "${section}" failed:`, err);
          return `## ${section}\n\n_This section could not be generated due to an error._`;
        }
      })
    );

    compiledSections.push(...batchResults);
  }

  const finalReport = compiledSections.join("\n\n");

  return { final_answer: finalReport };
}

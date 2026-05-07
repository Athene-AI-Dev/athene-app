import { supabaseAdmin } from "@/lib/supabase/server";
import { reportAgent } from "../langgraph/nodes/report-agent";
import { getNeighbors } from "../knowledge-graph/query";
import type { AgentState } from "../langgraph/types"; // FIX #8: proper type instead of `as any`

/**
 * The prompt sent to the report agent to generate the user's morning briefing.
 */
const MORNING_BRIEFING_PROMPT =
  "Summarize today's calendar, top 3 unread emails, and recent document updates.";

// FIX #9: typed union instead of bare string
type DeliveryMethod = "in_app" | "email" | "push" | "slack";

// FIX #8: minimal typed input for automation calls — no `as any` needed
type AutomationAgentInput = Pick<AgentState, "orgId" | "userId" | "role" | "messages">;

/**
 * Section keyword map. Each entry is [regex, canonical key].
 * FIX #7: replaces brittle title.includes("calendar") with a regex map
 * so that variations like "Today's Agenda" or "Important Documents" still
 * resolve to the right key even if the LLM changes its exact wording.
 */
const SECTION_MAP: [RegExp, string][] = [
  [/calendar|schedule|agenda/i, "calendar"],
  [/email|inbox|message/i,      "emails"],
  [/doc|file|document|update/i, "docs"],
];

function resolveSectionKey(title: string): string {
  for (const [re, key] of SECTION_MAP) {
    if (re.test(title)) return key;
  }
  return title; // fallback: store under the raw title
}

/**
 * Parse markdown sections (## Heading) into a structured object.
 * FIX #7: uses resolveSectionKey() instead of raw .includes() matching.
 */
function parseBriefingSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};

  if (!text.includes("##")) {
    sections.summary = text.trim();
    return sections;
  }

  const parts = text.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const rawTitle = lines[0].trim().toLowerCase();
    const content  = lines.slice(1).join("\n").trim();
    sections[resolveSectionKey(rawTitle)] = content;
  }
  return sections;
}

/**
 * Escape markdown link-syntax characters in user-supplied strings.
 * FIX #2 (security): prevents crafted node labels from producing
 * malformed or malicious markdown links stored in the DB.
 */
function escapeMd(s: string): string {
  return s.replace(/[[\]()]/g, "\\$&");
}

/**
 * Truncate text to at most `maxChars` characters, preferring a sentence
 * boundary and appending "…" when the text is cut mid-sentence.
 * FIX #8: replaces .slice(0, 160) which can split multi-byte characters.
 */
function truncateSummary(text: string, maxChars = 160): string {
  if ([...text].length <= maxChars) return text; // count codepoints, not bytes
  const cut = [...text].slice(0, maxChars).join("");
  const lastPeriod = cut.lastIndexOf(".");
  return lastPeriod > 80 ? cut.slice(0, lastPeriod + 1) : cut + "…";
}

/**
 * Count list items (lines starting with "- ") in a markdown section.
 * FIX #5: gives the real item count rather than a boolean 0|1.
 */
function countListItems(section: string | undefined): number {
  if (!section) return 0;
  return (section.match(/^-\s/gm) ?? []).length;
}

/**
 * Generates a morning briefing for one user.
 *
 * FIX #1 (security): added membership + ownership check before any work.
 * FIX #3 (error handling): error message is now included in the return value.
 * FIX #4 (performance): getNeighbors calls are parallelised with Promise.all.
 * FIX #6 (correctness): role is resolved from DB rather than hardcoded.
 */
export async function generateMorningBriefing(
  userId: string,
  orgId: string,
  automationId?: string,
  deliveryMethod: DeliveryMethod = "in_app" // FIX #9: typed param
): Promise<
  | { success: true;  userId: string; briefing: string }
  | { success: false; userId: string; briefing: null; error: string }
> {
  try {
    // ── FIX #1 & #6: Verify membership and resolve actual role ──────────────
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .single();

    if (memberErr || !member) {
      throw new Error(`User ${userId} is not a member of org ${orgId}`);
    }

    const ctx = {
      org_id:    orgId,
      user_id:   userId,
      user_role: member.role as "member" | "admin" | "owner", // FIX #6: real role
    };

    // ── 1. Call the report agent ─────────────────────────────────────────────
    // FIX #8: typed input — no `as any`
    const agentInput: AutomationAgentInput = {
      orgId,
      userId,
      role:     "member",
      messages: [{ content: MORNING_BRIEFING_PROMPT }],
    };

    const result = await reportAgent(agentInput, {});

    const briefingText      = result.final_answer || "No briefing generated.";
    const structuredContent = parseBriefingSections(briefingText);

    // ── 2. Fetch Knowledge Highlights ────────────────────────────────────────
    try {
      // FIX #4a: compute the threshold once as a ms timestamp for safe comparison
      const yesterdayMs  = Date.now() - 24 * 60 * 60 * 1000;
      const yesterdayISO = new Date(yesterdayMs).toISOString();

      const { data: recentNodes, error: nodeErr } = await supabaseAdmin
        .from("kg_nodes")
        .select("id, label")
        .eq("org_id", orgId)
        .gt("updated_at", yesterdayISO)
        .limit(5);

      if (!nodeErr && recentNodes && recentNodes.length > 0) {
        // FIX #4: parallel fan-out — was a sequential for-loop
        const neighborResults = await Promise.all(
          recentNodes.map((node) =>
            getNeighbors(ctx, node.id).then((r) => ({ node, ...r }))
          )
        );

        const highlights: string[] = [];

        for (const { node, nodes: neighbors, edges } of neighborResults) {
          // FIX #4b: compare via Date objects — was a raw string comparison
          const newEdges = edges.filter(
            (e) => e.updated_at && new Date(e.updated_at).getTime() > yesterdayMs
          );

          if (newEdges.length > 0) {
            const relNames = newEdges.map((e) => {
              const neighborId =
                e.source_node === node.id ? e.target_node : e.source_node;
              const neighbor = neighbors.find((n) => n.id === neighborId);
              return escapeMd(neighbor?.label ?? "Unknown"); // FIX #2: escape label
            });

            // FIX #2: escape node label and encode node.id in the URL
            highlights.push(
              `[${escapeMd(node.label)}](/graph?focus=${encodeURIComponent(node.id)})` +
              ` gained ${newEdges.length} new connection${newEdges.length === 1 ? "" : "s"}: ${relNames.join(", ")}`
            );
          }
        }

        if (highlights.length > 0) {
          structuredContent.knowledge = highlights.map((h) => `- ${h}`).join("\n");
        }
      }
    } catch (err) {
      console.warn("[morning-briefing] Failed to fetch knowledge highlights:", err);
      // Non-fatal: briefing is still stored without the knowledge section
    }

    // ── 3. Persist the briefing ───────────────────────────────────────────────
    const { error: insertError } = await supabaseAdmin.from("briefings").insert({
      user_id:        userId,
      org_id:         orgId,
      automation_id:  automationId ?? null,
      content:        structuredContent,
      summary:        truncateSummary(briefingText),    // FIX #8: safe truncation
      delivery_method: deliveryMethod,
      // FIX #5: real item counts, not a boolean 0|1
      calendar_items: countListItems(structuredContent.calendar),
      email_items:    countListItems(structuredContent.emails),
      doc_items:      countListItems(structuredContent.docs),
    });

    if (insertError) throw insertError;

    return { success: true, userId, briefing: briefingText };

  } catch (error) {
    console.error("[morning-briefing] Failed to generate briefing:", error);
    // FIX #3: surface the error message so callers can act on it
    return {
      success: false,
      userId,
      briefing: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

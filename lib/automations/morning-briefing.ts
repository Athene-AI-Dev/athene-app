import { supabaseAdmin } from "@/lib/supabase/server";
import { reportAgent } from "../langgraph/nodes/report-agent";
import { getNeighbors } from "../knowledge-graph/query";
import { HumanMessage } from "@langchain/core/messages";
import type { AtheneStateType } from "../langgraph/state";




/**
 * This is the prompt we send to the report agent.
 * The report agent will use this to generate the user's morning briefing.
 */
const MORNING_BRIEFING_PROMPT =
  "Summarize today's calendar, top 3 unread emails, and recent document updates.";

/**
 * Helper to parse markdown sections into a structured object.
 * Expects sections starting with "## Section Title".
 */
function parseBriefingSections(text: string) {
  const sections: Record<string, string> = {};
  
  // If no headers found, treat as general summary
  if (!text.includes("##")) {
    sections.summary = text.trim();
    return sections;
  }

  const parts = text.split(/^##\s+/m);
  
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const title = lines[0].trim().toLowerCase();
    const content = lines.slice(1).join("\n").trim();
    
    if (title.includes("calendar")) sections.calendar = content;
    else if (title.includes("email")) sections.emails = content;
    else if (title.includes("doc")) sections.docs = content;
    else if (title) sections[title] = content;
  }
  return sections;
}

/**
 * Word-boundary-aware truncation for summaries.
 */
function truncateSummary(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, max)) + "\u2026";
}


/**
 * Generates a morning briefing for one user.
 */
export async function generateMorningBriefing(
  userId: string,
  orgId: string,
  automationId?: string,
  deliveryMethod = "in_app"
) {
  try {
    // 1. Fetch the real role first to ensure correct data scoping
    // userId here is automations.user_id — a UUID FK to org_members.id (internal UUID).
    // org_members has no "user_id" column; Clerk IDs live in "clerk_user_id".
    const { data: member, error: roleErr } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("id", userId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (roleErr) {
      console.error("[morning-briefing] Failed to fetch user role:", roleErr);
    }

    const role = member?.role ?? "member";
    const ctx = { org_id: orgId, user_id: userId, user_role: role as any };

    // 2. Call the report agent to generate core sections
    // Use a safe partial type that still enforces the fields you provide
    type BriefingAgentState = Pick<AtheneStateType,
      "orgId" | "userId" | "role" | "messages"
    >;
    const state: BriefingAgentState = {
      orgId,
      userId,
      role,
      messages: [new HumanMessage(MORNING_BRIEFING_PROMPT)],
    };


    const result = await reportAgent(state as AtheneStateType, {});

    const briefingText = result.final_answer || "No briefing generated.";
    const structuredContent = parseBriefingSections(briefingText);

    // Graph block is authoritative — remove any LLM-generated knowledge section
    delete structuredContent.knowledge;


    // 2. Fetch Knowledge Highlights (Recent Graph Changes)
    try {
      const yesterdayMs = Date.now() - 24 * 60 * 60 * 1000;
      const yesterdayIso = new Date(yesterdayMs).toISOString();
      const { data: recentNodes, error: nodeErr } = await supabaseAdmin
        .from("kg_nodes")
        .select("id, label")
        .eq("org_id", orgId)
        .gt("updated_at", yesterdayIso)
        .limit(5);

      if (!nodeErr && recentNodes && recentNodes.length > 0) {
        const highlights: string[] = [];
        
        // Fetch neighbors in parallel to reduce latency
        const neighborResults = await Promise.all(
          recentNodes.map(node => getNeighbors(ctx, node.id))
        );

        for (let i = 0; i < recentNodes.length; i++) {
          const node = recentNodes[i];
          const { nodes: neighbors, edges } = neighborResults[i];
          
          // Filter for edges added/updated in the last 24h (timezone-safe comparison)
          const newEdges = edges.filter(e => e.updated_at && new Date(e.updated_at).getTime() > yesterdayMs);
          
          if (newEdges.length > 0) {
            const relNames = newEdges.map(e => {
              const neighborId = e.source_node === node.id ? e.target_node : e.source_node;
              const neighbor = neighbors.find(n => n.id === neighborId);
              return neighbor?.label || "Unknown";
            });
            highlights.push(`[${node.label}](/graph?focus=${node.id}) gained ${newEdges.length} new connections: ${relNames.join(", ")}`);
          }
        }
        
        if (highlights.length > 0) {
          structuredContent.knowledge = highlights.map(h => `- ${h}`).join("\n");
        }
      }
    } catch (err) {
      console.warn("[morning-briefing] Failed to fetch knowledge highlights:", err);
      // Surface failure in stored content for UI to display
      structuredContent.knowledgeError = "Knowledge highlights temporarily unavailable.";
    }


    // 3. Store the generated briefing
    const { error } = await supabaseAdmin.from("briefings").insert({
      user_id: userId,
      org_id: orgId,
      automation_id: automationId ?? null,
      content: structuredContent,
      summary: truncateSummary(briefingText),
      delivery_method: deliveryMethod,
      calendar_items: (structuredContent.calendar?.match(/^-\s/gm) ?? []).length,
      email_items: (structuredContent.emails?.match(/^-\s/gm) ?? []).length,
      doc_items: (structuredContent.docs?.match(/^-\s/gm) ?? []).length,
    });


    if (error) throw error;

    return {
      success: true,
      userId,
      briefing: briefingText,
    };
  } catch (error) {
    console.error("[morning-briefing] Failed to generate briefing:", error);
    return {
      success: false,
      userId,
      briefing: null,
    };
  }
}
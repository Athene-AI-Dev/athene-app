import { supabaseAdmin } from "@/lib/supabase/server";
import { reportAgent } from "../langgraph/nodes/report-agent";
import { getNeighbors } from "../knowledge-graph/query";

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
 * Generates a morning briefing for one user.
 */
export async function generateMorningBriefing(
  userId: string,
  orgId: string,
  automationId?: string,
  deliveryMethod = "in_app"
) {
  try {
    const ctx = { org_id: orgId, user_id: userId, user_role: "member" as const };

    // 1. Call the report agent to generate core sections
    const result = await reportAgent(
      {
        orgId,
        userId,
        role: "member",
        messages: [{ content: MORNING_BRIEFING_PROMPT }],
      } as any, // lightweight state for automation
      {}
    );

    const briefingText = result.final_answer || "No briefing generated.";
    const structuredContent = parseBriefingSections(briefingText);

    // 2. Fetch Knowledge Highlights (Recent Graph Changes)
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentNodes, error: nodeErr } = await supabaseAdmin
        .from("kg_nodes")
        .select("id, label")
        .eq("org_id", orgId)
        .gt("updated_at", yesterday)
        .limit(5);

      if (!nodeErr && recentNodes && recentNodes.length > 0) {
        const highlights: string[] = [];
        for (const node of recentNodes) {
          const { nodes: neighbors, edges } = await getNeighbors(ctx, node.id);
          
          // Filter for edges added/updated in the last 24h
          const newEdges = edges.filter(e => e.updated_at && e.updated_at > yesterday);
          
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
    }

    // 3. Store the generated briefing
    const { error } = await supabaseAdmin.from("briefings").insert({
      user_id: userId,
      org_id: orgId,
      automation_id: automationId ?? null,
      content: structuredContent,
      summary: briefingText.slice(0, 160),
      delivery_method: deliveryMethod,
      calendar_items: structuredContent.calendar ? 1 : 0,
      email_items: structuredContent.emails ? 1 : 0,
      doc_items: structuredContent.docs ? 1 : 0,
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
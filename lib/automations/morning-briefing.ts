import { supabaseAdmin } from "@/lib/supabase/server";
import { reportAgent } from "@/lib/agents/report-agent";

/**
 * This is the prompt we send to the existing report agent.
 * The report agent will use this to generate the user's morning briefing.
 */
const MORNING_BRIEFING_PROMPT =
  "Summarize today's calendar, top 3 unread emails, and recent document updates.";

/**
 * Generates a morning briefing for one user.
 *
 * Flow:
 * 1. Call the existing reportAgent
 * 2. Get the generated report/briefing text
 * 3. Save it into the `briefings` table
 */
export async function generateMorningBriefing(
  userId: string,
  orgId: string,
  automationId?: string,
  deliveryMethod = "in_app"
) {
  try {
    /**
     * The reportAgent expects an Athene state object.
     * We are passing the minimum fields it needs:
     * - orgId
     * - userId
     * - role
     * - messages
     *
     * `as any` is used because we are creating a lightweight state only for automation.
     */
    const result = await reportAgent(
      {
        orgId,
        userId,
        role: "member",
        messages: [
          {
            content: MORNING_BRIEFING_PROMPT,
          },
        ],
      } as any,
      {}
    );

    /**
     * reportAgent returns final_answer.
     * If for some reason it is missing, we use fallback text.
     */
    const briefingText = result.final_answer || "No briefing generated.";

    /**
     * Store the generated briefing in Supabase.
     * `content` is jsonb — wrap the text in a structured object.
     * `created_at` is omitted: the DB column defaults to now().
     */
    const { error } = await supabaseAdmin.from("briefings").insert({
      user_id: userId,
      org_id: orgId,
      automation_id: automationId ?? null,
      content: { text: briefingText },
      summary: briefingText.slice(0, 160),
      delivery_method: deliveryMethod,
    });

    if (error) {
      throw error;
    }

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
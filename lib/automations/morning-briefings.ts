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
export async function generateMorningBriefing(userId: string) {
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
        orgId: "default",
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
    const briefingContent = result.final_answer || "No briefing generated.";

    /**
     * Store the generated briefing in Supabase.
     * This assumes there is a table called `briefings`.
     */
    const { error } = await supabaseAdmin.from("briefings").insert({
      user_id: userId,
      content: briefingContent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      userId,
      briefing: briefingContent,
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
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { model } from "../langgraph/llm-factory";

// Define the schema for the calendar event draft
export const calendarEventSchema = z.object({
  summary: z.string().describe("The title of the meeting"),
  start: z.object({
    dateTime: z.string().describe("ISO 8601 start time"),
    timeZone: z.string().describe("The user's timezone"),
  }),
  end: z.object({
    dateTime: z.string().describe("ISO 8601 end time"),
    timeZone: z.string().describe("The user's timezone"),
  }),
  attendees: z.array(z.object({ email: z.string() })).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export type CalendarEventDraft = z.infer<typeof calendarEventSchema>;

/**
 * Calendar Agent Node
 * Extracts event details from natural language and prepares a draft.
 */
export async function calendarAgent(state: any) {
  // 1. Load the prompt from the markdown file
  const promptPath = path.join(__dirname, "prompts", "calendar-draft.md");
  const promptTemplate = fs.readFileSync(promptPath, "utf-8");

  // 2. Set the current context (Date and Timezone)
  const now = new Date();
  const userTimezone = state.user?.timezone || "UTC";
  
  const dateContext = `
Current System Time: ${now.toISOString()}
User Local Time: ${now.toLocaleString("en-US", { timeZone: userTimezone })}
User Timezone: ${userTimezone}
`;
  
  const systemPrompt = promptTemplate.replace("{dateContext}", dateContext);

  // 3. Draft the event using Structured Output
  const draftModel = model.withStructuredOutput(calendarEventSchema, {
    name: "draft_calendar_event",
  });

  try {
    const draft = await draftModel.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);

    // 4. Return the state update (Gated by HITL interrupt)
    return {
      awaiting_approval: true,
      pending_action: {
        type: 'calendar-create',
        payload: draft,
      },
    };
  } catch (error: any) {
    console.error("DEBUG: OpenAI Error Details:", error.response?.data || error.message || error);
    return {
      error: "Could not parse calendar event details.",
    };
  }
}

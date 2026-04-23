import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getModel } from "../langgraph/llm-factory";
import { AtheneStateType } from "../langgraph/state";
import { AIMessage } from "@langchain/core/messages";

// 1. Move prompt reading to module scope for performance
const promptPath = path.join(process.cwd(), "lib", "agents", "prompts", "calendar-draft.md");
const promptTemplate = fs.readFileSync(promptPath, "utf-8");

// 2. Define a more robust schema for the calendar event draft
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
  attendees: z.array(z.object({ 
    email: z.string().optional(),
    displayName: z.string().optional().describe("Full name of the attendee")
  })).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export type CalendarEventDraft = z.infer<typeof calendarEventSchema>;

/**
 * Calendar Agent Node
 * Extracts event details from natural language and prepares a draft.
 */
export async function calendarAgent(state: AtheneStateType) {
  // 3. Set the current context (Date and Timezone)
  const now = new Date();
  const userTimezone = state.timezone || "UTC";
  
  const dateContext = `
Current System Time: ${now.toISOString()}
User Local Time: ${now.toLocaleString("en-US", { timeZone: userTimezone })}
User Timezone: ${userTimezone}
`;
  
  const systemPrompt = promptTemplate.replace("{dateContext}", dateContext);

  // 4. Draft the event using Structured Output
  const draftModel = getModel().withStructuredOutput(calendarEventSchema, {
    name: "draft_calendar_event",
  });

  try {
    const draft = await draftModel.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);

    // 5. Return the state update with standardized fields
    return {
      awaiting_approval: true,
      pending_action: {
        type: 'calendar-create',
        payload: draft,
      },
    };
  } catch (error: any) {
    console.error("Calendar Agent Error:", error.message || error);
    
    // 6. Return a polite error message in the chat instead of crashing
    return {
      messages: [new AIMessage({ 
        content: "I'm sorry, I couldn't quite capture the meeting details. Could you please provide the time and date again?" 
      })],
    };
  }
}

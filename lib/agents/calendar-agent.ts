import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { getModel } from "../langgraph/llm-factory";
import { AtheneStateType } from "../langgraph/state";
import { AIMessage } from "@langchain/core/messages";

// 1. Move prompt reading to module scope for performance
const promptPath = path.join(process.cwd(), "lib", "agents", "prompts", "calendar-draft.md");
const promptTemplate = fs.readFileSync(promptPath, "utf-8");

// 2. Define the "Strategic" schema to handle complex test cases
export const calendarEventSchema = z.object({
  action_type: z.enum(["create", "update", "delete", "search"]).default("create"),
  is_search: z.boolean().default(false).describe("True if the user is looking for a free slot rather than a specific time"),
  summary: z.string().describe("The title of the meeting"),
  start: z.object({
    dateTime: z.string().describe("ISO 8601 start time"),
    timeZone: z.string().describe("The user's timezone"),
  }).optional(),
  end: z.object({
    dateTime: z.string().describe("ISO 8601 end time"),
    timeZone: z.string().describe("The user's timezone"),
  }).optional(),
  search_range: z.object({
    startAfter: z.string().describe("ISO 8601 earliest possible time"),
    endBefore: z.string().describe("ISO 8601 latest possible time"),
  }).optional(),
  recurrence: z.string().optional().describe("Recurrence rule (e.g. WEEKLY;BYDAY=MO)"),
  constraints: z.array(z.string()).optional().describe("User constraints (e.g. ['avoid Wednesdays', 'virtual only'])"),
  attendees: z.array(z.object({ 
    email: z.string().optional(),
    displayName: z.string().optional()
  }).refine(data => data.email || data.displayName, {
    message: "At least one of email or displayName must be provided"
  })).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  cancellation_note: z.string().optional().describe("Note if this draft replaces another event"),
});

export type CalendarEventDraft = z.infer<typeof calendarEventSchema>;

/**
 * Calendar Agent Node
 * Now upgraded to handle complex strategic scheduling and search requests.
 */
export async function calendarAgent(state: AtheneStateType) {
  const now = new Date();
  const userTimezone = state.timezone || "UTC";
  
  const dateContext = `
Current System Time: ${now.toISOString()}
User Local Time: ${now.toLocaleString("en-US", { timeZone: userTimezone })}
User Timezone: ${userTimezone}
`;
  
  // Inject context and timezone into the prompt
  const systemPrompt = promptTemplate
    .replace("{dateContext}", dateContext)
    .replace("{timezone}", userTimezone);

  const draftModel = getModel().withStructuredOutput(calendarEventSchema, {
    name: "draft_calendar_event",
  });

  try {
    const draft = await draftModel.invoke([
      { role: "system", content: systemPrompt },
      ...state.messages,
    ]);

    return {
      awaiting_approval: true,
      pending_action: {
        type: draft.is_search ? 'calendar-search' : 'calendar-create',
        payload: draft,
      },
    };
  } catch (error: any) {
    console.error("Calendar Agent Error:", error.message || error);
    
    return {
      messages: [new AIMessage({ 
        content: "I'm sorry, I couldn't quite process that calendar request. Could you please provide more details about the date, time, or people involved?" 
      })],
    };
  }
}

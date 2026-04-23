import { calendarAgent } from "../calendar-agent";
import { HumanMessage } from "@langchain/core/messages";

describe("Calendar Agent", () => {
  it("should correctly draft a meeting for tomorrow", async () => {
    const state = {
      messages: [new HumanMessage("meeting with Alice tomorrow 2pm for 1h")],
    };

    const result = await calendarAgent(state);

    expect(result.awaiting_approval).toBe(true);
    expect(result.pending_action.type).toBe("calendar-create");
    
    const payload = result.pending_action.payload;
    expect(payload.summary).toMatch(/meeting/i);
    expect(payload.summary).toMatch(/Alice/i);
    
    // Verify start time is set (it should be an ISO string)
    expect(payload.start.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should handle 30-min chats", async () => {
    const state = {
      messages: [new HumanMessage("30-min chat with Priya next Tuesday 3pm")],
    };

    const result = await calendarAgent(state);
    const payload = result.pending_action.payload;
    
    expect(payload.summary).toMatch(/Priya/i);
    
    // Verify duration is roughly 1 hour (default is 30 in our prompt, 
    // but the user specified 30-min so let's see if the LLM respects it)
    const start = new Date(payload.start.dateTime);
    const end = new Date(payload.end.dateTime);
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    expect(diffMinutes).toBe(30);
  });
});

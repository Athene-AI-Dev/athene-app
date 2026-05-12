import { describe, it, expect } from "vitest";
import {
  formatSSEEvent,
  tokenEvent,
  toolStartEvent,
  toolEndEvent,
  interruptEvent,
  errorEvent,
  doneEvent,
  stateEvent,
} from "@/lib/api/sse";

describe("SSE utilities", () => {
  it("formatSSEEvent produces correct framing", () => {
    const raw = formatSSEEvent("token", { token: "hello" });
    expect(raw).toBe('event: token\ndata: {"token":"hello"}\n\n');
  });

  it("tokenEvent wraps a plain string token", () => {
    const ev = tokenEvent("world");
    expect(ev).toContain("event: token");
    expect(ev).toContain('"token":"world"');
    expect(ev.endsWith("\n\n")).toBe(true);
  });

  it("toolStartEvent includes tool name and input", () => {
    const ev = toolStartEvent("retrieval", { query: "weather" });
    expect(ev).toContain("event: tool_start");
    expect(ev).toContain('"tool":"retrieval"');
    expect(ev).toContain('"input":{"query":"weather"}');
  });

  it("toolEndEvent includes tool name and output", () => {
    const ev = toolEndEvent("retrieval", { chunks: [] });
    expect(ev).toContain("event: tool_end");
    expect(ev).toContain('"tool":"retrieval"');
    expect(ev).toContain('"output":{"chunks":[]}');
  });

  it("interruptEvent surfaces pending write action", () => {
    const payload = {
      tool: "email-send",
      payload: { to: "a@b.com" },
      requested_at: "2026-04-29T00:00:00Z",
    };
    const ev = interruptEvent(payload);
    expect(ev).toContain("event: interrupt");
    expect(ev).toContain('"tool":"email-send"');
  });

  it("stateEvent emits run status fields", () => {
    const ev = stateEvent({
      status: "completed",
      final_answer: "Done",
      cited_sources: [],
      awaiting_approval: false,
    });
    expect(ev).toContain("event: state");
    expect(ev).toContain('"status":"completed"');
    expect(ev).toContain('"final_answer":"Done"');
  });

  it("errorEvent wraps a message", () => {
    const ev = errorEvent("something broke");
    expect(ev).toContain("event: error");
    expect(ev).toContain('"message":"something broke"');
  });

  it("doneEvent signals stream completion", () => {
    const ev = doneEvent();
    expect(ev).toContain("event: done");
    expect(ev).toContain('"ok":true');
  });
});

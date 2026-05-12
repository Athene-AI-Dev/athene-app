/**
 * SSE (Server-Sent Events) formatting utilities.
 * Each helper returns a properly formatted SSE message string
 * terminated by a double newline as required by the protocol.
 */

export interface SSEEvent {
  event: string;
  data: unknown;
}

/** Encode a string to Uint8Array via TextEncoder (browser/Node compatible). */
const encoder = new TextEncoder();

/** Format a single SSE event: `event: <type>\ndata: <json>\n\n` */
export function formatSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Encode an SSE event string into a Uint8Array for stream writing. */
export function encodeSSEEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(formatSSEEvent(event, data));
}

// ---- Typed event helpers ----

export function tokenEvent(token: string) {
  return formatSSEEvent("token", { token });
}

export function toolStartEvent(tool: string, input: Record<string, unknown>) {
  return formatSSEEvent("tool_start", { tool, input });
}

export function toolEndEvent(tool: string, output: unknown) {
  return formatSSEEvent("tool_end", { tool, output });
}

export function interruptEvent(payload: {
  tool: string;
  payload: Record<string, unknown>;
  requested_at: string;
}) {
  return formatSSEEvent("interrupt", payload);
}

export function stateEvent(data: {
  status: string;
  final_answer: unknown;
  cited_sources: unknown[];
  awaiting_approval: boolean;
}) {
  return formatSSEEvent("state", data);
}

export function errorEvent(message: string) {
  return formatSSEEvent("error", { message });
}

export function doneEvent() {
  return formatSSEEvent("done", { ok: true });
}

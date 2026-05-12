import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReadableStream } from "stream/web";

// ─── Mocks ────────────────────────────────────

const mockAuth = vi.fn();
const mockGetAgentGraph = vi.fn();
const mockGetState = vi.fn();
const mockStreamEvents = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

vi.mock("@/lib/langgraph/graph", () => ({
  getAgentGraph: (...args: any[]) => mockGetAgentGraph(...args),
}));

vi.mock("@/lib/auth/clerk", () => ({
  mapRole: (role: string) => (role === "org:admin" ? "admin" : "member"),
}));

// ─── Helpers ────────────────────────────────────

/** Collect all SSE events from a ReadableStream */
async function collectSSEEvents(
  stream: ReadableStream<Uint8Array>
): Promise<{ events: string[]; raw: string }> {
  const reader = stream.getReader();
  let raw = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  const events = raw
    .split("\n\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return { events, raw };
}

/** Parse a single SSE event string into { event, data } */
function parseSSEEvent(block: string): { event: string; data: unknown } {
  const lines = block.split("\n");
  const eventLine = lines.find((l) => l.startsWith("event:"));
  const dataLine = lines.find((l) => l.startsWith("data:"));
  return {
    event: eventLine?.replace("event:", "").trim() ?? "",
    data: dataLine ? JSON.parse(dataLine.replace("data:", "").trim()) : null,
  };
}

// ─── Tests ─────────────────────────────────────

describe("POST /api/agent/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createPOSTRequest(body: unknown) {
    return new Request("http://localhost/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any;
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null, orgId: null });
    const { POST } = await import("@/app/api/agent/stream/route");
    const res = await POST(createPOSTRequest({ query: "hello" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when query is missing", async () => {
    mockAuth.mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org-1",
      orgRole: null,
    });
    const { POST } = await import("@/app/api/agent/stream/route");
    const res = await POST(createPOSTRequest({}));
    expect(res.status).toBe(400);
  });

  it("streams token events from LangGraph streamEvents", async () => {
    mockAuth.mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org-1",
      orgRole: null,
    });

    async function* mockEventGenerator() {
      yield {
        event: "on_chat_model_stream",
        name: "chat-model",
        data: { chunk: { content: "Hello " } },
      };
      yield {
        event: "on_chat_model_stream",
        name: "chat-model",
        data: { chunk: { content: "world!" } },
      };
      yield { event: "on_tool_start", name: "retrieval", data: { input: { query: "x" } } };
      yield { event: "on_tool_end", name: "retrieval", data: { output: "found 3 docs" } };
    }

    mockGetAgentGraph.mockResolvedValueOnce({
      streamEvents: vi.fn().mockReturnValue(mockEventGenerator()),
      getState: vi.fn().mockResolvedValue({
        values: {
          run_status: "completed",
          final_answer: "Hello world!",
          cited_sources: [],
          awaiting_approval: false,
        },
      }),
    });

    const { POST } = await import("@/app/api/agent/stream/route");
    const res = await POST(createPOSTRequest({ query: "Hello world" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    const { events } = await collectSSEEvents(res.body as ReadableStream<Uint8Array>);
    const parsed = events.map(parseSSEEvent);

    expect(parsed.find((e) => e.event === "token")).toBeTruthy();
    expect(parsed.find((e) => e.event === "tool_start")).toBeTruthy();
    expect(parsed.find((e) => e.event === "tool_end")).toBeTruthy();
    expect(parsed.find((e) => e.event === "state")).toBeTruthy();
    expect(parsed.find((e) => e.event === "done")).toBeTruthy();
  });

  it("emits interrupt event when awaiting_approval is set", async () => {
    mockAuth.mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org-1",
      orgRole: null,
    });

    async function* mockEventGenerator() {
      yield {
        event: "on_chat_model_stream",
        name: "chat-model",
        data: { chunk: { content: "Drafting email..." } },
      };
    }

    mockGetAgentGraph.mockResolvedValueOnce({
      streamEvents: vi.fn().mockReturnValue(mockEventGenerator()),
      getState: vi.fn().mockResolvedValue({
        values: {
          awaiting_approval: true,
          pending_write_action: {
            tool: "email-send",
            payload: { to: "a@b.com", body: "Hi" },
            requested_at: "2026-04-29T00:00:00Z",
          },
        },
      }),
    });

    const { POST } = await import("@/app/api/agent/stream/route");
    const res = await POST(createPOSTRequest({ query: "send email" }));
    const { events } = await collectSSEEvents(res.body as ReadableStream<Uint8Array>);
    const parsed = events.map(parseSSEEvent);

    const interruptEv = parsed.find((e) => e.event === "interrupt");
    expect(interruptEv).toBeTruthy();
    expect((interruptEv!.data as any).tool).toBe("email-send");
  });

  it("emits error event and closes stream on failure", async () => {
    mockAuth.mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org-1",
      orgRole: null,
    });

    mockGetAgentGraph.mockRejectedValueOnce(new Error("Graph init failed"));

    const { POST } = await import("@/app/api/agent/stream/route");
    const res = await POST(createPOSTRequest({ query: "hello" }));
    expect(res.status).toBe(500);
  });
});

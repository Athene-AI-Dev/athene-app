// ============================================================
// lib/async-bridge/__tests__/bridge.test.ts — ATH-42 Tests
//
// Validates:
//   1. Happy path: suspend → queue → resume → graph continues
//   2. Timeout path: suspended job result is polled correctly
//   3. Retry path: duplicate suspend returns existing marker
//   4. Poison message: failed tool → graph resumes with error
//   5. Edge cases: expired lock, missing suspension, etc.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock external dependencies BEFORE imports ----------------

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();

vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

// Mock QStash client
const mockPublishJSON = vi.fn();

vi.mock("@/lib/qstash/client", () => ({
  qstash: {
    publishJSON: (...args: unknown[]) => mockPublishJSON(...args),
  },
}));

// Mock the LangGraph graph
const mockGraphInvoke = vi.fn();

vi.mock("@/lib/langgraph/graph", () => ({
  getAgentGraph: vi.fn().mockResolvedValue({
    invoke: (...args: unknown[]) => mockGraphInvoke(...args),
  }),
}));

// ---- Now safe to import ------------------------------------

import { suspendAndQueue, isSuspended } from "../suspend";
import { resumeGraph, getAsyncResult } from "../resume";
import { generateRunId } from "../index";

// ---- Helpers ------------------------------------------------

function makeSuspendRequest(overrides: Record<string, unknown> = {}) {
  return {
    threadId: "thread-test-001",
    runId: "run-abc-123",
    tool: "big-doc-fetch",
    args: { documentId: "doc-42", format: "pdf" },
    orgId: "org-athene-prod",
    ...overrides,
  };
}

// ---- Tests --------------------------------------------------

describe("suspendAndQueue (ATH-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing lock (fresh suspension)
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockPublishJSON.mockResolvedValue({ messageId: "qstash-msg-xyz" });
  });

  it("publishes a QStash job and returns a SuspendedMarker", async () => {
    const marker = await suspendAndQueue(makeSuspendRequest());

    // Verify the marker shape
    expect(marker.suspended).toBe(true);
    expect(marker.qstashMessageId).toBe("qstash-msg-xyz");
    expect(marker.tool).toBe("big-doc-fetch");
    expect(marker.queuedAt).toBeTruthy();

    // Verify QStash was called with correct payload
    expect(mockPublishJSON).toHaveBeenCalledOnce();
    const publishCall = mockPublishJSON.mock.calls[0][0];
    expect(publishCall.url).toContain("/api/worker/async-tool");
    expect(publishCall.body.threadId).toBe("thread-test-001");
    expect(publishCall.body.runId).toBe("run-abc-123");
    expect(publishCall.body.tool).toBe("big-doc-fetch");
    expect(publishCall.body.attempt).toBe(1);
    expect(publishCall.body.maxAttempts).toBe(3);
    expect(publishCall.retries).toBe(2); // MAX_ATTEMPTS - 1

    // Verify Redis lock + state were set
    expect(mockRedisSet).toHaveBeenCalledTimes(2);
  });

  it("returns existing marker on duplicate suspend (idempotent)", async () => {
    const existingMarker = JSON.stringify({
      suspended: true,
      qstashMessageId: "qstash-msg-existing",
      queuedAt: "2026-04-29T00:00:00.000Z",
      tool: "big-doc-fetch",
    });
    mockRedisGet.mockResolvedValue(existingMarker);

    const marker = await suspendAndQueue(makeSuspendRequest());

    // Should return the cached marker
    expect(marker.qstashMessageId).toBe("qstash-msg-existing");

    // Should NOT publish a new job
    expect(mockPublishJSON).not.toHaveBeenCalled();
    // Should NOT write new Redis keys
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("propagates QStash publish errors to the caller", async () => {
    mockPublishJSON.mockRejectedValue(new Error("QStash unavailable"));

    await expect(suspendAndQueue(makeSuspendRequest())).rejects.toThrow(
      "QStash unavailable"
    );
  });
});

describe("isSuspended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a suspension lock exists", async () => {
    mockRedisGet.mockResolvedValue("some-lock-data");
    const result = await isSuspended("thread-1", "run-1");
    expect(result).toBe(true);
  });

  it("returns false when no suspension lock exists", async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await isSuspended("thread-1", "run-1");
    expect(result).toBe(false);
  });
});

describe("resumeGraph (ATH-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: suspension exists
    mockRedisGet.mockResolvedValue("lock-data");
    mockRedisSet.mockResolvedValue("OK");
    mockRedisDel.mockResolvedValue(1);
    mockGraphInvoke.mockResolvedValue({
      run_status: "completed",
      final_answer: "The document contains quarterly revenue data.",
    });
  });

  it("resumes the graph with tool result on success (happy path)", async () => {
    const result = await resumeGraph({
      threadId: "thread-test-001",
      runId: "run-abc-123",
      toolResult: { data: "fetched content here" },
      success: true,
    });

    expect(result.resumed).toBe(true);
    expect(result.state).toBeDefined();

    // Verify the graph was invoked with the tool result
    expect(mockGraphInvoke).toHaveBeenCalledOnce();
    const [resumeState, config] = mockGraphInvoke.mock.calls[0];
    expect(resumeState.action_result).toEqual({ data: "fetched content here" });
    expect(resumeState.action_error).toBeNull();
    expect(resumeState.run_status).toBe("running");
    expect(config.configurable.thread_id).toBe("thread-test-001");

    // Verify cleanup: lock and state keys deleted
    expect(mockRedisDel).toHaveBeenCalledTimes(2);

    // Verify result was written to Redis for polling
    expect(mockRedisSet).toHaveBeenCalled();
  });

  it("resumes the graph with error state on tool failure (poison message)", async () => {
    mockGraphInvoke.mockResolvedValue({
      run_status: "completed",
      final_answer: "Sorry, I couldn't fetch that document.",
    });

    const result = await resumeGraph({
      threadId: "thread-test-001",
      runId: "run-abc-123",
      toolResult: null,
      success: false,
      error: "Document fetch timed out after 3 attempts",
    });

    expect(result.resumed).toBe(true);

    // Verify the graph received error state
    const [resumeState] = mockGraphInvoke.mock.calls[0];
    expect(resumeState.action_result).toBeNull();
    expect(resumeState.action_error).toBe(
      "Document fetch timed out after 3 attempts"
    );
  });

  it("returns error when no suspension is found (expired or already resumed)", async () => {
    mockRedisGet.mockResolvedValue(null); // No lock found

    const result = await resumeGraph({
      threadId: "thread-test-001",
      runId: "run-abc-123",
      toolResult: { data: "late result" },
      success: true,
    });

    expect(result.resumed).toBe(false);
    expect(result.error).toContain("No active suspension found");

    // Graph should NOT be invoked
    expect(mockGraphInvoke).not.toHaveBeenCalled();
  });

  it("handles graph resume failure gracefully", async () => {
    mockGraphInvoke.mockRejectedValue(
      new Error("Checkpointer connection failed")
    );

    const result = await resumeGraph({
      threadId: "thread-test-001",
      runId: "run-abc-123",
      toolResult: { data: "content" },
      success: true,
    });

    expect(result.resumed).toBe(false);
    expect(result.error).toContain("Checkpointer connection failed");

    // Result in Redis should be updated with the resume error
    const lastSetCall = mockRedisSet.mock.calls.at(-1);
    const storedResult = JSON.parse(lastSetCall?.[1] as string);
    expect(storedResult.resumeError).toContain("Checkpointer connection failed");
  });
});

describe("getAsyncResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed result when it exists in Redis", async () => {
    const stored = JSON.stringify({
      threadId: "t1",
      runId: "r1",
      success: true,
      toolResult: { data: "hello" },
      completedAt: "2026-04-29T01:00:00.000Z",
    });
    mockRedisGet.mockResolvedValue(stored);

    const result = await getAsyncResult("t1", "r1");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect((result!.toolResult as Record<string, unknown>).data).toBe("hello");
  });

  it("returns null when no result exists", async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getAsyncResult("t1", "r1");
    expect(result).toBeNull();
  });
});

describe("generateRunId", () => {
  it("returns a non-empty string", () => {
    const id = generateRunId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRunId()));
    expect(ids.size).toBe(100);
  });
});

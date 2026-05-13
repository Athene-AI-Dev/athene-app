// ============================================================
// lib/async-bridge/suspend.ts — Graph suspension (ATH-42)
//
// Saves the current LangGraph state checkpoint and publishes a
// QStash job to continue the work asynchronously. The serverless
// function can then safely return a "suspended" marker before
// Vercel's 60-second timeout.
//
// Flow: Agent node → suspendAndQueue() → checkpoint saved →
//       QStash job published → return SuspendedMarker to graph
// ============================================================

import { qstash } from "@/lib/qstash/client";
import { redis } from "@/lib/redis/client";
import { getServerBaseUrl } from "@/lib/url/server-base-url";

// ---- Types --------------------------------------------------

export interface SuspendRequest {
  /** The LangGraph thread being processed */
  threadId: string;
  /** Unique run ID for idempotency tracking */
  runId: string;
  /** Tool name that needs async execution */
  tool: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
  /** The org that owns this thread */
  orgId: string;
}

export interface SuspendedMarker {
  /** Always true — used by the graph router to detect suspension */
  suspended: true;
  /** QStash message ID for observability */
  qstashMessageId: string;
  /** ISO timestamp of when the job was queued */
  queuedAt: string;
  /** Tool that will be executed asynchronously */
  tool: string;
}

/** Shape of the QStash job payload sent to the worker */
export interface AsyncJobPayload {
  threadId: string;
  runId: string;
  tool: string;
  args: Record<string, unknown>;
  orgId: string;
  attempt: number;
  maxAttempts: number;
  suspendedAt: string;
}

// ---- Constants ----------------------------------------------

/** Max retry attempts for the async job (QStash-level retries) */
const MAX_ATTEMPTS = 3;

/** TTL for the suspension lock in Redis (prevents duplicate jobs) */
const SUSPEND_LOCK_TTL_SECONDS = 600; // 10 minutes

/** Base URL for the async worker endpoint */
function getWorkerUrl(): string {
  return `${getServerBaseUrl()}/api/worker/async-tool`;
}

// ---- Core ---------------------------------------------------

/**
 * Suspends the current graph execution and queues an async QStash
 * job to complete the tool call.
 *
 * The graph's checkpoint is already persisted by the PostgresSaver
 * checkpointer automatically after each node runs — we don't need
 * to manually save it. We just need to:
 *   1. Record the suspension in Redis (for status polling + dedup)
 *   2. Publish the QStash job
 *   3. Return a marker so the graph knows to halt
 *
 * @throws Error if QStash publish fails (caller should catch and
 *         fall back to synchronous execution if possible)
 */
export async function suspendAndQueue(
  request: SuspendRequest
): Promise<SuspendedMarker> {
  const { threadId, runId, tool, args, orgId } = request;
  const now = new Date().toISOString();

  // ── 1. Deduplication lock ─────────────────────────────────
  // Prevents the same run from being suspended twice if a node
  // retries or the request is replayed.
  const lockKey = `async_bridge:lock:${threadId}:${runId}`;
  const existingLock = await redis.get<string>(lockKey);

  if (existingLock) {
    // Already suspended — return the existing marker
    const existing = JSON.parse(existingLock) as SuspendedMarker;
    console.warn(
      `[async-bridge] Duplicate suspend for ${threadId}/${runId}, returning existing marker`
    );
    return existing;
  }

  // ── 2. Build job payload ──────────────────────────────────
  const payload: AsyncJobPayload = {
    threadId,
    runId,
    tool,
    args,
    orgId,
    attempt: 1,
    maxAttempts: MAX_ATTEMPTS,
    suspendedAt: now,
  };

  // ── 3. Publish to QStash ──────────────────────────────────
  // QStash handles its own retries on delivery failure.
  // We configure exponential backoff via the retries header.
  const response = await qstash.publishJSON({
    url: getWorkerUrl(),
    body: payload,
    retries: MAX_ATTEMPTS - 1, // QStash retries = attempts - 1
  });

  // ── 4. Record suspension state in Redis ───────────────────
  const marker: SuspendedMarker = {
    suspended: true,
    qstashMessageId: response.messageId,
    queuedAt: now,
    tool,
  };

  // Store the job metadata for status polling and resume lookup
  const stateKey = `async_bridge:state:${threadId}:${runId}`;
  await Promise.all([
    redis.set(lockKey, JSON.stringify(marker), {
      ex: SUSPEND_LOCK_TTL_SECONDS,
    }),
    redis.set(
      stateKey,
      JSON.stringify({
        ...payload,
        status: "pending",
        qstashMessageId: response.messageId,
      }),
      { ex: SUSPEND_LOCK_TTL_SECONDS }
    ),
  ]);

  console.info(
    `[async-bridge] Suspended thread=${threadId} run=${runId} tool=${tool} qstash=${response.messageId}`
  );

  return marker;
}

/**
 * Check whether a given run is currently suspended.
 * Used by the graph to decide whether to halt or continue.
 */
export async function isSuspended(
  threadId: string,
  runId: string
): Promise<boolean> {
  const lockKey = `async_bridge:lock:${threadId}:${runId}`;
  const value = await redis.get(lockKey);
  return value !== null;
}

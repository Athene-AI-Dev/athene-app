// ============================================================
// lib/async-bridge/resume.ts — Graph resumption (ATH-42)
//
// Called by the async worker (ATH-44) after it finishes the tool
// call. Writes the tool result to Redis, cleans up the suspension
// lock, and resumes the LangGraph thread from its checkpoint.
//
// Flow: Worker completes → resumeGraph() → result written to
//       Redis → graph.invoke(resume) → graph continues
// ============================================================

import { redis } from "@/lib/redis/client";
import { getAgentGraph } from "@/lib/langgraph/graph";
import { logger } from "@/lib/logger";

// ---- Types --------------------------------------------------

export interface ResumeRequest {
  /** The suspended thread to resume */
  threadId: string;
  /** Run ID that was suspended */
  runId: string;
  /** The result from the async tool execution */
  toolResult: unknown;
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Error message if the tool failed */
  error?: string;
}

export interface ResumeResult {
  /** Whether the graph was successfully resumed */
  resumed: boolean;
  /** Final state after graph resumed (if successful) */
  state?: Record<string, unknown>;
  /** Error details if resume failed */
  error?: string;
}

// ---- Constants ----------------------------------------------

/** TTL for the tool result in Redis (allows polling before resume) */
const RESULT_TTL_SECONDS = 300; // 5 minutes

// ---- Core ---------------------------------------------------

/**
 * Resumes a suspended LangGraph thread with the async tool result.
 *
 * Steps:
 *   1. Verify the thread is actually suspended
 *   2. Write the tool result to Redis (for observability/polling)
 *   3. Clean up the suspension lock
 *   4. Resume the LangGraph thread from its Postgres checkpoint
 *
 * If the tool failed after all retries (poison message), the graph
 * is resumed with an error state so the supervisor can handle it
 * gracefully (e.g. return "Sorry, I couldn't complete that action").
 */
export async function resumeGraph(
  request: ResumeRequest
): Promise<ResumeResult> {
  const { threadId, runId, toolResult, success, error } = request;

  // ── 1. Verify suspension exists ───────────────────────────
  const lockKey = `async_bridge:lock:${threadId}:${runId}`;
  const stateKey = `async_bridge:state:${threadId}:${runId}`;
  const resultKey = `async_bridge:result:${threadId}:${runId}`;

  const lockValue = await redis.get(lockKey);
  if (!lockValue) {
    logger.warn({ threadId, runId }, '[async-bridge] No suspension found — may have already been resumed or expired');
    return {
      resumed: false,
      error: "No active suspension found. It may have already been resumed or expired.",
    };
  }

  // ── 2. Write result to Redis ──────────────────────────────
  // This allows the frontend to poll for results before the
  // graph fully finishes processing.
  const resultPayload = {
    threadId,
    runId,
    success,
    toolResult: success ? toolResult : null,
    error: error ?? null,
    completedAt: new Date().toISOString(),
  };

  await redis.set(resultKey, JSON.stringify(resultPayload), {
    ex: RESULT_TTL_SECONDS,
  });

  // ── 3. Clean up suspension state ──────────────────────────
  await Promise.all([redis.del(lockKey), redis.del(stateKey)]);

  // ── 4. Resume the LangGraph thread ────────────────────────
  // The graph was compiled with a PostgresSaver checkpointer,
  // so calling invoke with the same thread_id resumes from the
  // last checkpoint. We pass the tool result as a state update.
  try {
    const graph = await getAgentGraph();

    const resumeState = success
      ? {
          action_result: toolResult,
          action_error: null,
          run_status: "running",
        }
      : {
          action_result: null,
          action_error: error ?? "Async tool execution failed",
          run_status: "running",
        };

    const finalState = await graph.invoke(resumeState, {
      configurable: { thread_id: threadId },
    });

    logger.info({ threadId, runId, success }, '[async-bridge] Resumed');

    return {
      resumed: true,
      state: finalState,
    };
  } catch (resumeErr) {
    const message =
      resumeErr instanceof Error ? resumeErr.message : String(resumeErr);

    logger.error({ threadId, runId, err: message }, '[async-bridge] Failed to resume thread');

    // Update the result in Redis to reflect the resume failure
    await redis.set(
      resultKey,
      JSON.stringify({
        ...resultPayload,
        resumeError: message,
      }),
      { ex: RESULT_TTL_SECONDS }
    );

    return {
      resumed: false,
      error: `Graph resume failed: ${message}`,
    };
  }
}

/**
 * Check the result of an async tool execution.
 * Used by the frontend to poll for completion status.
 */
export async function getAsyncResult(
  threadId: string,
  runId: string
): Promise<Record<string, unknown> | null> {
  const resultKey = `async_bridge:result:${threadId}:${runId}`;
  const raw = await redis.get<string>(resultKey);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

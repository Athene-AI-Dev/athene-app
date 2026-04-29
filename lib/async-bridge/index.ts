// ============================================================
// lib/async-bridge/index.ts — Public API barrel (ATH-42)
//
// Single import point for the async tool bridge. Agents and
// worker routes import from here:
//
//   import { suspendAndQueue, resumeGraph } from "@/lib/async-bridge"
//
// This module also exports the status helpers so the frontend
// can poll for completion.
// ============================================================

// ---- Re-exports from suspend --------------------------------
export {
  suspendAndQueue,
  isSuspended,
  type SuspendRequest,
  type SuspendedMarker,
  type AsyncJobPayload,
} from "./suspend";

// ---- Re-exports from resume ---------------------------------
export {
  resumeGraph,
  getAsyncResult,
  type ResumeRequest,
  type ResumeResult,
} from "./resume";

// ---- Constants shared across the bridge ---------------------

/** Redis key prefix for all async bridge keys */
export const ASYNC_BRIDGE_PREFIX = "async_bridge" as const;

/**
 * Generates a unique run ID for a graph invocation.
 * Uses crypto.randomUUID when available, falls back to timestamp + random.
 */
export function generateRunId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

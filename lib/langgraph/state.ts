// ============================================================
// state.ts — AtheneState: the single typed state object that
// flows through every node of the LangGraph multi-agent system.
//
// Design rules:
//   • Identity fields are set ONCE at request start and never
//     mutated by agents. RLS enforcement happens in Postgres;
//     these are here for agent routing logic only.
//   • retrieved_chunks is ephemeral: cleared by synthesis_agent
//     after it consumes them so stale context never leaks into
//     a subsequent turn.
//   • All reducers are last-write-wins except messages, which
//     uses LangGraph's built-in append reducer.
// ============================================================

import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

// ---- Shared scalar types ----------------------------------------

export type UserRole = "member" | "super_user" | "admin";
export type Complexity = "simple" | "medium" | "complex";
export type RunStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "error";

// ---- Domain object types ----------------------------------------

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content_preview: string;
  chunk_index: number;
  source_type: string;
  external_url: string | null;
  department_id: string | null;
  /** Cosine similarity score, 0–1 */
  similarity: number;
}

/** A write action paused at the interrupt_before approval gate. */
export interface PendingWriteAction {
  tool: "email-send" | "calendar-create";
  payload: Record<string, unknown>;
  /** ISO-8601 timestamp when the action was queued */
  requested_at: string;
}

export interface CitedSource {
  document_id: string;
  title: string | null;
  external_url: string | null;
  chunk_index: number;
  source_type: string;
}

// ---- State annotation ------------------------------------------

/** Last-write-wins reducer for scalar fields */
const lw = <T>(_current: T, update: T): T => update;

export const AtheneStateAnnotation = Annotation.Root({
  // --- Identity (set once at invocation, never mutated by agents) ---

  thread_id: Annotation<string>({ reducer: lw, default: () => "" }),
  org_id: Annotation<string>({ reducer: lw, default: () => "" }),
  user_id: Annotation<string>({ reducer: lw, default: () => "" }),
  user_role: Annotation<UserRole>({ reducer: lw, default: () => "member" }),
  user_dept_id: Annotation<string | null>({ reducer: lw, default: () => null }),
  /** Own dept + any granted dept IDs (from access_grants) */
  accessible_dept_ids: Annotation<string[]>({ reducer: lw, default: () => [] }),
  /** Active access_grant row id when user is super_user with grants */
  bi_grant_id: Annotation<string | null>({ reducer: lw, default: () => null }),

  // --- Conversation ---

  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // --- Routing ---

  /** Which agent the supervisor has routed to */
  active_agent: Annotation<string | null>({ reducer: lw, default: () => null }),
  /** Fine-grained task classification used by supervisor */
  task_type: Annotation<string | null>({ reducer: lw, default: () => null }),
  /** Drives model tier selection in llm-factory */
  complexity: Annotation<Complexity>({ reducer: lw, default: () => "simple" }),
  /** True when query spans multiple departments */
  is_cross_dept_query: Annotation<boolean>({
    reducer: lw,
    default: () => false,
  }),

  // --- Retrieved context (ephemeral — cleared after synthesis) ---

  retrieved_chunks: Annotation<RetrievedChunk[]>({
    reducer: lw,
    default: () => [],
  }),

  // --- Run status ---

  run_status: Annotation<RunStatus>({ reducer: lw, default: () => "idle" }),

  // --- HITL ---

  /** True while paused at the interrupt_before approval gate */
  awaiting_approval: Annotation<boolean>({
    reducer: lw,
    default: () => false,
  }),
  /** The serialized write action waiting for human sign-off */
  pending_write_action: Annotation<PendingWriteAction | null>({
    reducer: lw,
    default: () => null,
  }),

  // --- Output ---

  final_answer: Annotation<string | null>({ reducer: lw, default: () => null }),
  cited_sources: Annotation<CitedSource[]>({
    reducer: lw,
    default: () => [],
  }),
});

export type AtheneState = typeof AtheneStateAnnotation.State;
export type AtheneStateUpdate = typeof AtheneStateAnnotation.Update;

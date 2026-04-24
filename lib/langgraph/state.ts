import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * AtheneState represents the flattened graph state.
 * Root-level orgId, userId, and role are required for RLS tool extraction.
 */
export const AtheneState = Annotation.Root({
  ...MessagesAnnotation.spec,
  orgId: Annotation<string>(),
  userId: Annotation<string>(),
  role: Annotation<string>(),
  next: Annotation<string>(),
  retrievedDocs: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Approval gate fields
  awaiting_approval: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => false,
  }),
  pending_write_action: Annotation<any | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  // Run lifecycle
  run_status: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "running",
  }),
  // Final answer / synthesis output
  final_answer: Annotation<any | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  // Citations from synthesis agent
  cited_sources: Annotation<any[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  // Retrieved chunks (raw, before synthesis)
  retrieved_chunks: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Action execution results
  action_result: Annotation<any | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  action_error: Annotation<any | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  // Synthesis mode hints
  task_type: Annotation<string | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  is_cross_dept_query: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => false,
  }),
});

export type AtheneStateType = typeof AtheneState.State;

/** Type alias used by node function signatures */
export type AtheneState = AtheneStateType;

/** Partial return type for node functions */
export type AtheneStateUpdate = Partial<AtheneStateType>;

/** User roles recognized throughout the system */
export type UserRole = "member" | "super_user" | "admin";

export interface RetrievedChunk {
  id?: string;
  document_id: string;
  content_preview: string;
  chunk_index: number;
  source_type: string;
  external_url?: string | null;
  department_id?: string | null;
  similarity?: number;
}

export interface CitedSource {
  document_id: string;
  title: string | null;
  external_url?: string | null;
  chunk_index: number;
  source_type: string;
}

/** Shape of a pending write action waiting for HITL approval */
export interface PendingWriteAction {
  tool: string;
  payload: Record<string, unknown>;
  requested_at: string;
}

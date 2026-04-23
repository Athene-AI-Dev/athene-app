// ============================================================
// checkpointer.ts — LangGraph checkpoint persistence
//
// Provides two checkpointer implementations:
//
//   checkpointer       — Singleton MemorySaver for local dev / tests
//   SupabaseCheckpointer — Stub for production Supabase persistence
//
// TODO (ATH-future): Replace SupabaseCheckpointer stub with a real
//   implementation backed by the checkpoints Postgres table.
//   Until then it falls through to MemorySaver semantics (in-process RAM).
//   WARNING: MemorySaver does NOT survive Vercel cold starts.
// ============================================================

import { MemorySaver } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared checkpointer instance for local development and tests.
 */
export const checkpointer = new MemorySaver();

/**
 * Production-grade checkpointer backed by Supabase (stub).
 *
 * Accepts the service-role Supabase client and org ID so future
 * implementations can scope checkpoints per organisation.
 * Currently delegates to MemorySaver; replace body with Postgres-backed
 * implementation once the checkpoints table migration lands (ATH-future).
 */
export class SupabaseCheckpointer extends MemorySaver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_supabase: SupabaseClient, _orgId: string) {
    super();
    // TODO (ATH-future): initialise a Postgres-backed checkpoint store here.
  }
}

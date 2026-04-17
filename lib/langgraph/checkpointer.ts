// ============================================================
// checkpointer.ts — SupabaseCheckpointer
//
// Persists LangGraph checkpoints to the thread_checkpoints table.
// One row = one checkpoint in a thread's history.
//
// Storage layout inside the `checkpoint` JSONB column:
//   {
//     checkpoint:     Checkpoint,       // LangGraph Checkpoint object
//     metadata:       CheckpointMetadata,
//     pending_writes: PendingWrite[],   // writes not yet committed
//   }
//
// Thread IDs passed to LangGraph MUST be valid UUIDs that already
// exist in the `threads` table (FK constraint). The API route is
// responsible for creating the thread row first.
//
// Instantiate with a Supabase service-role client so RLS is
// bypassed — the checkpointer runs in a trusted server context.
// ============================================================

// In @langchain/langgraph v1+, checkpoint primitives moved to the
// dedicated @langchain/langgraph-checkpoint package.
import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import type {
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  CheckpointListOptions,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";

// LangGraph's CheckpointTuple.pendingWrites is `[taskId, channel, value][]`
// (3-tuple), while `PendingWrite` is the 2-tuple `[channel, value]` handed
// to `putWrites`. We persist the 3-tuple form so `getTuple` can return it
// directly.
type StoredPendingWrite = [string, string, unknown];
import type { RunnableConfig } from "@langchain/core/runnables";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---- Internal storage format --------------------------------

interface StoredPayload {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  pending_writes: StoredPendingWrite[];
}

interface CheckpointRow {
  id: string;
  thread_id: string;
  org_id: string;
  checkpoint: StoredPayload;
  parent_id: string | null;
  created_at: string;
}

// ---- Helper -------------------------------------------------

function buildConfig(
  threadId: string,
  checkpointId: string,
  ns: string,
): RunnableConfig {
  return {
    configurable: {
      thread_id: threadId,
      checkpoint_id: checkpointId,
      checkpoint_ns: ns,
    },
  };
}

// ---- SupabaseCheckpointer -----------------------------------

export class SupabaseCheckpointer extends BaseCheckpointSaver {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly orgId: string,
  ) {
    super();
  }

  /** Fetch a single checkpoint (latest or by explicit id). */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return undefined;

    const checkpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";

    let query = this.supabase
      .from("thread_checkpoints")
      .select("*")
      .eq("org_id", this.orgId)
      .eq("thread_id", threadId);

    if (checkpointId) {
      query = query.eq("id", checkpointId);
    } else {
      query = query.order("created_at", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return undefined;

    const row = data as CheckpointRow;
    const stored = row.checkpoint;

    return {
      config: buildConfig(threadId, row.id, ns),
      checkpoint: stored.checkpoint,
      metadata: stored.metadata,
      pendingWrites: stored.pending_writes ?? [],
      parentConfig: row.parent_id
        ? buildConfig(threadId, row.parent_id, ns)
        : undefined,
    };
  }

  /** Yield checkpoints for a thread, newest-first. */
  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return;

    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";

    let query = this.supabase
      .from("thread_checkpoints")
      .select("*")
      .eq("org_id", this.orgId)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return;

    for (const raw of data) {
      const row = raw as CheckpointRow;
      const stored = row.checkpoint;

      yield {
        config: buildConfig(threadId, row.id, ns),
        checkpoint: stored.checkpoint,
        metadata: stored.metadata,
        pendingWrites: stored.pending_writes ?? [],
        parentConfig: row.parent_id
          ? buildConfig(threadId, row.parent_id, ns)
          : undefined,
      };
    }
  }

  /** Persist a new checkpoint and return the updated config with its id. */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    // newVersions is part of the BaseCheckpointSaver abstract signature in v1.x
    _newVersions?: Record<string, string | number>,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const parentId = config.configurable?.checkpoint_id as string | undefined;
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? "";

    const stored: StoredPayload = {
      checkpoint,
      metadata,
      pending_writes: [],
    };

    const { data, error } = await this.supabase
      .from("thread_checkpoints")
      .insert({
        thread_id: threadId,
        org_id: this.orgId,
        checkpoint: stored,
        parent_id: parentId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`SupabaseCheckpointer.put failed: ${error.message}`);
    }

    return buildConfig(threadId, (data as { id: string }).id, ns);
  }

  /**
   * Merge pending writes into the current checkpoint row.
   * Called by LangGraph when a node issues writes before the next
   * checkpoint is flushed.
   */
  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    if (writes.length === 0) return;

    const checkpointId = config.configurable?.checkpoint_id as
      | string
      | undefined;
    if (!checkpointId) return;

    const { data, error } = await this.supabase
      .from("thread_checkpoints")
      .select("checkpoint")
      .eq("id", checkpointId)
      .single();

    if (error || !data) return;

    const stored = (data as { checkpoint: StoredPayload }).checkpoint;
    const tagged: StoredPendingWrite[] = writes.map(
      ([channel, value]) => [taskId, channel, value] as StoredPendingWrite,
    );
    const merged: StoredPayload = {
      ...stored,
      pending_writes: [...(stored.pending_writes ?? []), ...tagged],
    };

    await this.supabase
      .from("thread_checkpoints")
      .update({ checkpoint: merged })
      .eq("id", checkpointId);
  }

  /**
   * Delete all checkpoints for a thread. Required by BaseCheckpointSaver
   * as of @langchain/langgraph v1.
   */
  async deleteThread(threadId: string): Promise<void> {
    if (!threadId) return;
    await this.supabase
      .from("thread_checkpoints")
      .delete()
      .eq("org_id", this.orgId)
      .eq("thread_id", threadId);
  }
}

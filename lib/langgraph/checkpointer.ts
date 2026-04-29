import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

// Supabase free tier exposes 15 direct connections total.
// Cap the pool to leave headroom for other services and concurrent requests.
const POOL_MAX = parseInt(process.env.DB_POOL_MAX ?? "5", 10);

let checkpointerInstance: PostgresSaver | null = null;

/**
 * Returns a lazily-initialized PostgresSaver instance.
 * Reads connection string from SUPABASE_DB_URL or DATABASE_URL.
 * Calls setup() on first use to ensure the checkpoint tables exist.
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (checkpointerInstance) return checkpointerInstance;

  const connectionString =
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "SUPABASE_DB_URL or DATABASE_URL env var required for PostgresSaver"
    );
  }

  const pool = new pg.Pool({ connectionString, max: POOL_MAX });
  const saver = new PostgresSaver(pool);
  await saver.setup();
  checkpointerInstance = saver;
  return saver;
}

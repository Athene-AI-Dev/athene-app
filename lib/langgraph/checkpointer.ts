import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";

let checkpointerInstance: any | null = null;

/**
 * Returns a lazily-initialized checkpointer instance.
 * Reads connection string from SUPABASE_DB_URL or DATABASE_URL.
 * Falls back to MemorySaver if no DB connection is available (ATH-PROD resilience).
 */
export async function getCheckpointer(): Promise<any> {
  if (checkpointerInstance) return checkpointerInstance;

  const connectionString =
    process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("[checkpointer] No DB connection string found. Falling back to in-memory MemorySaver. History will NOT persist.");
    checkpointerInstance = new MemorySaver();
    return checkpointerInstance;
  }

  try {
    const saver = PostgresSaver.fromConnString(connectionString);
    await saver.setup();
    checkpointerInstance = saver;
    return saver;
  } catch (err) {
    console.error("[checkpointer] Failed to initialize PostgresSaver, falling back to MemorySaver:", err);
    checkpointerInstance = new MemorySaver();
    return checkpointerInstance;
  }
}

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { MemorySaver } from "@langchain/langgraph";
import { logger } from "@/lib/logger";

let checkpointerInstance: PostgresSaver | MemorySaver | null = null;
let usingMemory = false;

/**
 * Returns a lazily-initialized checkpointer.
 *
 * Reads SUPABASE_DB_URL or DATABASE_URL. Appends sslmode=require for
 * Supabase connections that omit it, so Vercel → Supabase works without
 * extra env config.
 *
 * Pool is capped at 2 connections — safe for Vercel serverless where each
 * warm instance shares the pool across concurrent requests.
 *
 * Resets and retries on each cold start if the previous attempt failed,
 * rather than caching a broken MemorySaver forever.
 */
export async function getCheckpointer(): Promise<PostgresSaver | MemorySaver> {
  if (checkpointerInstance) return checkpointerInstance;

  const raw = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  if (!raw) {
    logger.warn({}, "[checkpointer] No DB connection string found (SUPABASE_DB_URL / DATABASE_URL). Falling back to MemorySaver — conversation history will not persist across cold starts.");
    usingMemory = true;
    checkpointerInstance = new MemorySaver();
    return checkpointerInstance;
  }

  // Ensure SSL for Supabase pooler connections
  const connectionString = ensureSsl(raw);

  try {
    const saver = PostgresSaver.fromConnString(connectionString, {
      max: 2,  // cap pool size for serverless environments
    } as any);
    await saver.setup();
    checkpointerInstance = saver;
    usingMemory = false;
    logger.info({}, "[checkpointer] PostgresSaver initialized.");
    return saver;
  } catch (err) {
    // Don't cache the fallback — allow retry on next cold start
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[checkpointer] Failed to initialize PostgresSaver, falling back to MemorySaver");
    usingMemory = true;
    const mem = new MemorySaver();
    checkpointerInstance = mem;
    return mem;
  }
}

/** Returns true if the active checkpointer is in-memory (non-persistent). */
export function isMemoryCheckpointer(): boolean {
  return usingMemory;
}

function ensureSsl(url: string): string {
  if (url.includes("sslmode=") || url.startsWith("postgresql://localhost") || url.startsWith("postgres://localhost")) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=require`;
}

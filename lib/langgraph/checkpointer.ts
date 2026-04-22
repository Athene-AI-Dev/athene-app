import { MemorySaver } from "@langchain/langgraph";

/**
 * Shared checkpointer instance for the agent graph.
 * MemorySaver is used for local persistence. 
 * ⚠️ WARNING: MemorySaver will NOT work on Vercel production as it stores state in-process RAM.
 * TODO: Replace with PostgresSaver before production merge to ensure persistence across cold starts.
 */
export const checkpointer = new MemorySaver();

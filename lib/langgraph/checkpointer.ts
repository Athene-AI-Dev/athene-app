import { MemorySaver } from "@langchain/langgraph";

/**
 * Shared checkpointer instance for the agent graph.
 * MemorySaver is used for local persistence. 
 * For production, consider using PostgresSaver or similar.
 */
export const checkpointer = new MemorySaver();

/**
 * @deprecated This file is the stale backlog version of the retrieval agent.
 * The live implementation lives at lib/langgraph/nodes/retrieval-agent.ts
 * and is the version wired into the LangGraph graph.
 *
 * This module re-exports the live implementation so any legacy imports
 * continue to resolve without breaking the build.
 */
export { retrievalAgent } from "../langgraph/nodes/retrieval-agent";

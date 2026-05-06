// ============================================================
// DEPRECATED — lib/agents/retrieval-agent.ts
//
// This file is superseded by lib/langgraph/nodes/retrieval-agent.ts
// which implements the hybrid retrieval mode (ATH-63).
//
// This re-export exists solely to prevent silent wrong-import bugs.
// Any import from this path will get the correct hybrid implementation.
// ============================================================

export { retrievalAgent } from "../langgraph/nodes/retrieval-agent";

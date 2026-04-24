// ============================================================
// agents/registry.ts — AgentDefinition catalog
//
// Single source of truth for every agent's constraints:
//   minTier        — minimum LLM tier the agent may use
//   allowedRoles   — which user roles may invoke this agent
//   needsApproval  — whether the agent requires HITL sign-off
//
// needsApproval values:
//   false        — no approval required (read-only agents)
//   'write-only' — approval required only for write tool calls
//   true         — every invocation requires approval
// ============================================================

import type { UserRole } from "../state";
import type { ModelTier } from "../llm-factory";

export type ApprovalMode = false | "write-only" | true;

export interface AgentDefinition {
  /** Display name for UI / logging */
  name: string;
  /** Minimum LLM tier; actual tier = max(requestComplexity, minTier) */
  minTier: ModelTier;
  /** User roles that may trigger this agent */
  allowedRoles: UserRole[];
  /** HITL approval requirement */
  needsApproval: ApprovalMode;
  /** True if this agent may read across department boundaries */
  crossDept: boolean;
}

// ---- Catalog ------------------------------------------------

export const AGENT_REGISTRY = {
  retrieval_agent: {
    name: "Retrieval Agent",
    minTier: "simple",
    allowedRoles: ["member", "super_user", "admin"],
    needsApproval: false,
    crossDept: false,
  },

  cross_dept_agent: {
    name: "Cross-Department Retrieval Agent",
    minTier: "complex",
    allowedRoles: ["super_user", "admin"],
    needsApproval: false,
    crossDept: true,
  },

  email_agent: {
    name: "Email Agent",
    minTier: "medium",
    allowedRoles: ["member", "super_user", "admin"],
    needsApproval: "write-only",
    crossDept: false,
  },

  calendar_agent: {
    name: "Calendar Agent",
    minTier: "medium",
    allowedRoles: ["member", "super_user", "admin"],
    needsApproval: "write-only",
    crossDept: false,
  },

  report_agent: {
    name: "Report Agent",
    minTier: "medium",
    allowedRoles: ["super_user", "admin"],
    needsApproval: false,
    crossDept: true,
  },

} as const satisfies Record<string, AgentDefinition>;

export type AgentName = keyof typeof AGENT_REGISTRY;

// ---- Lookup helpers -----------------------------------------

export function getAgent(name: AgentName): AgentDefinition {
  return AGENT_REGISTRY[name];
}

export function agentAllowedForRole(
  name: AgentName,
  role: UserRole,
): boolean {
  return (AGENT_REGISTRY[name].allowedRoles as readonly UserRole[]).includes(
    role,
  );
}

export function agentNeedsApproval(
  name: AgentName,
  isWriteOperation: boolean,
): boolean {
  const mode = AGENT_REGISTRY[name].needsApproval as ApprovalMode;
  if (mode === false) return false;
  if (mode === true) return true;
  return isWriteOperation; // 'write-only'
}

// ============================================================
// lib/tools/types.ts — Shared types for the tool registry
//
// Defines the ToolName union, ToolMeta descriptor, and the
// role-gating contract that the registry enforces.
// ============================================================

import type { UserRole } from '@/lib/langgraph/state'

// ---- Tool name catalogue ----------------------------------------

/**
 * String-literal union of every tool name known to the system.
 * Add new entries here when registering a new tool.
 */
export type ToolName =
  | 'vectorSearch'
  | 'crossDeptVectorSearch'
  | 'draftEmail'
  | 'draftCalendarEvent'
  | 'planReport'

// ---- Tool metadata descriptor -----------------------------------

/**
 * Static metadata attached to each registered tool.
 * Used by the registry for role-gating and by the UI
 * for displaying tool capabilities.
 */
export interface ToolMeta {
  /** Canonical tool name — must match a ToolName literal */
  name: ToolName
  /** Human-readable label for UI / logging */
  displayName: string
  /** Short description shown to the LLM and in admin panels */
  description: string
  /** Which roles are allowed to invoke this tool */
  allowedRoles: UserRole[]
  /**
   * If true, the tool triggers the HITL approval gate
   * before executing (e.g. sending an email).
   */
  requiresApproval: boolean
}

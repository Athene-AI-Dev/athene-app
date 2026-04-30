import { supabaseAdmin } from "./server";

export type AuditLogEntry = {
  org_id: string;
  admin_user_id: string;
  action: string;
  target_user_id?: string;
  // Use unknown instead of any — forces callers to narrow the type before use
  details?: unknown;
};


// Returns true on success, false on failure — caller can decide how to handle
export async function writeAuditLog(entry: AuditLogEntry): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("admin_actions")
    .insert([entry]);

  if (error) {
    // Log and return false — caller can decide whether to retry or alert
    console.error("[audit] writeAuditLog failed:", error.message);
    return false;
  }
  return true;
}


export async function writeGrantAccessAudit(entry: {
  org_id: string;
  user_id: string;
  grant_id?: string;
  scope_used: string;
  document_ids: string[];
  query_hash?: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("grant_access_audit")
    .insert([entry]);

  if (error) {
    // Log and return false — caller can decide whether to retry or alert
    console.error("[audit] writeGrantAccessAudit failed:", error.message);
    return false;
  }
  return true;
}

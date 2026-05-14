import { supabaseAdmin } from "./server";
import { logger } from "@/lib/logger";

export type AuditLogEntry = {
  org_id: string;
  admin_user_id: string;
  action: string;
  target_user_id?: string;
  details?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditLogEntry) {
  const { error } = await supabaseAdmin
    .from("admin_actions")
    .insert([entry]);

  if (error) {
    logger.error({ err: error.message }, "[audit] writeAuditLog failed");
  }
}

export async function writeGrantAccessAudit(entry: {
  org_id: string;
  user_id: string;
  grant_id?: string;
  scope_used: string;
  document_ids: string[];
  query_hash?: string;
}) {
  const { error } = await supabaseAdmin
    .from("grant_access_audit")
    .insert([entry]);

  if (error) {
    logger.error({ err: error.message }, "[audit] writeGrantAccessAudit failed");
  }
}

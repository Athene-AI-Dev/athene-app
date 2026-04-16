import { supabaseServer } from './server'

export type AuditLogEntry = {
  org_id: string
  admin_user_id: string
  action: string
  target_user_id?: string
  details?: any
}

/**
 * Writes an entry to the admin_actions audit log.
 * Uses the service-role client because audit logging is an administrative task
 * that should succeed regardless of the initiating user's RLS permissions 
 * (though visibility of the log is RLS-restricted).
 */
export async function writeAuditLog(entry: AuditLogEntry) {
  const { error } = await supabaseServer
    .from('admin_actions')
    .insert([{
      org_id: entry.org_id,
      admin_user_id: entry.admin_user_id,
      action: entry.action,
      target_user_id: entry.target_user_id,
      details: entry.details || {}
    }])

  if (error) {
    console.error('Error writing audit log:', error)
    // We don't throw here to avoid failing the main action if audit fails,
    // but in a production app, you might want more robust error handling.
  }
}

/**
 * Specifically for access grants audit.
 */
export async function writeGrantAccessAudit(entry: {
  org_id: string
  user_id: string
  grant_id?: string
  scope_used: string
  document_ids: string[]
  query_hash?: string
}) {
  const { error } = await supabaseServer
    .from('grant_access_audit')
    .insert([entry])

  if (error) {
    console.error('Error writing grant access audit:', error)
  }
}

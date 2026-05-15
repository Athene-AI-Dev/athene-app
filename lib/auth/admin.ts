import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { withRLS } from '@/lib/supabase/rls-client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { deriveOrgKey, getMasterKey } from '@/lib/auth/kms'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 🛡️ ADMIN ROLE ENFORCEMENT & CONTEXT INJECTION
 * Verifies the caller is an admin and returns an RLS-protected Supabase client.
 * Also ensures KMS_KEY is present for encryption/decryption operations.
 */
export async function requireAdmin<T>(
  callback: (supabase: SupabaseClient, context: { orgId: string; userId: string }) => Promise<T>
): Promise<T> {
  const { userId, orgId, orgRole } = await auth()
  
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }

  const role = mapRole(orgRole ?? undefined)
  if (role !== 'admin') {
    throw new Error('Forbidden')
  }

  // Resolve the internal org UUID so we can derive a per-org KMS key.
  // This prevents a single leaked KMS_KEY from decrypting all org data.
  const { data: orgRow } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .limit(1)
    .maybeSingle()

  // Require the org to be provisioned before deriving its key.
  // Falling back to the raw master key would defeat per-org isolation — a single
  // leaked KMS_KEY would decrypt all orgs. Throw instead so callers get a clear 500.
  if (!orgRow) {
    throw new Error(
      'Organization not provisioned — cannot derive BYOK encryption key. ' +
        'Ensure the org record exists before performing key operations.'
    )
  }
  const orgKey = deriveOrgKey(getMasterKey(), orgRow.id)

  // Inject context and run callback
  // Use internal UUIDs for both RLS context and set_app_context — policies
  // compare against internal org_id/user_id, not Clerk-format IDs.
  return withRLS({
    org_id: orgRow.id,
    user_id: userId,
    user_role: 'admin',
    accessible_dept_ids: [] // Admin sees everything
  }, async (supabase) => {
    await supabase.rpc('set_app_context', {
      p_org_id: orgRow.id,
      p_user_id: userId,
      p_dept_id: '',
      p_role: 'admin',
      p_kms_key: orgKey,
    })

    return callback(supabase, { orgId, userId })
  })
}

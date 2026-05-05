import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { withRLS } from '@/lib/supabase/rls-client'
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

  // KMS Guard (Issue #5)
  const kmsKey = process.env.KMS_KEY
  if (!kmsKey) {
    console.error('[Admin] KMS_KEY environment variable is missing')
    throw new Error('Server configuration error: KMS_KEY is missing')
  }

  // Inject context and run callback
  return withRLS({
    org_id: orgId,
    user_id: userId,
    user_role: 'admin',
    accessible_dept_ids: [] // Admin sees everything
  }, async (supabase) => {
    // Note: withRLS calls set_app_context RPC which now includes kms_key
    // but withRLS doesn't know about kms_key yet. We need to set it manually 
    // or update withRLS. Since we want to stick to the pattern, we'll call 
    // set_app_context again with the key.
    
    await supabase.rpc('set_app_context', {
      p_org_id: orgId,
      p_user_id: userId,
      p_dept_id: '',
      p_role: 'admin',
      p_kms_key: kmsKey
    })

    return callback(supabase, { orgId, userId })
  })
}

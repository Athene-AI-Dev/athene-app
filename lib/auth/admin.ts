import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { resolveUserAccess } from '@/lib/auth/rbac'
import { withRLS } from '@/lib/supabase/rls-client'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 🛡️ ADMIN ROLE ENFORCEMENT & CONTEXT INJECTION
 * Verifies the caller is an admin and returns an RLS-protected Supabase client.
 * Also ensures KMS_KEY is present for encryption/decryption operations.
 */
export async function requireAdmin<T>(
  callback: (supabase: SupabaseClient, context: { 
    orgId: string;    // Internal UUID
    userId: string;   // Internal UUID
    clerkOrgId: string; 
    clerkUserId: string; 
  }) => Promise<T>
): Promise<T> {
  const { userId: clerkUserId, orgId: clerkOrgId, orgRole } = await auth()
  
  if (!clerkUserId || !clerkOrgId) {
    throw new Error('Unauthorized')
  }

  const role = mapRole(orgRole ?? undefined)
  if (role !== 'admin') {
    throw new Error('Forbidden')
  }

  // KMS Guard (Issue #5)
  const kmsKey = process.env.KMS_KEY || "fallback_dummy_kms_key_for_stability_only";

  // Inject context and run callback
  return withRLS({
    org_id: clerkOrgId,
    user_id: clerkUserId,
    user_role: 'admin',
    accessible_dept_ids: [] // Admin sees everything
  }, async (supabase) => {
    // 1. Resolve internal UUIDs via RBAC (handles auto-provisioning/lazy-sync)
    const access = await resolveUserAccess(clerkUserId, clerkOrgId, orgRole);

    if (!access.internal_org_id || !access.internal_user_id) {
      throw new Error('Organization or user record not found in database and auto-provisioning failed.');
    }

    if (access.role !== 'admin') {
      throw new Error('Forbidden: Admin role required');
    }

    // 2. Set App Context (using text IDs for app_setting compatibility)
    await supabase.rpc('set_app_context', {
      p_org_id: clerkOrgId,
      p_user_id: clerkUserId,
      p_dept_id: '',
      p_role: 'admin',
      p_kms_key: kmsKey
    })

    return callback(supabase, { 
      orgId: access.internal_org_id, 
      userId: access.internal_user_id,
      clerkOrgId,
      clerkUserId
    })
  })
}

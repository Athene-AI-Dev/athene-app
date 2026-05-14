import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/role
 * Returns the caller's mapped role and internal IDs.
 * Replaces the fragile graph-API piggyback workaround (ATH-35).
 */
export async function GET() {
  const { userId, orgId, orgRole } = await auth()

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = mapRole(orgRole ?? undefined) ?? 'member'

  // Resolve internal org UUID
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle()

  // Resolve internal member UUID (for callers that need it)
  const { data: member } = org
    ? await supabaseAdmin
        .from('org_members')
        .select('id, department_id, timezone')
        .eq('clerk_user_id', userId)
        .eq('org_id', org.id)
        .maybeSingle()
    : { data: null }

  return NextResponse.json({
    role,
    userId,
    orgId,
    internalUserId: member?.id ?? null,
    internalOrgId: org?.id ?? null,
    departmentId: member?.department_id ?? null,
    timezone: member?.timezone ?? 'UTC',
  })
}

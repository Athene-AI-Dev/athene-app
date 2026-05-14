import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { mapRole } from '@/lib/auth/clerk'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withRLS, type RLSContext } from '@/lib/supabase/rls-client'

async function resolveAutomationContext(): Promise<RLSContext | Response> {
  const { userId, orgId: clerkOrgId, orgRole } = await auth()

  if (!userId || !clerkOrgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: orgData, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .limit(1)
    .maybeSingle()

  if (orgError) {
    console.error('[automations_context] Org lookup error:', orgError)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  if (!orgData) {
    return NextResponse.json({ error: 'Organization context not found' }, { status: 404 })
  }

  const { data: memberData, error: memberError } = await supabaseAdmin
    .from('org_members')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgData.id)
    .limit(1)
    .maybeSingle()

  if (memberError) {
    console.error('[automations_context] Member lookup error:', memberError)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  if (!memberData) {
    return NextResponse.json({ error: 'Member context not found' }, { status: 404 })
  }

  return {
    org_id: orgData.id,
    user_id: memberData.id,
    user_role: mapRole(orgRole ?? undefined) ?? memberData.role ?? 'member',
  }
}

/**
 * GET /api/admin/automations
 * Fetches all automations for the current organization.
 */
export async function GET() {
  const context = await resolveAutomationContext()
  if (context instanceof Response) return context

  return withRLS(context, async (supabase) => {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[automations_get] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data)
  })
}

/**
 * POST /api/admin/automations
 * Creates a new automation for the current organization.
 */
export async function POST(req: Request) {
  const context = await resolveAutomationContext()
  if (context instanceof Response) return context

  try {
    const body = await req.json()
    const { id: _id, org_id: _orgId, user_id: _userId, ...safeBody } = body
    
    return withRLS(context, async (supabase) => {
      const { data, error } = await supabase
        .from('automations')
        .insert({
          ...safeBody,
          org_id: context.org_id,
          user_id: context.user_id,
        })
        .select()
        .single()

      if (error) {
        console.error('[automations_post] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json(data)
    })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

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
    console.error('[automation_context] Org lookup error:', orgError)
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
    console.error('[automation_context] Member lookup error:', memberError)
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
 * PATCH /api/admin/automations/[id]
 * Updates an automation (status, config, etc.)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveAutomationContext()
  const { id } = await params
  
  if (context instanceof Response) return context

  try {
    const body = await req.json()
    const { id: _id, org_id: _orgId, user_id: _userId, ...safeBody } = body
    
    return withRLS(context, async (supabase) => {
      const { data, error } = await supabase
        .from('automations')
        .update(safeBody)
        .eq('id', id)
        .eq('org_id', context.org_id)
        .eq('user_id', context.user_id)
        .select()
        .single()

      if (error) {
        console.error('[automation_patch] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json(data)
    })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

/**
 * DELETE /api/admin/automations/[id]
 * Removes an automation.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await resolveAutomationContext()
  const { id } = await params
  
  if (context instanceof Response) return context

  return withRLS(context, async (supabase) => {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id)
      .eq('org_id', context.org_id)
      .eq('user_id', context.user_id)

    if (error) {
      console.error('[automation_delete] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return new Response(null, { status: 204 })
  })
}

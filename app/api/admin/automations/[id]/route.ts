import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { withRLS, getContextFromHeaders } from '@/lib/supabase/rls-client'

/**
 * PATCH /api/admin/automations/[id]
 * Updates an automation (status, config, etc.)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId: authOrgId } = await auth()
  const context = getContextFromHeaders(await headers())
  const { id } = await params
  
  if (!authOrgId || !context || authOrgId !== context.org_id) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()
    
    return withRLS(context, async (supabase) => {
      const { data, error } = await supabase
        .from('automations')
        .update(body)
        .eq('id', id)
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
  const { orgId: authOrgId } = await auth()
  const context = getContextFromHeaders(await headers())
  const { id } = await params
  
  if (!authOrgId || !context || authOrgId !== context.org_id) {
    return new Response('Unauthorized', { status: 401 })
  }

  return withRLS(context, async (supabase) => {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[automation_delete] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return new Response(null, { status: 204 })
  })
}

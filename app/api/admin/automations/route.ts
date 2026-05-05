import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { withRLS, getContextFromHeaders } from '@/lib/supabase/rls-client'

/**
 * GET /api/admin/automations
 * Fetches all automations for the current organization.
 */
export async function GET() {
  const { orgId: authOrgId } = await auth()
  const context = getContextFromHeaders(await headers())
  
  // High Severity Fix: Explicit org-scoping guard
  if (!authOrgId || !context || authOrgId !== context.org_id) {
    return new Response('Unauthorized: Org mismatch or missing', { status: 401 })
  }

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
  const { orgId: authOrgId } = await auth()
  const context = getContextFromHeaders(await headers())
  
  if (!authOrgId || !context || authOrgId !== context.org_id) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()
    
    return withRLS(context, async (supabase) => {
      const { data, error } = await supabase
        .from('automations')
        .insert({
          ...body,
          org_id: context.org_id,
          user_id: context.user_id // Map to the internal user ID resolved by middleware
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

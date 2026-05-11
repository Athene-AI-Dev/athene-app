import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getContextFromHeaders } from '@/lib/supabase/rls-client'
import { assertAdminRole } from '@/lib/auth/rbac'

export async function GET(req: Request) {
  const context = getContextFromHeaders(req.headers)
  if (!context) return new Response('Unauthorized', { status: 401 })

  // Centralized scoped role check (ATH-47 #3, #10)
  const isAdmin = await assertAdminRole(context.user_id, context.org_id)
  if (!isAdmin) {
     return new Response('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '100')

  const { data, error } = await supabaseAdmin
    .from('grant_access_audit')
    .select('*')
    .eq('org_id', context.org_id)
    .order('accessed_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getContextFromHeaders } from '@/lib/supabase/rls-client'

export async function GET(req: Request) {
  const context = getContextFromHeaders(req.headers)
  if (!context) return new Response('Unauthorized', { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('id', context.user_id)
    .single()

  if (member?.role !== 'admin' && member?.role !== 'super_user') {
     return new Response('Forbidden', { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('bi_access_audit')
    .select('*')
    .eq('org_id', context.org_id)
    .order('timestamp', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

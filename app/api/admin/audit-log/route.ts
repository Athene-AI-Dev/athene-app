import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { resolveUserAccess } from '@/lib/auth/rbac'

export async function GET(req: Request) {
  const { userId, orgId, orgRole } = await auth()
  
  if (!userId || !orgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const access = await resolveUserAccess(userId, orgId, orgRole)
  if (access.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '0')
  const limit = parseInt(searchParams.get('limit') || '50')

  const { data, error } = await supabaseAdmin
    .from('admin_actions')
    .select(`
      *,
      admin:admin_user_id (id, full_name, email),
      target:target_user_id (id, full_name, email)
    `)
    .eq('org_id', access.internal_org_id)
    .order('performed_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

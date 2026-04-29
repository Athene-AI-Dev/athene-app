import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { mapRole } from '@/lib/auth/clerk'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const { userId, orgId, orgRole } = await auth()
  
  if (!userId || !orgId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const role = mapRole(orgRole ?? undefined)
  if (role !== 'admin') return new Response('Forbidden', { status: 403 })
  
  const { data, error } = await supabaseServer
    .from('admin_actions')
    .select('*, admin:org_members!admin_user_id(email, display_name), target:org_members!target_user_id(email, display_name)')
    .eq('org_id', orgId)
    .order('performed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data })
}

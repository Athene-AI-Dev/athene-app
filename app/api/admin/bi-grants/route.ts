import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getContextFromHeaders } from '@/lib/supabase/rls-client'

export async function GET(req: Request) {
  const context = getContextFromHeaders(req.headers)
  if (!context) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('bi_accessible_grants')
    .select('*')
    .eq('org_id', context.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const context = getContextFromHeaders(req.headers)
  if (!context) return new Response('Unauthorized', { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('org_members')
    .select('role')
    .eq('id', context.user_id)
    .single()

  if (member?.role !== 'admin' && member?.role !== 'super_user') {
     return new Response('Forbidden: Only admin can grant BI access', { status: 403 })
  }

  const body = await req.json()
  const { resource_id, resource_type } = body

  // Insert grant
  const { data, error } = await supabaseAdmin.from('bi_accessible_grants').insert({
    org_id: context.org_id,
    resource_type,
    resource_id,
    granted_by: context.user_id
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update visibility
  if (resource_type === 'document' || resource_type === 'folder') {
    const { error: updateError } = await supabaseAdmin
      .from('document_embeddings')
      .update({ visibility: 'bi_accessible' })
      .eq('document_id', resource_id)
      .eq('org_id', context.org_id)
      
    if (updateError) console.error("Failed to update visibility:", updateError)
  }

  return NextResponse.json(data)
}

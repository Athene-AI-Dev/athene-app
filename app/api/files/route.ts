import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getContextFromHeaders } from '@/lib/supabase/rls-client'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/files
 *
 * Returns all directly-uploaded files for the org, ordered most-recent first.
 * Reads from the documents table where source_type = 'direct_upload'.
 */
export async function GET() {
  const context = getContextFromHeaders(await headers())
  if (!context?.org_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, title, mime_type, metadata, created_at, external_id')
    .eq('org_id', context.org_id)
    .eq('source_type', 'direct_upload')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[files/get]', error.message)
    return NextResponse.json({ error: 'Failed to load files' }, { status: 500 })
  }

  // Normalize to the shape the files page expects
  const files = (data ?? []).map((doc) => {
    const meta = (doc.metadata ?? {}) as Record<string, string>
    const ext = doc.title?.split('.').pop()?.toUpperCase() ?? meta.type ?? 'FILE'
    const now = Date.now()
    const created = new Date(doc.created_at).getTime()
    const diffMs = now - created
    const diffMins = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHrs / 24)

    let date = 'Just now'
    if (diffMins < 1) date = 'Just now'
    else if (diffMins < 60) date = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    else if (diffHrs < 24) date = `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`
    else if (diffDays === 1) date = 'Yesterday'
    else date = `${diffDays} days ago`

    return {
      id: doc.id,
      name: doc.title ?? 'Untitled',
      type: ext,
      size: meta.size ?? '—',
      date,
      status: 'Indexed',
      risk: 'Low',
      layer: 'Internal Wiki',
      storagePath: doc.external_id ?? undefined,
    }
  })

  return NextResponse.json(files)
}

/**
 * DELETE /api/files?id=<document_uuid>
 *
 * Removes the document from Supabase Storage and from the documents table.
 * The storage path is stored in documents.external_id.
 */
export async function DELETE(req: NextRequest) {
  const context = getContextFromHeaders(await headers())
  if (!context?.org_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing ?id parameter' }, { status: 400 })
  }

  // Fetch the document to verify ownership and get the storage path
  const { data: doc, error: fetchErr } = await supabaseAdmin
    .from('documents')
    .select('id, org_id, external_id, source_type')
    .eq('id', id)
    .eq('org_id', context.org_id)
    .eq('source_type', 'direct_upload')
    .maybeSingle()

  if (fetchErr) {
    console.error('[files/delete] fetch error:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to look up document' }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
  }

  // 1. Remove from Supabase Storage (best-effort — don't block on storage errors)
  if (doc.external_id) {
    const { error: storageErr } = await supabaseAdmin.storage
      .from('documents')
      .remove([doc.external_id])

    if (storageErr) {
      console.warn('[files/delete] Storage remove failed (continuing):', storageErr.message)
    }
  }

  // 2. Delete document row (cascades to document_embeddings via FK)
  const { error: deleteErr } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('org_id', context.org_id)

  if (deleteErr) {
    console.error('[files/delete] DB delete error:', deleteErr.message)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  return NextResponse.json({ status: 'deleted', id })
}

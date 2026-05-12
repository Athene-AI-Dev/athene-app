import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'

/**
 * GET: List all LLM keys for the current organization.
 * Only returns key hints (last 4 chars) and status.
 */
export async function GET() {
  try {
    return await requireAdmin(async (supabase) => {
      const { data, error } = await supabase
        .from('llm_keys')
        .select('id, provider, key_hint, label, is_active, last_used_at, updated_at')
        .order('provider', { ascending: true })

      if (error) throw error
      
      // Defense in Depth: Explicitly map to return only safe fields
      const safeData = (data || []).map(k => ({
        id: k.id,
        provider: k.provider,
        key_hint: k.key_hint,
        label: k.label,
        is_active: k.is_active,
        last_used_at: k.last_used_at,
        updated_at: k.updated_at
      }))

      return NextResponse.json(safeData)
    })
  } catch (err: any) {
    return handleApiError(err)
  }
}

/**
 * POST: Add a new LLM key.
 * If an active key already exists for the provider, it will be deactivated (rotated).
 */
export async function POST(req: NextRequest) {
  try {
    const { provider, key, label } = await req.json()

    if (!provider || !key) {
      return NextResponse.json({ error: 'provider and key are required' }, { status: 400 })
    }

    return await requireAdmin(async (supabase, { orgId, userId }) => {
      // 1. Encrypt the key using the DB function (uses app.kms_key from session)
      const { data: encryptedKey, error: encryptError } = await supabase.rpc('encrypt_llm_key', {
        plaintext_key: key
      })

      if (encryptError) throw encryptError

      // 2. Deactivate any existing active key for this provider (Issue #2 rotation logic)
      await supabase
        .from('llm_keys')
        .update({ is_active: false })
        .eq('provider', provider)
        .eq('is_active', true)

      // 3. Insert new key
      const { data, error: insertError } = await supabase
        .from('llm_keys')
        .insert({
          org_id: orgId,
          provider,
          key_encrypted: encryptedKey,
          key_hint: `...${key.slice(-4)}`,
          label: label || `${provider} key`,
          is_active: true,
          created_by: userId
        })
        .select()
        .limit(1)
        .maybeSingle()

      if (insertError) throw insertError

      // 4. Audit Log (Issue #6)
      await supabase.from('admin_actions').insert({
        org_id: orgId,
        admin_user_id: userId,
        action: 'add_key',
        details: { provider, key_id: data.id, label }
      })

      return NextResponse.json(data)
    })
  } catch (err: any) {
    return handleApiError(err)
  }
}

/**
 * PATCH: Update an existing key (toggle status or change label).
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, is_active, label } = await req.json()

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    return await requireAdmin(async (supabase, { orgId, userId }) => {
      const { data: oldKey, error: fetchError } = await supabase
        .from('llm_keys')
        .select('provider, label, is_active')
        .eq('id', id)
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!oldKey) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

      const { data, error: updateError } = await supabase
        .from('llm_keys')
        .update({ is_active, label })
        .eq('id', id)
        .select()
        .limit(1)
        .maybeSingle()

      if (updateError) throw updateError

      // Audit Log
      await supabase.from('admin_actions').insert({
        org_id: orgId,
        admin_user_id: userId,
        action: 'update_key',
        details: { 
          key_id: id, 
          provider: oldKey.provider,
          changes: { is_active, label } 
        }
      })

      return NextResponse.json(data)
    })
  } catch (err: any) {
    return handleApiError(err)
  }
}

/**
 * DELETE: Permanently remove a key.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    return await requireAdmin(async (supabase, { orgId, userId }) => {
      const { data: key, error: fetchError } = await supabase
        .from('llm_keys')
        .select('provider')
        .eq('id', id)
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

      const { error: deleteError } = await supabase
        .from('llm_keys')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      // Audit Log
      await supabase.from('admin_actions').insert({
        org_id: orgId,
        admin_user_id: userId,
        action: 'delete_key',
        details: { key_id: id, provider: key.provider }
      })

      return NextResponse.json({ success: true })
    })
  } catch (err: any) {
    return handleApiError(err)
  }
}

function handleApiError(err: any) {
  console.error('[API Keys Error]:', err.message)
  if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
  if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
  if (err.message.includes('KMS_KEY')) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ error: err.message }, { status: 500 })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { listConnections, deleteConnection, saveConnectionMapping } from '@/lib/nango/client'
import { PROVIDER_REGISTRY } from '@/lib/integrations/providers'
import { supabaseAdmin } from '@/lib/supabase/server'
import { invalidatePromptCache } from '@/lib/knowledge-graph/modules/resolver'

/**
 * 🛡️ ADMIN ROLE ENFORCEMENT
 * Shared helper to verify the caller has the "admin" role in the organization.
 */
async function ensureAdmin() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }

  const role = mapRole(orgRole ?? undefined)
  if (role !== 'admin') {
    throw new Error('Forbidden')
  }

  return { userId, orgId }
}

export async function GET(_req: NextRequest) {
  try {
    const { orgId } = await ensureAdmin()
    const connections = await listConnections(orgId)

    // Batch-count documents per nango connection for the whole org in one query.
    // Schema: nango_connection_id (text) → connections.id (uuid) → documents.connection_id
    const { data: docCounts } = await supabaseAdmin
      .from('connections')
      .select('nango_connection_id, documents(count)')
      .eq('org_id', orgId)

    const countByNangoId: Record<string, number> = {}
    for (const row of docCounts ?? []) {
      const count = Array.isArray(row.documents) ? (row.documents[0] as any)?.count ?? 0 : 0
      countByNangoId[row.nango_connection_id] = Number(count)
    }

    const integrations = (connections as any[]).map((conn) => {
      const providerKey = (conn.provider_config_key ?? conn.provider) as string
      const nangoConnId = conn.connection_id ?? conn.id
      const config = PROVIDER_REGISTRY[providerKey as keyof typeof PROVIDER_REGISTRY]
      return {
        connectionId: nangoConnId,
        provider: providerKey,
        displayName: config?.displayName ?? providerKey,
        category: config?.category ?? 'other',
        resources: config?.resources ?? [],
        status: conn.sync_status || (conn.errors?.length ? 'error' : 'connected'),
        lastSyncedAt: conn.last_synced_at ?? null,
        totalDocs: countByNangoId[nangoConnId] ?? 0,
        createdAt: conn.created_at ?? null,
      }
    })

    return NextResponse.json({ integrations })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await ensureAdmin()
    
    let body: { connectionId?: string; provider?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { connectionId, provider } = body
    if (!connectionId || !provider) {
      return NextResponse.json({ error: 'connectionId and provider are required' }, { status: 400 })
    }

    // ✅ Fix ATH-32: Persist connection to Supabase after OAuth
    await saveConnectionMapping(orgId, connectionId, provider)
    
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { orgId } = await ensureAdmin()

    let body: { connectionId?: string; provider?: string }
    try {
      body = await req.json()
    } catch {
      // Fallback to query params if JSON body is missing
      const { searchParams } = new URL(req.url)
      body = {
        connectionId: searchParams.get('connectionId') ?? undefined,
        provider: searchParams.get('provider') ?? searchParams.get('providerConfigKey') ?? undefined
      }
    }

    const { connectionId, provider } = body
    if (!connectionId || !provider) {
      return NextResponse.json({ error: 'connectionId and provider are required' }, { status: 400 })
    }

    await deleteConnection(connectionId, provider, orgId)

    // Resolve internal org UUID and invalidate KG prompt cache so the removed
    // integration's module addendum no longer contributes to extraction
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .maybeSingle()
    if (orgData?.id) void invalidatePromptCache(orgData.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

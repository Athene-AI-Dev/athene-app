import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { listConnections, deleteConnection, saveConnectionMapping } from '@/lib/nango/client'
import { PROVIDER_REGISTRY } from '@/lib/integrations/providers'

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

    const integrations = (connections as any[]).map((conn) => {
      const providerKey = (conn.provider_config_key ?? conn.provider) as string
      const config = PROVIDER_REGISTRY[providerKey as keyof typeof PROVIDER_REGISTRY]
      return {
        connectionId: conn.connection_id ?? conn.id,
        provider: providerKey,
        displayName: config?.displayName ?? providerKey,
        category: config?.category ?? 'other',
        resources: config?.resources ?? [],
        status: conn.sync_status || (conn.errors?.length ? 'error' : 'connected'),
        lastSyncedAt: conn.last_synced_at ?? null,
        totalDocs: 0, // TODO: Count from documents table
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
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

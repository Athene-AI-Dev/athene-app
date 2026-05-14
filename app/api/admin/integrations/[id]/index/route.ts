import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { supabaseAdmin } from '@/lib/supabase/server'
import { dispatchThrottled } from '@/lib/qstash/client'
import { getServerBaseUrl } from '@/lib/url/server-base-url'

async function ensureAdmin() {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) throw new Error('Unauthorized')
  if (mapRole(orgRole ?? undefined) !== 'admin') throw new Error('Forbidden')
  return { userId, clerkOrgId: orgId }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { clerkOrgId } = await ensureAdmin()
    const { id: nangoConnectionId } = await params

    const body = await req.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 })
    }

    // Resolve internal org UUID — connections.org_id is a UUID FK, not the Clerk org ID
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle()

    if (!orgData) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    const internalOrgId = orgData.id as string

    const workerUrl = `${getServerBaseUrl()}/api/worker/nango-fetch`

    const { dispatched, msgId } = await dispatchThrottled({
      orgId: internalOrgId,
      sourceType: provider.toLowerCase(),
      url: workerUrl,
      body: {
        orgId: internalOrgId,
        connectionId: nangoConnectionId,
        provider: provider.toLowerCase(),
        sourceType: provider.toLowerCase(),
      },
    })

    return NextResponse.json({
      success: true,
      dispatched,
      messageId: msgId,
      status: dispatched ? 'started' : 'queued',
    })

  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

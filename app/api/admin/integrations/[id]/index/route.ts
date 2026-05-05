import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { mapRole } from '@/lib/auth/clerk'
import { dispatchThrottled } from '@/lib/qstash/client'

/**
 * 🛡️ ADMIN ROLE ENFORCEMENT
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { orgId } = await ensureAdmin()
    const connectionId = params.id

    const body = await req.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 })
    }

    // 🚀 Trigger full sync via QStash
    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/worker/nango-fetch`
    
    const { dispatched, msgId } = await dispatchThrottled({
      orgId,
      sourceType: provider,
      url: workerUrl,
      body: {
        orgId,
        connectionId,
        provider,
        sourceType: provider,
      },
    })

    return NextResponse.json({ 
      success: true, 
      dispatched, 
      messageId: msgId,
      status: dispatched ? 'started' : 'queued'
    })

  } catch (err: any) {
    if (err.message === 'Unauthorized') return new NextResponse('Unauthorized', { status: 401 })
    if (err.message === 'Forbidden') return new NextResponse('Forbidden', { status: 403 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

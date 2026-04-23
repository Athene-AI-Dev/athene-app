import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { agentGraph } from '@/lib/langgraph/graph'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return new NextResponse('Unauthorized', { status: 401 })

  const threadId = req.nextUrl.searchParams.get('threadId')
  if (!threadId) {
    return NextResponse.json({ error: 'threadId query parameter is required' }, { status: 400 })
  }

  const snapshot = await agentGraph.getState({ configurable: { thread_id: threadId } })

  // LangGraph returns an empty-values snapshot when thread_id is unknown
  const state = snapshot?.values as Record<string, any> | undefined
  if (!state?.orgId) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  // Prevent cross-org state access
  if (state.orgId !== orgId) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return NextResponse.json({
    threadId,
    run_status: state.run_status ?? 'running',
    awaiting_approval: state.awaiting_approval ?? false,
    pending_write_action: state.pending_write_action ?? null,
    next: snapshot.next ?? [],
    message_count: state.messages?.length ?? 0,
  })
}

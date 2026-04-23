import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { agentGraph } from '@/lib/langgraph/graph'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return new NextResponse('Unauthorized', { status: 401 })

  let body: { threadId?: string; approved?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { threadId, approved } = body
  if (!threadId || approved === undefined) {
    return NextResponse.json({ error: 'threadId and approved are required' }, { status: 400 })
  }

  // Verify the thread exists and belongs to this org
  const snapshot = await agentGraph.getState({ configurable: { thread_id: threadId } })
  const state = snapshot?.values as Record<string, any> | undefined

  if (!state?.orgId) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }
  if (state.orgId !== orgId) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  if (!state.awaiting_approval) {
    return NextResponse.json({ error: 'Thread is not awaiting approval' }, { status: 409 })
  }

  if (!approved) {
    // Rejected: discard the pending action and mark the run complete
    await agentGraph.updateState(
      { configurable: { thread_id: threadId } },
      { awaiting_approval: false, pending_write_action: null, run_status: 'complete' }
    )
    return NextResponse.json({ status: 'rejected', threadId })
  }

  // Approved: clear the HITL gate so approval_node can proceed
  await agentGraph.updateState(
    { configurable: { thread_id: threadId } },
    { awaiting_approval: false, run_status: 'running' }
  )

  // Resume the graph and stream remaining output back to the client
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  ;(async () => {
    try {
      const eventStream = agentGraph.stream(null, {
        configurable: { thread_id: threadId },
        metadata: { orgId, userId },
        streamMode: 'values',
      })

      for await (const chunk of await eventStream) {
        const lastMessage = chunk.messages?.[chunk.messages.length - 1]
        if (lastMessage) {
          const data = JSON.stringify({ content: lastMessage.content, run_status: chunk.run_status })
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        }
      }
      await writer.close()
    } catch (err) {
      await writer.abort(err)
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

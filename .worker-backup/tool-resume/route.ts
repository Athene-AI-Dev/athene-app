export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { verifyQStashSignature, checkIdempotency } from '@/lib/qstash/verify'
import { logger } from '@/lib/logger'
import { getAgentGraph } from '@/lib/langgraph/graph'
import { ToolMessage } from '@langchain/core/messages'

// ---- Payload type -------------------------------------------

interface ToolResumePayload {
  thread_id: string
  tool_call_id: string
  result: any
  error?: string
}

// ---- POST handler -------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verify QStash signature
  const isValid = await verifyQStashSignature(request)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid QStash signature' },
      { status: 401 },
    )
  }

  // 2. Check idempotency
  const isFirstTime = await checkIdempotency(request)
  if (!isFirstTime) {
    logger.info('[tool-resume] Skipping duplicate job (idempotency)')
    return NextResponse.json({ status: 'ok', skipped: 'duplicate' })
  }

  // 3. Parse payload
  let payload: ToolResumePayload
  try {
    payload = (await request.json()) as ToolResumePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { thread_id, tool_call_id, result, error } = payload

  if (!thread_id || !tool_call_id) {
    return NextResponse.json(
      { error: 'Missing required fields: thread_id, tool_call_id' },
      { status: 400 },
    )
  }

  logger.info(
    { thread_id, tool_call_id },
    "[tool-resume] Resuming tool result"
  )

  try {
    // 4. Load the graph and update state with the tool result
    const graph = await getAgentGraph()

    // Construct the tool result message
    const toolMessage = new ToolMessage({
      tool_call_id: tool_call_id,
      content: error ? `Error: ${error}` : JSON.stringify(result),
    })

    // Update the state on the specific thread
    await graph.updateState(
      { configurable: { thread_id } },
      { messages: [toolMessage] }
    )

    // 5. Resume execution
    // In many cases, we want to kick off the next step of the graph automatically.
    // This background worker route resumes the agent so it can finish its thought.

    // Fire-and-forget resume (don't wait for completion in this HTTP request to avoid timeout)
    graph.invoke(null, { configurable: { thread_id } }).catch((err: any) => {
      logger.error({ thread_id, err: err.message }, "[tool-resume] Async resume failed")
    })

    logger.info(
      { thread_id, tool_call_id },
      "[tool-resume] State updated and graph execution resumed"
    )

    return NextResponse.json({
      status: 'ok',
      thread_id,
      tool_call_id,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ thread_id, err: message }, '[tool-resume] Fatal error')

    return NextResponse.json(
      { error: `Tool resume failed: ${message}` },
      { status: 500 },
    )
  }
}

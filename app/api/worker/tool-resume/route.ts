import { NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash/verify'
import { redis } from '@/lib/redis/client'
import { getAgentGraph } from '@/lib/langgraph/graph'
import { Command } from '@langchain/langgraph'

export async function POST(request: Request) {
  // 1. Verify QStash signature
  const isValid = await verifyQStashSignature(request)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })
  }

  // Idempotency check using QStash job ID
  const jobId = request.headers.get('upstash-message-id')
  if (jobId) {
    const isNew = await redis.set(`processed_job:${jobId}`, '1', { nx: true, ex: 86400 * 7 })
    if (!isNew) {
      console.log(`[tool-resume] Skipping duplicate job=${jobId}`)
      return NextResponse.json({ status: 'already_processed', jobId })
    }
  }

  // 2. Parse payload
  let payload: { threadId?: string; toolCallId?: string; result?: any }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { threadId, toolCallId, result } = payload

  if (!threadId || !toolCallId || result === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: threadId, toolCallId, result' },
      { status: 400 }
    )
  }

  console.log(`[tool-resume] Processing resume for thread=${threadId}, toolCallId=${toolCallId}`)

  try {
    // 3. Write the result to Redis
    const redisKey = `async_tool:${threadId}:${toolCallId}`
    // If result is an object, JSON.stringify it. If already string, store as is.
    const valueToStore = typeof result === 'string' ? result : JSON.stringify(result)
    await redis.set(redisKey, valueToStore, { ex: 3600 }) // Store for 1 hour

    // 4. Call LangGraph resume
    const graph = await getAgentGraph()
    await graph.invoke(
      new Command({ resume: result }),
      { configurable: { thread_id: threadId } }
    )

    console.log(`[tool-resume] Successfully resumed thread=${threadId}`)

    return NextResponse.json({ status: 'ok', threadId, toolCallId })
  } catch (error) {
    console.error('[tool-resume] Error processing job:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

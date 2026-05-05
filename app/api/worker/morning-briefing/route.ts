import { NextResponse } from 'next/server'
import { verifyQStashSignature, checkIdempotency } from '@/lib/qstash/verify'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { reportAgent } from '@/lib/agents/report-agent'
import { HumanMessage } from '@langchain/core/messages'

// ---- Payload type -------------------------------------------

interface MorningBriefingPayload {
  org_id: string
  user_id: string
  automation_id?: string
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
    logger.info('[morning-briefing] Skipping duplicate job (idempotency)')
    return NextResponse.json({ status: 'ok', skipped: 'duplicate' })
  }

  // 3. Parse payload
  let payload: MorningBriefingPayload
  try {
    payload = (await request.json()) as MorningBriefingPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { org_id, user_id, automation_id } = payload

  if (!org_id || !user_id) {
    return NextResponse.json(
      { error: 'Missing required fields: org_id, user_id' },
      { status: 400 },
    )
  }

  logger.info(
    { org_id, user_id },
    "[morning-briefing] Generating briefing"
  )

  try {
    // 4. Run the report agent to generate briefing content
    // We construct a synthetic state for the agent
    const agentState: any = {
      orgId: org_id,
      userId: user_id,
      role: 'admin', // System-triggered briefings run with admin context
      next: 'synthesis', // Direct to synthesis for the final briefing output
      messages: [
        new HumanMessage("Generate my morning briefing for today. Focus on calendar events, urgent emails, and recent document updates.")
      ],
    }

    const result = await reportAgent(agentState, {})

    // 5. Extract content from agent result
    // result.messages might contain the final answer
    const lastMessage = result.messages ? result.messages[result.messages.length - 1] : null
    const content = lastMessage ? lastMessage.content : 'Failed to generate briefing content.'

    // 6. Store in briefings table
    const { data: briefing, error: insertErr } = await supabaseAdmin
      .from('briefings')
      .insert({
        org_id,
        user_id,
        automation_id: automation_id ?? null,
        content: { text: content }, // Structured as JSONB
        summary: typeof content === 'string' ? content.substring(0, 100) + '...' : 'Your morning briefing',
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    // 7. Update automation last_run status
    if (automation_id) {
      await supabaseAdmin
        .from('automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'ok',
          run_count: (await supabaseAdmin.from('automations').select('run_count').eq('id', automation_id).single()).data?.run_count + 1
        })
        .eq('id', automation_id)
    }

    logger.info(
      { org_id, user_id, briefing_id: briefing.id },
      "[morning-briefing] Briefing generated and stored"
    )

    return NextResponse.json({
      status: 'ok',
      briefing_id: briefing.id,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ org_id, user_id, err: message }, '[morning-briefing] Fatal error')

    if (automation_id) {
      await supabaseAdmin
        .from('automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'error',
          last_error: message
        })
        .eq('id', automation_id)
    }

    return NextResponse.json(
      { error: `Morning briefing failed: ${message}` },
      { status: 500 },
    )
  }
}

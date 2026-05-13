export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { verifyQStashSignature, checkIdempotency } from '@/lib/qstash/verify'
import { supabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { generateMorningBriefing } from '@/lib/automations/morning-briefing'

export const maxDuration = 300 // 5 minutes for AI briefing generation

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
    // 4. Run the briefing generation utility
    const result = await generateMorningBriefing(user_id, org_id, automation_id);

    if (!result.success) {
      throw new Error('Briefing generation failed');
    }

    // 5. Update automation last_run status
    if (automation_id) {
      // Get current count first
      const { data: autoData } = await supabaseAdmin
        .from('automations')
        .select('run_count')
        .eq('id', automation_id)
        .single()

      const nextCount = (autoData?.run_count ?? 0) + 1

      await supabaseAdmin
        .from('automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'ok',
          run_count: nextCount
        })
        .eq('id', automation_id)
    }

    logger.info(
      { org_id, user_id },
      "[morning-briefing] Briefing generated and stored"
    )

    return NextResponse.json({
      status: 'ok',
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

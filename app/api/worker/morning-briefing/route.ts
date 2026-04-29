// ============================================================
// app/api/worker/briefing/route.ts — Morning briefing worker
//
// QStash-triggered worker that generates a morning briefing
// for a user and stores it in the briefings table for the UI.
//
// Payload:
//   { org_id, user_id, automation_id?, delivery_method? }
//
// Flow:
//   1. Verify QStash signature
//   2. Parse and validate payload
//   3. Fetch relevant data (calendar, email, docs) for the user
//   4. Generate structured briefing content
//   5. Store in briefings table
//
// Wires into: briefings table → UI page
// ============================================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyQStashSignature } from '@/lib/qstash/verify'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getModel } from '@/lib/langgraph/llm-factory'
import { PromptTemplate } from '@langchain/core/prompts'
import { redis } from '@/lib/redis/client'

// ---- Payload type -------------------------------------------

interface BriefingPayload {
  org_id: string
  user_id: string
  automation_id?: string | null
  delivery_method?: 'in_app' | 'email'
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

  // Idempotency check using QStash job ID
  const jobId = request.headers.get('upstash-message-id')
  if (jobId) {
    const isNew = await redis.set(`processed_job:${jobId}`, '1', { nx: true, ex: 86400 * 7 })
    if (!isNew) {
      console.log(`[briefing] Skipping duplicate job=${jobId}`)
      return NextResponse.json({ status: 'already_processed', jobId })
    }
  }

  // 2. Parse payload
  let payload: BriefingPayload
  try {
    payload = (await request.json()) as BriefingPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { org_id, user_id, automation_id, delivery_method = 'in_app' } = payload

  if (!org_id || !user_id) {
    return NextResponse.json(
      { error: 'Missing required fields: org_id, user_id' },
      { status: 400 },
    )
  }

  console.log(`[briefing] Generating briefing for org=${org_id}, user=${user_id}`)

  try {
    // 3. Fetch relevant data for the user from documents index
    //    Pulls recent calendar, email, and doc chunks from the org's indexed data
    const { data: chunks, error: fetchErr } = await supabaseAdmin
      .from('document_chunks')
      .select('content, metadata, source_type')
      .eq('org_id', org_id)
      .in('source_type', ['calendar', 'gmail', 'drive'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchErr) {
      console.error('[briefing] Failed to fetch chunks:', fetchErr.message)
      return NextResponse.json(
        { error: `Failed to fetch data: ${fetchErr.message}` },
        { status: 500 },
      )
    }

    // 4. Generate structured briefing content from fetched chunks
    const calendarChunks = chunks?.filter(c => c.source_type === 'calendar') ?? []
    const emailChunks = chunks?.filter(c => c.source_type === 'gmail') ?? []
    const docChunks = chunks?.filter(c => c.source_type === 'drive') ?? []

    const briefingSchema = z.object({
      summary: z.string().describe("A brief, one-line summary of the user's day (e.g., 'Busy morning with 3 meetings, and 2 urgent emails.')"),
      content: z.object({
        schedule: z.array(z.string()).describe("A list of upcoming meetings and events for today"),
        inbox: z.array(z.string()).describe("A summary of important emails that need attention"),
        tasks: z.array(z.string()).describe("A list of action items or tasks derived from recent documents and emails"),
      })
    })

    const model = getModel('gpt-4o', 0.2).withStructuredOutput(briefingSchema)

    const prompt = PromptTemplate.fromTemplate(`
      You are an expert executive assistant generating a concise morning briefing.
      You have been provided with the user's latest calendar events, emails, and document chunks.
      
      Calendar Events:
      {calendar}
      
      Recent Emails:
      {emails}
      
      Recent Documents:
      {docs}
      
      Analyze the provided information and generate a structured morning briefing.
      Extract the most important meetings, prioritize urgent emails, and synthesize actionable tasks.
      If a section has no relevant data, return an empty array for that section.
    `)

    const formattedPrompt = await prompt.format({
      calendar: JSON.stringify(calendarChunks.map(c => ({ content: c.content, metadata: c.metadata }))),
      emails: JSON.stringify(emailChunks.map(c => ({ content: c.content, metadata: c.metadata }))),
      docs: JSON.stringify(docChunks.map(c => ({ content: c.content, metadata: c.metadata })))
    })

    const result = await model.invoke(formattedPrompt)

    const content = {
      ...result.content,
      generatedAt: new Date().toISOString(),
    }

    const summary = result.summary

    // 5. Store in briefings table
    const { error: insertErr } = await supabaseAdmin
      .from('briefings')
      .insert({
        org_id,
        user_id,
        automation_id: automation_id ?? null,
        content,
        summary,
        calendar_items: calendarChunks.length,
        email_items: emailChunks.length,
        doc_items: docChunks.length,
        delivery_method,
        generated_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('[briefing] Failed to store briefing:', insertErr.message)
      return NextResponse.json(
        { error: `Failed to store briefing: ${insertErr.message}` },
        { status: 500 },
      )
    }

    console.log(`[briefing] Stored briefing for org=${org_id}, user=${user_id}`)

    return NextResponse.json({
      status: 'ok',
      org_id,
      user_id,
      calendar_items: calendarChunks.length,
      email_items: emailChunks.length,
      doc_items: docChunks.length,
    })

  } catch (err) {
    console.error('[briefing] Unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
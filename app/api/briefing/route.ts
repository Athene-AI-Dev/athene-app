import { NextResponse } from 'next/server';
import { getContextFromHeaders, withRLS } from '@/lib/supabase/rls-client';
import { qstash } from '@/lib/qstash/client';
import { getServerBaseUrl } from '@/lib/url/server-base-url';
import { logger } from '@/lib/logger';
import { resolveModelClient } from '@/lib/langgraph/llm-factory';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'today';
  const context = getContextFromHeaders(request.headers);

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await withRLS(context, async (supabase) => {
      const id = searchParams.get('id');
      
      if (id) {
        // Fetch specific briefing
        const { data, error } = await supabase
          .from('briefings')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        return data;
      }

      if (type === 'history') {

        // Fetch past 7 days (excluding today if possible, but let's just get the last 7 rows)
        const { data, error } = await supabase
          .from('briefings')
          .select('id, summary, generated_at, calendar_items, email_items, doc_items')
          .order('generated_at', { ascending: false })
          .limit(7);

        if (error) throw error;
        return data;
      } else {
        // Fetch today's briefing
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('briefings')
          .select('*')
          .gte('generated_at', today.toISOString())
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data;
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error({ err: error?.message, org_id: context.org_id }, '[briefing] GET error');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = getContextFromHeaders(request.headers);

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Pre-check LLM Key & API availability ────────────────────
  try {
    const llm = await resolveModelClient('simple', context.org_id);
    const testCall = async () => {
      await llm.invoke('test connection');
    };

    // 6-second timeout safeguard to fail fast
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM connection timed out')), 6000)
    );

    await Promise.race([testCall(), timeoutPromise]);
  } catch (err: any) {
    logger.error({ err: err?.message, org_id: context.org_id }, '[briefing] LLM pre-check validation failed');
    return NextResponse.json({
      error: 'Synthesis halted: LLM API key is invalid or unreachable. Please check your billing or add a BYOK key in Admin → Keys.'
    }, { status: 400 });
  }

  const workerUrl = `${getServerBaseUrl()}/api/worker/morning-briefing`;
  const body = {
    org_id: context.org_id,
    user_id: context.user_id,
    triggered_by: 'user_manual',
  };

  const hasQStash = !!process.env.QSTASH_TOKEN;

  if (hasQStash) {
    // ── Production path: enqueue via QStash for async, reliable processing ──
    try {
      const response = await qstash.publishJSON({ url: workerUrl, body });
      return NextResponse.json({
        message: 'Briefing generation job enqueued',
        messageId: response.messageId,
      });
    } catch (error: any) {
      logger.error({ err: error?.message, org_id: context.org_id }, '[briefing] POST QStash enqueue failed');
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: `Failed to enqueue job: ${message}` }, { status: 500 });
    }
  }

  // ── Dev / no-QStash path: call worker synchronously with internal bypass header ──
  // verifyQStashSignature accepts x-dev-internal-bypass when signing keys are absent.
  logger.warn({ org_id: context.org_id }, '[briefing] POST QSTASH_TOKEN not set — calling worker synchronously (dev mode)');
  try {
    const workerRes = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dev-internal-bypass': '1',
      },
      body: JSON.stringify(body),
    });

    if (!workerRes.ok) {
      const text = await workerRes.text().catch(() => workerRes.statusText);
      throw new Error(`Worker responded ${workerRes.status}: ${text}`);
    }

    const result = await workerRes.json();
    return NextResponse.json({
      message: 'Briefing generated (dev mode — synchronous)',
      ...result,
    });
  } catch (error: any) {
    logger.error({ err: error?.message, org_id: context.org_id }, '[briefing] POST direct worker call failed');
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to generate briefing: ${message}` }, { status: 500 });
  }
}

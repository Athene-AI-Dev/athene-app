import { NextResponse } from 'next/server';
import { getContextFromHeaders, withRLS } from '@/lib/supabase/rls-client';
import { qstash } from '@/lib/qstash/client';
import { getServerBaseUrl } from '@/lib/url/server-base-url';

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
  } catch (error) {
    console.error('[briefing/get]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = getContextFromHeaders(request.headers);

  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Enqueue job via QStash
    const workerUrl = `${getServerBaseUrl()}/api/worker/morning-briefing`;
    
    // We send context so the worker knows who to generate for
    const body = {
      org_id: context.org_id,
      user_id: context.user_id,
      triggered_by: 'user_manual'
    };

    const response = await qstash.publishJSON({
      url: workerUrl,
      body,
    });

    return NextResponse.json({ 
      message: 'Briefing generation job enqueued',
      messageId: response.messageId 
    });
  } catch (error) {
    console.error('[briefing/post]', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to enqueue job: ${message}` }, { status: 500 });
  }
}

import { Client } from '@upstash/qstash';
import { createClient } from '@supabase/supabase-js';
import { incrWithExpire, redis } from '@/lib/redis/client';

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN || '',
});

// Assuming basic Supabase variables are available in the node server environment.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://local-dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'
);

export type DispatchOptions = {
  orgId: string;
  sourceType: string;
  url: string;
  body: any;
};

/**
 * Dispatch a job to QStash, protected by a concurrency limit backed by Redis.
 * If the current pending concurrency limit is reached for the specific integration token,
 * it will push the background job into a waiting queue via Supabase.
 */
export async function dispatchThrottled({
  orgId,
  sourceType,
  url,
  body,
}: DispatchOptions): Promise<{ dispatched: boolean; msgId?: string }> {
  try {
    const key = `nango_concurrency:${orgId}:${sourceType}`;
    // Max concurrency window in case of a lost request is 15 minutes
    const count = await incrWithExpire(key, 900);

    // Limit concurrency to 3 operations per orgId & sourceType pair simultaneously
    if (count > 3) {
      // Release our erroneously allocated spot immediately since we're throttling
      await redis.decr(key);

      // Queue the job to Supabase instead for background handling
      const { error } = await supabase.from('pending_background_jobs').insert({
        org_id: orgId,
        source_type: sourceType,
        url: url,
        body: body,
        status: 'waiting',
      });

      if (error) {
        console.error('[QStash] Error putting job into pending_background_jobs table:', error);
      }

      return { dispatched: false };
    }

    // Direct publish because limits are respected
    const response = await qstash.publishJSON({
      url,
      body,
    });

    return { dispatched: true, msgId: response.messageId };
  } catch (error) {
    console.error('[QStash] Dispatch error:', error);
    return { dispatched: false };
  }
}

/**
 * Called by the worker after job execution completes. 
 * Decrements the concurrency count, and triggers the next waiting job if any exist.
 */
export async function releaseSlot(orgId: string, sourceType: string) {
  try {
    const key = `nango_concurrency:${orgId}:${sourceType}`;
    
    // Attempt decrement but avoid dropping below 0
    const count = await redis.decr(key);
    if (count < 0) {
      await redis.set(key, 0); // Safety correct
    }

    // Fetch the oldest pending background job
    const { data: jobs, error } = await supabase
      .from('pending_background_jobs')
      .select('*')
      .eq('org_id', orgId)
      .eq('source_type', sourceType)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[QStash] Error fetching pending jobs on release Slot:', error);
      return;
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];

      // Acknowledge by deleting to prevent a different worker from pulling it
      await supabase.from('pending_background_jobs').delete().eq('id', job.id);

      // We re-enter the dispatch pipeline. The pipeline will re-increment the counter.
      await dispatchThrottled({
        orgId: job.org_id,
        sourceType: job.source_type,
        url: job.url,
        body: job.body,
      });
    }
  } catch (error) {
    console.error('[QStash] releaseSlot error:', error);
  }
}

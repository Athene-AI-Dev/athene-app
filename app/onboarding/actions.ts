"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/**
 * Called from the onboarding welcome page on first load.
 * Idempotently provisions a morning_briefing automation for the user and
 * registers a QStash cron schedule (daily 7 AM UTC).
 */
export async function bootstrapOnboarding(): Promise<{ connectionCount: number }> {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId) return { connectionCount: 0 };

  // Resolve internal UUIDs
  const { data: orgData } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", clerkOrgId)
    .maybeSingle();

  const { data: memberData } = await supabaseAdmin
    .from("org_members")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .eq("org_id", orgData?.id ?? "")
    .maybeSingle();

  const internalOrgId = orgData?.id as string | undefined;
  const internalUserId = memberData?.id as string | undefined;

  if (!internalOrgId || !internalUserId) return { connectionCount: 0 };

  // Count existing connections
  const { count: connectionCount } = await supabaseAdmin
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("org_id", internalOrgId);

  // Idempotently create morning briefing automation
  const { data: existing } = await supabaseAdmin
    .from("automations")
    .select("id, qstash_schedule_id")
    .eq("org_id", internalOrgId)
    .eq("user_id", internalUserId)
    .eq("type", "morning_briefing")
    .maybeSingle();

  if (!existing) {
    const { data: automation } = await supabaseAdmin
      .from("automations")
      .insert({
        org_id: internalOrgId,
        user_id: internalUserId,
        type: "morning_briefing",
        status: "active",
        cron_expression: "0 7 * * *",
        config: { delivery: "in_app" },
      })
      .select("id")
      .maybeSingle();

    if (automation?.id && APP_URL) {
      try {
        const schedule = await qstash.schedules.create({
          destination: `${APP_URL}/api/worker/morning-briefing`,
          cron: "0 7 * * *",
          body: JSON.stringify({ org_id: internalOrgId, user_id: internalUserId, triggered_by: "cron" }),
        });
        await supabaseAdmin
          .from("automations")
          .update({ qstash_schedule_id: schedule.scheduleId })
          .eq("id", automation.id);
      } catch (err) {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, "[bootstrap] QStash schedule registration failed (non-fatal)");
      }
    }
  }

  return { connectionCount: connectionCount ?? 0 };
}

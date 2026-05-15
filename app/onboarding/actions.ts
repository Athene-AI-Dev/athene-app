"use server";

import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { qstash } from "@/lib/qstash/client";
import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/**
 * Called from the onboarding welcome page on first load.
 * Idempotently provisions a morning_briefing automation for the user and
 * registers a QStash cron schedule (daily 7 AM UTC).
 *
 * Calls resolveUserAccess() first to guarantee the org and member rows exist
 * in Supabase before any queries — prevents the race condition where the
 * welcome page loads before middleware has provisioned the DB records.
 */
export async function bootstrapOnboarding(): Promise<{ connectionCount: number; error?: string }> {
  const { userId: clerkUserId, orgId: clerkOrgId, orgRole } = await auth();
  if (!clerkUserId || !clerkOrgId) return { connectionCount: 0 };

  // Trigger auto-provisioning — creates org + member rows if this is the first request.
  // resolveUserAccess is idempotent; safe to call multiple times.
  const access = await resolveUserAccess(clerkUserId, clerkOrgId, orgRole);
  const internalOrgId = access.internal_org_id;
  const internalUserId = access.internal_user_id;

  if (!internalOrgId || !internalUserId) {
    logger.warn({ clerkUserId, clerkOrgId }, "[bootstrap] Could not resolve internal IDs after provisioning");
    return { connectionCount: 0, error: "provisioning_failed" };
  }

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
    const { data: automation, error: insertErr } = await supabaseAdmin
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

    if (insertErr) {
      logger.error({ err: insertErr.message, internalOrgId }, "[bootstrap] Failed to insert morning_briefing automation");
    } else if (automation?.id && APP_URL) {
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
        logger.info({ internalOrgId, scheduleId: schedule.scheduleId }, "[bootstrap] Morning briefing QStash cron registered");
      } catch (err) {
        // Non-fatal: DB row exists. User can activate the cron via automations settings.
        logger.warn({ err: err instanceof Error ? err.message : String(err), internalOrgId }, "[bootstrap] QStash schedule registration failed (non-fatal)");
      }
    }
  }

  return { connectionCount: connectionCount ?? 0 };
}

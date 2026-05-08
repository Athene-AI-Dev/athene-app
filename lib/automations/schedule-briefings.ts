import { supabaseAdmin } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";
import { BRIEFING_HOUR_LOCAL } from "./constants";


/**
 * Shape of a row returned from the automations + org_members join.
 * automations: id, org_id, user_id, type, status
 * org_members : timezone, briefing_delivery
 */
type BriefingAutomation = {
  id: string;
  org_id: string;
  user_id: string;
  org_members: {
    timezone: string | null;
    briefing_delivery: string | null;
  } | {
    timezone: string | null;
    briefing_delivery: string | null;
  }[] | null;
};

function getBriefingEndpoint() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/worker/morning-briefing`;
}

/**
 * Converts a user's local date/time into UTC.
 * Example: "2026-04-29 07:00 Asia/Kolkata" -> UTC Date object.
 */
function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
) {
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  for (let i = 0; i < 2; i++) {
    const parts = getLocalParts(utcDate, timeZone);

    const expected = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0
    );

    utcDate = new Date(utcDate.getTime() + expected - actual);
  }

  return utcDate;
}

/**
 * Gets local date/time parts for a UTC date in a specific timezone.
 */
function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

/**
 * Calculates the next 7 AM in the user's timezone,
 * returned as a UTC Date.
 *
 * Uses strict `<` so users at exactly 7:00:00 AM are NOT pushed to the next day.
 */
export function getNextLocal7AmUtc(timeZone: string, now = new Date()) {
  const localNow = getLocalParts(now, timeZone);

  let scheduledUtc = zonedTimeToUtc(
    timeZone,
    localNow.year,
    localNow.month,
    localNow.day,
    BRIEFING_HOUR_LOCAL,
    0
  );


  if (scheduledUtc <= now) {

    const nextLocalDay = new Date(
      Date.UTC(localNow.year, localNow.month - 1, localNow.day + 1)
    );

    scheduledUtc = zonedTimeToUtc(
      timeZone,
      nextLocalDay.getUTCFullYear(),
      nextLocalDay.getUTCMonth() + 1,
      nextLocalDay.getUTCDate(),
      BRIEFING_HOUR_LOCAL,
      0
    );

  }

  return scheduledUtc;
}

/**
 * Schedules morning briefings for all opted-in users.
 *
 * Flow:
 * 1. Query `automations` for rows where type='morning_briefing' AND status='active'
 *    (this is the source of truth for opt-in — briefing_enabled on org_members
 *     is the user-facing toggle; the automations row is created when they enable it)
 * 2. Join org_members to get timezone + briefing_delivery preference
 * 3. Compute each user's next local 7 AM
 * 4. Schedule a QStash delayed job to /api/worker/morning-briefing
 */
export async function scheduleMorningBriefings(now = new Date()) {
  try {
    const { data: automations, error } = await supabaseAdmin
      .from("automations")
      .select("id, org_id, user_id, org_members(timezone, briefing_delivery)")
      .eq("type", "morning_briefing")
      .eq("status", "active");

    if (error) throw error;

    const endpoint = getBriefingEndpoint();

    for (const automation of (automations || []) as BriefingAutomation[]) {
      const memberInfo = Array.isArray(automation.org_members) 
        ? automation.org_members[0] 
        : automation.org_members;

      const timezone = memberInfo?.timezone || "UTC";
      const deliveryMethod = memberInfo?.briefing_delivery || "in_app";
      const scheduledFor = getNextLocal7AmUtc(timezone, now);
      const delaySeconds = Math.max(
        0,
        Math.ceil((scheduledFor.getTime() - now.getTime()) / 1000)
      );

      await qstash.publishJSON({
        url: endpoint,
        body: {
          userId: automation.user_id,
          orgId: automation.org_id,
          automationId: automation.id,
          timezone,
          deliveryMethod,
          scheduledFor: scheduledFor.toISOString(),
        },
        delay: delaySeconds,
      });
    }

    return {
      success: true,
      scheduledCount: automations?.length || 0,
    };
  } catch (error) {
    console.error("[schedule-briefings] Failed to schedule briefings:", error);

    return {
      success: false,
      scheduledCount: 0,
    };
  }
}
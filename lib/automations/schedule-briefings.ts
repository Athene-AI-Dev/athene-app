import { supabaseAdmin } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

type BriefingUser = {
  id: string;
  timezone?: string | null;
};

function getBriefingEndpoint() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/automations/morning-briefing`;
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
 */
export function getNextLocal7AmUtc(timeZone: string, now = new Date()) {
  const localNow = getLocalParts(now, timeZone);

  let scheduledUtc = zonedTimeToUtc(
    timeZone,
    localNow.year,
    localNow.month,
    localNow.day,
    7,
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
      7,
      0
    );
  }

  return scheduledUtc;
}

/**
 * Schedules morning briefings for all opted-in users.
 *
 * Flow:
 * 1. Find users where briefing_enabled = true
 * 2. Compute each user's next local 7 AM
 * 3. Schedule QStash delayed job for that time
 */
export async function scheduleMorningBriefings(now = new Date()) {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, timezone")
      .eq("briefing_enabled", true);

    if (error) throw error;

    const endpoint = getBriefingEndpoint();

    for (const user of (users || []) as BriefingUser[]) {
      const timezone = user.timezone || "UTC";
      const scheduledFor = getNextLocal7AmUtc(timezone, now);
      const delaySeconds = Math.max(
        0,
        Math.ceil((scheduledFor.getTime() - now.getTime()) / 1000)
      );

      await qstash.publishJSON({
        url: endpoint,
        body: {
          userId: user.id,
          timezone,
          scheduledFor: scheduledFor.toISOString(),
        },
        delay: `${delaySeconds}s`,
      });
    }

    return {
      success: true,
      scheduledCount: users?.length || 0,
    };
  } catch (error) {
    console.error("[schedule-briefings] Failed to schedule briefings:", error);

    return {
      success: false,
      scheduledCount: 0,
    };
  }
}
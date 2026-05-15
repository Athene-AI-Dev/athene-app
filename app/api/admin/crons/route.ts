// ============================================================
// POST /api/admin/crons
// Idempotently (re-)registers system-level QStash cron schedules.
// Crons are also auto-registered on every server startup via instrumentation.ts.
// Use this endpoint to force re-registration without restarting the server, or
// to verify that all schedules are live.
//
// Admin-only. Returns the list of registered schedule IDs.
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mapRole } from '@/lib/auth/clerk';
import { qstash } from '@/lib/qstash/client';
import { logger } from '@/lib/logger';
import { SYSTEM_CRON_DEFS } from '@/lib/qstash/system-crons';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST() {
  const { userId, orgRole } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  if (mapRole(orgRole ?? undefined) !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  if (!APP_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set' }, { status: 500 });
  }

  const results: Array<{ name: string; scheduleId: string; status: 'ok' | 'error'; error?: string }> = [];

  for (const def of SYSTEM_CRON_DEFS) {
    try {
      const schedule = await qstash.schedules.create({
        destination: `${APP_URL}${def.path}`,
        cron: def.cron,
        body: JSON.stringify({}),
      });

      results.push({ name: def.name, scheduleId: schedule.scheduleId, status: 'ok' });
      logger.info({ name: def.name, scheduleId: schedule.scheduleId }, '[admin/crons] System cron registered');
    } catch (err: any) {
      results.push({ name: def.name, scheduleId: '', status: 'error', error: err.message });
      logger.error({ name: def.name, err: err.message }, '[admin/crons] Failed to register system cron');
    }
  }

  return NextResponse.json({ results });
}

export async function GET() {
  const { userId, orgRole } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  if (mapRole(orgRole ?? undefined) !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  try {
    const schedules = await qstash.schedules.list();
    const systemDestinations = new Set(
      SYSTEM_CRON_DEFS.map((def) => `${APP_URL}${def.path}`)
    );
    const systemSchedules = schedules.filter((s: any) => systemDestinations.has(s.destination));
    return NextResponse.json({ schedules: systemSchedules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

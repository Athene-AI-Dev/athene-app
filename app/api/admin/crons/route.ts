// ============================================================
// POST /api/admin/crons
// Idempotently registers system-level QStash cron schedules.
// Call once after each deploy. Safe to re-run — existing
// schedules with the same destination are replaced, not doubled.
//
// Admin-only. Returns the list of registered schedule IDs.
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mapRole } from '@/lib/auth/clerk';
import { qstash } from '@/lib/qstash/client';
import { logger } from '@/lib/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

interface SystemCron {
  name: string;
  destination: string;
  cron: string;
  body?: Record<string, unknown>;
}

const SYSTEM_CRONS: SystemCron[] = [
  {
    name: 'hitl-cleanup',
    destination: `${APP_URL}/api/worker/hitl-cleanup`,
    cron: '*/30 * * * *', // every 30 minutes
    body: {},
  },
  {
    name: 'checkpoint-prune',
    destination: `${APP_URL}/api/worker/checkpoint-prune`,
    cron: '0 2 * * *', // daily at 2 AM UTC
    body: {},
  },
];

export async function POST() {
  const { userId, orgRole } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });
  if (mapRole(orgRole ?? undefined) !== 'admin') return new NextResponse('Forbidden', { status: 403 });

  if (!APP_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set' }, { status: 500 });
  }

  const results: Array<{ name: string; scheduleId: string; status: 'ok' | 'error'; error?: string }> = [];

  for (const cron of SYSTEM_CRONS) {
    try {
      const schedule = await qstash.schedules.create({
        destination: cron.destination,
        cron: cron.cron,
        body: cron.body ? JSON.stringify(cron.body) : undefined,
      });

      results.push({ name: cron.name, scheduleId: schedule.scheduleId, status: 'ok' });
      logger.info({ name: cron.name, scheduleId: schedule.scheduleId }, '[admin/crons] System cron registered');
    } catch (err: any) {
      results.push({ name: cron.name, scheduleId: '', status: 'error', error: err.message });
      logger.error({ name: cron.name, err: err.message }, '[admin/crons] Failed to register system cron');
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
    const systemDestinations = new Set(SYSTEM_CRONS.map((c) => c.destination));
    const systemSchedules = schedules.filter((s: any) => systemDestinations.has(s.destination));
    return NextResponse.json({ schedules: systemSchedules });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

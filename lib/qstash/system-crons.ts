// ============================================================
// lib/qstash/system-crons.ts — System-level QStash cron definitions
//
// Single source of truth for the crons that must run on every deploy.
// Imported by:
//   - instrumentation.ts (auto-registers on server startup)
//   - app/api/admin/crons/route.ts (manual admin re-register endpoint)
//
// Registration is idempotent — QStash replaces existing schedules with the
// same destination rather than creating duplicates.
// ============================================================

import { qstash } from './client'
import { logger } from '@/lib/logger'

export interface SystemCronDef {
  name: string
  path: string       // path appended to NEXT_PUBLIC_APP_URL
  cron: string       // standard cron expression
}

export const SYSTEM_CRON_DEFS: SystemCronDef[] = [
  {
    name: 'hitl-cleanup',
    path: '/api/worker/hitl-cleanup',
    cron: '*/30 * * * *', // every 30 minutes
  },
  {
    name: 'checkpoint-prune',
    path: '/api/worker/checkpoint-prune',
    cron: '0 2 * * *', // daily at 2 AM UTC
  },
]

/**
 * Idempotently registers all system crons with QStash.
 * Safe to call on every server startup — existing schedules with the same
 * destination are replaced, not doubled.
 *
 * No-ops silently if NEXT_PUBLIC_APP_URL is not set (e.g. local dev without
 * a tunnelled URL). Each cron failure is logged but does NOT throw so that
 * a single failed registration doesn't block server startup.
 */
export async function registerSystemCrons(): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  if (!APP_URL) {
    logger.warn({}, '[system-crons] NEXT_PUBLIC_APP_URL not set — skipping cron registration (set it to enable automatic scheduling)')
    return
  }

  for (const def of SYSTEM_CRON_DEFS) {
    try {
      const schedule = await qstash.schedules.create({
        destination: `${APP_URL}${def.path}`,
        cron: def.cron,
        body: JSON.stringify({}),
      })
      logger.info({ name: def.name, scheduleId: schedule.scheduleId }, '[system-crons] Registered')
    } catch (err: any) {
      logger.error({ name: def.name, err: err.message }, '[system-crons] Registration failed')
    }
  }
}

export const dynamic = 'force-dynamic';

// ============================================================
// app/api/health/route.ts — Health check endpoint
//
// Checks: DB connectivity, embedding provider reachability,
//         QStash connectivity.
//
// Used by: uptime monitors, Kubernetes probes, load balancers.
// Returns 200 when all critical services are up; 503 otherwise.
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  db: 'ok' | 'fail'
  embedder: 'ok' | 'fail'
  qstash: 'ok' | 'fail'
  latency_ms: number
  ts: string
  errors: string[]
}

async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .limit(1)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function checkEmbedder(): Promise<{ ok: boolean; error?: string }> {
  // Ping the configured embedding provider with a one-word query
  try {
    const jinaKey = process.env.JINA_API_KEY
    if (jinaKey) {
      const res = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jinaKey}` },
        body: JSON.stringify({ model: 'jina-embeddings-v3', input: ['ping'], dimensions: 768, task: 'retrieval.passage' }),
        signal: AbortSignal.timeout(8000),
      })
      return res.ok ? { ok: true } : { ok: false, error: `Jina HTTP ${res.status}` }
    }
    // No provider configured — mark as degraded rather than failed
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function checkQStash(): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = process.env.QSTASH_TOKEN
    if (!token) return { ok: true } // not configured — skip
    const res = await fetch('https://qstash.upstash.io/v2/queues', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok || res.status === 404 ? { ok: true } : { ok: false, error: `QStash HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(): Promise<Response> {
  const start = Date.now()

  const [dbResult, embedderResult, qstashResult] = await Promise.all([
    checkDb(),
    checkEmbedder(),
    checkQStash(),
  ])

  const latency_ms = Date.now() - start
  const errors: string[] = []
  if (!dbResult.ok && dbResult.error) errors.push(`db: ${dbResult.error}`)
  if (!embedderResult.ok && embedderResult.error) errors.push(`embedder: ${embedderResult.error}`)
  if (!qstashResult.ok && qstashResult.error) errors.push(`qstash: ${qstashResult.error}`)

  const allOk = dbResult.ok && embedderResult.ok && qstashResult.ok
  const dbDown = !dbResult.ok

  const body: HealthStatus = {
    status: allOk ? 'ok' : dbDown ? 'down' : 'degraded',
    db: dbResult.ok ? 'ok' : 'fail',
    embedder: embedderResult.ok ? 'ok' : 'fail',
    qstash: qstashResult.ok ? 'ok' : 'fail',
    latency_ms,
    ts: new Date().toISOString(),
    errors,
  }

  // 200 for ok/degraded (non-DB failures), 503 only if DB is unreachable
  const httpStatus = dbDown ? 503 : 200
  return NextResponse.json(body, { status: httpStatus })
}

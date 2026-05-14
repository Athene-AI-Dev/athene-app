import { Receiver } from '@upstash/qstash';
import { redis } from '@/lib/redis/client';

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

// Build receiver lazily — only when both keys are present.
// Top-level throws would crash any route that imports this module.
const receiver =
  currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;

/**
 * Validates the Upstash signature of an incoming webhook request.
 *
 * In local dev (no signing keys configured), a request carrying the
 * `x-dev-internal-bypass` header is accepted so that the briefing
 * route can invoke the worker directly without QStash.
 *
 * MUST be called before fulfilling any background job worker request.
 */
export async function verifyQStashSignature(req: Request): Promise<boolean> {
  // ── Dev bypass: allow direct in-process calls when QStash is not configured ──
  if (!receiver) {
    const bypass = req.headers.get('x-dev-internal-bypass');
    if (bypass === '1') {
      console.warn('[QStash] QSTASH signing keys absent — accepting x-dev-internal-bypass (local dev only)');
      return true;
    }
    console.error('[QStash] Signature verification skipped: QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY not set');
    return false;
  }

  try {
    const signature = req.headers.get('upstash-signature');
    if (!signature) {
      return false;
    }

    // We clone the request so that consuming its raw text doesn't
    // prevent the downstream route logic from parsing JSON later.
    const body = await req.clone().text();

    const isValid = await receiver.verify({
      signature,
      body,
      url: req.url,
    });

    return isValid;
  } catch (err) {
    console.error('[QStash] Signature verification failed:', err);
    return false;
  }
}

/**
 * Checks if a QStash message has already been processed using Redis.
 * Returns true if this is the first time we see this message, false otherwise.
 * 
 * TTL: 24 hours (prevents infinite growth while covering standard retry windows)
 */
export async function checkIdempotency(req: Request): Promise<boolean> {
  try {
    const msgId = req.headers.get('upstash-message-id');
    if (!msgId) {
      // If there's no message ID, we can't reliably dedup. 
      // In production workers, this header should always be present from QStash.
      return true;
    }

    const key = `qstash_job:${msgId}`;
    // NX: Set only if the key does not exist.
    // EX: Set expiration to 24 hours.
    const result = await redis.set(key, '1', { nx: true, ex: 86400 });

    return result === 'OK';
  } catch (err) {
    console.error('[QStash] Idempotency check failed (Redis error):', err);
    // Fail-open: if Redis is down, we allow the request but risk double-processing
    // rather than blocking all background work.
    return true;
  }
}

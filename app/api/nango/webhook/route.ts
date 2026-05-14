// ============================================================
// POST /api/nango/webhook
//
// Receives webhook events from Nango when a provider sync
// completes or a connection is deleted.
//
// sync.completed  → dispatch /api/worker/index via QStash
// connection.deleted → clean up connections + nango_connections rows
//
// HMAC-SHA256 signature verified against NANGO_SECRET_KEY before
// any processing. Returns HTTP 200 for all handled and unhandled
// event types so Nango does not retry on unrecognised events.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dispatchThrottled } from "@/lib/qstash/client";
import { logger } from "@/lib/logger";

const NANGO_SECRET = process.env.NANGO_SECRET_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// ---- Signature verification -----------------------------------

function verifyNangoSignature(rawBody: string, signature: string): boolean {
  if (!NANGO_SECRET) {
    logger.error({}, "[nango-webhook] NANGO_SECRET_KEY not set — rejecting all webhook requests");
    return false;
  }
  try {
    const expected = createHmac("sha256", NANGO_SECRET).update(rawBody).digest("hex");
    // timingSafeEqual requires same-length Buffers
    const expectedBuf = Buffer.from(expected, "hex");
    const signatureBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

// ---- Main handler ---------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Read raw body once — needed for both HMAC and JSON parse
  const rawBody = await req.text();
  const signature = req.headers.get("x-nango-signature") ?? "";

  if (!verifyNangoSignature(rawBody, signature)) {
    logger.warn({ signature: signature.slice(0, 16) }, "[nango-webhook] Invalid or missing signature — rejecting");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.error({}, "[nango-webhook] Failed to parse JSON body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  const eventType: string = payload.type ?? "";
  const connectionId: string = payload.connectionId ?? "";
  const providerConfigKey: string = payload.providerConfigKey ?? "";

  logger.info({ eventType, connectionId, providerConfigKey }, "[nango-webhook] Event received");

  // 2. Dispatch by event type
  if (eventType === "sync.completed") {
    await handleSyncCompleted(connectionId, providerConfigKey);
  } else if (eventType === "connection.deleted") {
    await handleConnectionDeleted(connectionId, providerConfigKey);
  } else {
    logger.info({ eventType }, "[nango-webhook] Unhandled event type — ignoring");
  }

  // Always 200 — Nango retries on non-2xx responses
  return new NextResponse(null, { status: 200 });
}

// ---- Event handlers -------------------------------------------

async function handleSyncCompleted(connectionId: string, providerConfigKey: string) {
  if (!connectionId) {
    logger.warn({}, "[nango-webhook] sync.completed missing connectionId");
    return;
  }

  // Resolve internal org UUID and source_type from the connections table
  const { data: conn, error } = await supabaseAdmin
    .from("connections")
    .select("org_id, source_type")
    .eq("nango_connection_id", connectionId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error.message, connectionId }, "[nango-webhook] Failed to resolve connection");
    return;
  }

  if (!conn) {
    logger.warn({ connectionId }, "[nango-webhook] sync.completed for unknown connection — skipping");
    return;
  }

  // Update sync timestamp in nango_connections
  await supabaseAdmin
    .from("nango_connections")
    .update({ sync_status: "connected", last_synced_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("provider_config_key", providerConfigKey);

  // Dispatch re-index job via QStash (throttled per org × source_type)
  const url = `${APP_URL}/api/worker/index`;
  const { dispatched, msgId } = await dispatchThrottled({
    orgId: conn.org_id,
    sourceType: conn.source_type,
    url,
    body: {
      org_id: conn.org_id,
      connection_id: connectionId,
      source_type: conn.source_type,
      trigger: "nango_sync",
    },
  });

  if (dispatched) {
    logger.info({ connectionId, org_id: conn.org_id, msgId }, "[nango-webhook] Re-index job dispatched");
  } else {
    logger.warn({ connectionId, org_id: conn.org_id }, "[nango-webhook] Re-index job throttled — queued as pending");
  }
}

async function handleConnectionDeleted(connectionId: string, providerConfigKey: string) {
  if (!connectionId) {
    logger.warn({}, "[nango-webhook] connection.deleted missing connectionId");
    return;
  }

  // Delete from connections table — cascade removes documents + embeddings
  const { error: connErr } = await supabaseAdmin
    .from("connections")
    .delete()
    .eq("nango_connection_id", connectionId);

  if (connErr) {
    logger.error({ err: connErr.message, connectionId }, "[nango-webhook] Failed to delete connections row");
  }

  // Delete from nango_connections mapping table
  const { error: nangoErr } = await supabaseAdmin
    .from("nango_connections")
    .delete()
    .eq("connection_id", connectionId)
    .eq("provider_config_key", providerConfigKey);

  if (nangoErr) {
    logger.error({ err: nangoErr.message, connectionId }, "[nango-webhook] Failed to delete nango_connections row");
  }

  logger.info({ connectionId, providerConfigKey }, "[nango-webhook] Connection deleted and cleaned up");
}

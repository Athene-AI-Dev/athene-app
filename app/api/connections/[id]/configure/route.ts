import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { updateConnectionNangoMetadata } from "@/lib/nango/client";
import { dispatchThrottled } from "@/lib/qstash/client";
import { logger } from "@/lib/logger";

interface Params { params: Promise<{ id: string }> }

const SNOWFLAKE_IDENT_RE = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;
const BIGQUERY_IDENT_RE  = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;        // dataset.table
const REDSHIFT_IDENT_RE  = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?$/;     // schema.table or table

/**
 * PATCH /api/connections/[id]/configure
 *
 * Saves the user's data source selection and dispatches a sync job.
 * The [id] param is the Supabase connections.id UUID.
 *
 * Body (Google Drive):  { provider: 'google_drive', selectedFolderIds: string[] }
 * Body (Snowflake):     { provider: 'snowflake',    allowlist: string[] }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  if (mapRole(orgRole ?? undefined) !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { id: connectionId } = await params;

  let body: { provider?: string; selectedFolderIds?: string[]; allowlist?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, selectedFolderIds, allowlist } = body;
  if (!provider) return NextResponse.json({ error: "provider is required" }, { status: 400 });

  // Resolve Clerk orgId → internal UUID
  const { data: orgData, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle();

  if (orgErr || !orgData) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const internalOrgId = orgData.id as string;

  // Verify connection belongs to this org
  const { data: conn, error: connErr } = await supabaseAdmin
    .from("connections")
    .select("id, provider, source_type, nango_connection_id, metadata, department_id")
    .eq("id", connectionId)
    .eq("org_id", internalOrgId)
    .maybeSingle();

  if (connErr || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const existingMeta = (conn.metadata as Record<string, unknown>) ?? {};

  // ── Google Drive ──────────────────────────────────────────
  if (provider === "google_drive") {
    if (!Array.isArray(selectedFolderIds) || selectedFolderIds.length === 0) {
      return NextResponse.json({ error: "selectedFolderIds must be a non-empty array" }, { status: 400 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("connections")
      .update({ metadata: { ...existingMeta, selected_folder_ids: selectedFolderIds } })
      .eq("id", connectionId);

    if (updateErr) {
      logger.error({ connectionId, err: updateErr.message }, "[configure] Failed to save Drive selection");
      return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
    }

    await supabaseAdmin.from("connections").update({ status: "syncing" }).eq("id", connectionId);

    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
    const { dispatched } = await dispatchThrottled({
      orgId: internalOrgId,
      sourceType: conn.source_type as string,
      url: workerUrl,
      body: {
        orgId: internalOrgId,
        connectionId,
        nangoConnectionId: conn.nango_connection_id,
        provider: conn.provider,
        sourceType: conn.source_type,
        departmentId: conn.department_id ?? null,
      },
    });

    logger.info({ connectionId, folderCount: selectedFolderIds.length }, "[configure] Drive configured and sync dispatched");
    return NextResponse.json({ success: true, dispatched });
  }

  // ── Snowflake ─────────────────────────────────────────────
  if (provider === "snowflake") {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return NextResponse.json({ error: "allowlist must be a non-empty array" }, { status: 400 });
    }

    const invalid = allowlist.filter((t) => !SNOWFLAKE_IDENT_RE.test(t));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid table identifiers (must be DATABASE.SCHEMA.TABLE): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    // 1. Save to Supabase connections.metadata
    const { error: updateErr } = await supabaseAdmin
      .from("connections")
      .update({ metadata: { ...existingMeta, allowlist } })
      .eq("id", connectionId);

    if (updateErr) {
      logger.error({ connectionId, err: updateErr.message }, "[configure] Failed to save Snowflake allowlist");
      return NextResponse.json({ error: "Failed to save allowlist" }, { status: 500 });
    }

    // 2. Update Nango metadata so the worker can read allowlist via getConnection().metadata
    try {
      await updateConnectionNangoMetadata(
        conn.nango_connection_id as string,
        "snowflake",
        internalOrgId,
        { allowlist }
      );
    } catch (nangoErr: any) {
      // Non-fatal: Supabase save succeeded. Worker can still read from Supabase metadata.
      logger.warn({ connectionId, err: nangoErr.message }, "[configure] Nango metadata update failed (non-fatal)");
    }

    await supabaseAdmin.from("connections").update({ status: "syncing" }).eq("id", connectionId);

    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
    const { dispatched } = await dispatchThrottled({
      orgId: internalOrgId,
      sourceType: conn.source_type as string,
      url: workerUrl,
      body: {
        orgId: internalOrgId,
        connectionId,
        nangoConnectionId: conn.nango_connection_id,
        provider: conn.provider,
        sourceType: conn.source_type,
        departmentId: conn.department_id ?? null,
      },
    });

    logger.info({ connectionId, tableCount: allowlist.length }, "[configure] Snowflake configured and sync dispatched");
    return NextResponse.json({ success: true, dispatched });
  }

  // ── BigQuery ──────────────────────────────────────────────
  if (provider === "bigquery") {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return NextResponse.json({ error: "allowlist must be a non-empty array" }, { status: 400 });
    }

    const invalid = allowlist.filter((t) => !BIGQUERY_IDENT_RE.test(t));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid table identifiers (must be DATASET.TABLE): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("connections")
      .update({ metadata: { ...existingMeta, allowlist } })
      .eq("id", connectionId);

    if (updateErr) {
      logger.error({ connectionId, err: updateErr.message }, "[configure] Failed to save BigQuery allowlist");
      return NextResponse.json({ error: "Failed to save allowlist" }, { status: 500 });
    }

    try {
      await updateConnectionNangoMetadata(
        conn.nango_connection_id as string,
        "bigquery",
        internalOrgId,
        { allowlist }
      );
    } catch (nangoErr: any) {
      logger.warn({ connectionId, err: nangoErr.message }, "[configure] Nango metadata update failed (non-fatal)");
    }

    await supabaseAdmin.from("connections").update({ status: "syncing" }).eq("id", connectionId);

    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
    const { dispatched } = await dispatchThrottled({
      orgId: internalOrgId,
      sourceType: conn.source_type as string,
      url: workerUrl,
      body: {
        orgId: internalOrgId,
        connectionId,
        nangoConnectionId: conn.nango_connection_id,
        provider: conn.provider,
        sourceType: conn.source_type,
        departmentId: conn.department_id ?? null,
      },
    });

    logger.info({ connectionId, tableCount: allowlist.length }, "[configure] BigQuery configured and sync dispatched");
    return NextResponse.json({ success: true, dispatched });
  }

  // ── Redshift ──────────────────────────────────────────────
  if (provider === "redshift") {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return NextResponse.json({ error: "allowlist must be a non-empty array" }, { status: 400 });
    }

    const invalid = allowlist.filter((t) => !REDSHIFT_IDENT_RE.test(t));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid table identifiers (must be SCHEMA.TABLE or TABLE): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabaseAdmin
      .from("connections")
      .update({ metadata: { ...existingMeta, allowlist } })
      .eq("id", connectionId);

    if (updateErr) {
      logger.error({ connectionId, err: updateErr.message }, "[configure] Failed to save Redshift allowlist");
      return NextResponse.json({ error: "Failed to save allowlist" }, { status: 500 });
    }

    try {
      await updateConnectionNangoMetadata(
        conn.nango_connection_id as string,
        "redshift",
        internalOrgId,
        { allowlist }
      );
    } catch (nangoErr: any) {
      logger.warn({ connectionId, err: nangoErr.message }, "[configure] Nango metadata update failed (non-fatal)");
    }

    await supabaseAdmin.from("connections").update({ status: "syncing" }).eq("id", connectionId);

    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/worker/nango-fetch`;
    const { dispatched } = await dispatchThrottled({
      orgId: internalOrgId,
      sourceType: conn.source_type as string,
      url: workerUrl,
      body: {
        orgId: internalOrgId,
        connectionId,
        nangoConnectionId: conn.nango_connection_id,
        provider: conn.provider,
        sourceType: conn.source_type,
        departmentId: conn.department_id ?? null,
      },
    });

    logger.info({ connectionId, tableCount: allowlist.length }, "[configure] Redshift configured and sync dispatched");
    return NextResponse.json({ success: true, dispatched });
  }

  return NextResponse.json({ error: "Unsupported provider for configuration" }, { status: 400 });
}

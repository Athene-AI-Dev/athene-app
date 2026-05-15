import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { mapRole } from "@/lib/auth/clerk";
import { supabaseAdmin } from "@/lib/supabase/server";
import { listDriveFiles, searchDrive } from "@/lib/integrations/google/drive-fetcher";
import { listSnowflakeTables } from "@/lib/integrations/snowflake/schema-fetcher";
import { logger } from "@/lib/logger";

interface Params { params: Promise<{ id: string }> }

/**
 * GET /api/connections/[id]/browse
 *
 * Lists files from Google Drive or tables from Snowflake for the given connection.
 * The [id] param is the Supabase connections.id UUID.
 *
 * Query params:
 *   ?type=drive_files       - Google Drive listing (default for google_drive connections)
 *   ?folderId=xxx           - Scope Drive listing to a specific folder
 *   ?pageToken=xxx          - Drive pagination token
 *   ?search=xxx             - Drive full-text search (overrides folderId)
 *   ?type=snowflake_tables  - Snowflake table list (default for snowflake connections)
 */
export async function GET(request: Request, { params }: Params) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  if (mapRole(orgRole ?? undefined) !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { id: connectionId } = await params;
  const url = new URL(request.url);
  const browseType = url.searchParams.get("type");
  const folderId = url.searchParams.get("folderId") ?? undefined;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

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
    .select("id, provider, nango_connection_id, metadata")
    .eq("id", connectionId)
    .eq("org_id", internalOrgId)
    .maybeSingle();

  if (connErr || !conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const provider = conn.provider as string;
  const nangoConnectionId = conn.nango_connection_id as string;

  // ── Google Drive ──────────────────────────────────────────
  if (browseType === "drive_files" || (!browseType && provider === "google_drive")) {
    try {
      let result;
      if (search) {
        result = await searchDrive(nangoConnectionId, internalOrgId, search, pageToken);
      } else {
        result = await listDriveFiles(nangoConnectionId, internalOrgId, folderId, pageToken);
      }
      return NextResponse.json({ files: result.files, nextPageToken: result.nextPageToken ?? null });
    } catch (err: any) {
      logger.error({ connectionId, err: err.message }, "[browse] Drive listing failed");
      return NextResponse.json({ error: err.message ?? "Drive listing failed" }, { status: 500 });
    }
  }

  // ── Snowflake ─────────────────────────────────────────────
  if (browseType === "snowflake_tables" || (!browseType && provider === "snowflake")) {
    try {
      const tables = await listSnowflakeTables(nangoConnectionId, internalOrgId);
      return NextResponse.json({ tables });
    } catch (err: any) {
      logger.error({ connectionId, err: err.message }, "[browse] Snowflake table listing failed");
      // Surface permission errors clearly rather than 500
      return NextResponse.json(
        { tables: [], error: err.message ?? "Snowflake table listing failed" },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ error: "Unsupported browse type for this provider" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getContextFromHeaders } from "@/lib/supabase/rls-client";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/files/upload
 *
 * Accepts a multipart/form-data request with a single "file" field.
 * 1. Resolves the internal Supabase org UUID from the Clerk org ID.
 * 2. Uploads the file to Supabase Storage (`documents` bucket).
 * 3. Ensures a "direct_upload" connection row exists for the org.
 * 4. Inserts a metadata row into the `documents` table.
 *
 * Returns the created document record.
 */
export async function POST(req: NextRequest) {
  const context = getContextFromHeaders(await headers());
  if (!context?.org_id || !context?.user_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // context.user_id is already the internal Supabase UUID (resolved by middleware)
  const userId = context.user_id;

  try {
    // --- 1. Resolve org + ensure connection in a single DB transaction ---
    const { data: uploadCtx, error: ctxErr } = await supabaseAdmin.rpc(
      "ensure_upload_connection",
      { p_clerk_org_id: context.org_id }
    );

    if (ctxErr || !uploadCtx) {
      console.error("[files/upload] RPC ensure_upload_connection failed:", ctxErr?.message);
      return NextResponse.json(
        { error: `Context resolution failed: ${ctxErr?.message || "Unknown error"}` },
        { status: 500 },
      );
    }

    const orgId = uploadCtx.org_id as string;
    const connId = uploadCtx.connection_id as string;

    // Verify the member UUID actually exists in org_members (may be stale from cache)
    let ownerId: string | null = userId;
    const { data: memberCheck } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (!memberCheck) {
      // Stale user_id — try to find by org instead
      const { data: orgMember } = await supabaseAdmin
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .limit(1)
        .maybeSingle();
      ownerId = orgMember?.id ?? null;
    }

    // --- 2. Upload to Supabase Storage ---
    const storagePath = `${orgId}/${Date.now()}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabaseAdmin.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("[files/upload] Storage error:", storageError.message);
      return NextResponse.json(
        { error: `Storage upload failed: ${storageError.message}` },
        { status: 500 },
      );
    }

    // --- 3. Insert document metadata ---
    const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
    const sizeMB = file.size / (1024 * 1024);
    const sizeStr =
      sizeMB >= 1
        ? `${sizeMB.toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;

    const { data: doc, error: docErr } = await supabaseAdmin
     .from("documents")
     .insert({
        org_id: orgId,
        connection_id: connId,
        external_id: storagePath,
        title: file.name,
        source_type: "direct_upload",
        owner_user_id: null,
        visibility: "restricted",
        mime_type: file.type || "application/octet-stream",
        metadata: { size: sizeStr, type: ext, uploaded_by: ownerId },
      })
      .select("id, title, mime_type, metadata, created_at")
      .single();

    if (docErr || !doc) {
      console.error("[files/upload] Document error:", docErr?.message);
      return NextResponse.json(
        { error: `Document insert failed: ${docErr?.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: doc.id,
      name: file.name,
      type: ext,
      size: sizeStr,
      status: "Indexing",
      risk: "Low",
      date: "Just now",
      storagePath,
    });
  } catch (err: any) {
    console.error("[files/upload] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

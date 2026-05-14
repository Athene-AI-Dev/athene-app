import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getContextFromHeaders } from "@/lib/supabase/rls-client";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  // Fix #12: auth check — verify caller owns the org that uploaded this file
  const context = getContextFromHeaders(await headers());
  if (!context?.org_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "No path" }, { status: 400 });

  // Verify the storage path belongs to this org before serving
  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("id")
    .eq("external_id", path)
    .eq("org_id", context.org_id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("documents")
    .download(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  const buffer = await data.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.split("/").pop()}"`,
    },
  });
}

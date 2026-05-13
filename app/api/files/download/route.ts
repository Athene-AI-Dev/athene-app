import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "No path" }, { status: 400 });

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
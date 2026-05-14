import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { name, config } = await req.json();

    // Resolve internal org and user
    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgRow) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const { data: memberRow } = await supabaseAdmin
      .from("org_members")
      .select("id")
      .eq("clerk_user_id", userId)
      .eq("org_id", orgRow.id)
      .single();

    if (!memberRow) return NextResponse.json({ error: "User not found in organization" }, { status: 403 });

    // Use existing 'automations' table to store workflow config
    // Using upsert since there is a UNIQUE (org_id, user_id, type) constraint
    const { data, error } = await supabaseAdmin
      .from("automations")
      .upsert({
        org_id: orgRow.id,
        user_id: memberRow.id,
        type: "workflow",
        config: { name, nodes: config },
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,user_id,type" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    logger.error({ err: error?.message ?? String(error) }, "[workflows] POST Error");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });

    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("clerk_org_id", orgId)
      .single();

    if (!orgRow) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("automations")
      .select("*")
      .eq("org_id", orgRow.id)
      .eq("type", "workflow")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    logger.error({ err: error?.message ?? String(error) }, "[workflows] GET Error");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

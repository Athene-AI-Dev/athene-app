import { NextResponse } from "next/server";
import { Nango } from "@nangohq/node";
import { auth } from "@clerk/nextjs/server";
import { mapRole } from "@/lib/auth/clerk";

export async function POST() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = mapRole(orgRole ?? undefined);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY || "" });

  const { data } = await nango.createConnectSession({
    end_user: {
      id: userId,
    },
    organization: { id: orgId },
  });

  return NextResponse.json({ token: data.token });
}

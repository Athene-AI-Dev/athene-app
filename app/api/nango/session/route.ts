import { NextResponse } from "next/server";
import { getNango } from "@/lib/nango/client";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const nango = getNango();

    const { data } = await nango.createConnectSession({
      end_user: {
        id: userId,
      },
      organization: { id: orgId },
    });

    return NextResponse.json({ token: data.token });
  } catch (err) {
    console.error('[nango/session]', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

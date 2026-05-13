import { NextResponse } from "next/server";
import { getNango } from "@/lib/nango/client";
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

  // Fast-fail before making any Nango API call — avoids a ~10s timeout when
  // the key is missing and Nango rejects the placeholder key with 401.
  if (!process.env.NANGO_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message:
          'Nango is not configured. Add NANGO_SECRET_KEY and NEXT_PUBLIC_NANGO_PUBLIC_KEY to your .env.local, then restart the dev server.',
      },
      { status: 503 }
    );
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

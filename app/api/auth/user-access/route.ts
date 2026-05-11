import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveUserAccess } from "@/lib/auth/rbac";

/**
 * GET /api/auth/user-access
 * Resolves the current user's RBAC access context server-side.
 * Called by the dashboard layout to avoid running server-only code client-side.
 */
export async function GET() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401 }
    );
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 403 }
    );
  }

  const access = await resolveUserAccess(userId, orgId, orgRole ?? undefined);

  return NextResponse.json(access);
}

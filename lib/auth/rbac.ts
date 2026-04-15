import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";

export type UserRole = "member" | "analyst" | "admin";

interface UserAccess {
  role: UserRole;
  canAccessChat: boolean;
  canAccessBriefing: boolean;
  canAccessInsights: boolean;
  canAccessAdmin: boolean;
}

const ROLE_ACCESS_MAP: Record<UserRole, UserAccess> = {
  member: {
    role: "member",
    canAccessChat: true,
    canAccessBriefing: true,
    canAccessInsights: false,
    canAccessAdmin: false,
  },
  analyst: {
    role: "analyst",
    canAccessChat: true,
    canAccessBriefing: true,
    canAccessInsights: true,
    canAccessAdmin: false,
  },
  admin: {
    role: "admin",
    canAccessChat: true,
    canAccessBriefing: true,
    canAccessInsights: true,
    canAccessAdmin: true,
  },
};

const getCachedUserAccess = unstable_cache(
  async (role: UserRole): Promise<UserAccess> => {
    return ROLE_ACCESS_MAP[role] || ROLE_ACCESS_MAP.member;
  },
  ["user-access"],
  { revalidate: 3600 }
);

export async function resolveUserAccess(): Promise<UserAccess> {
  const { sessionClaims } = await auth();

  // Check for admin role from Clerk metadata
  const role = (sessionClaims?.metadata as any)?.role || "member";
  return getCachedUserAccess(role as UserRole);
}

export async function requireAdmin(): Promise<void> {
  const access = await resolveUserAccess();
  if (!access.canAccessAdmin) {
    throw new Error("Admin access required");
  }
}

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
  const { sessionClaims, orgRole } = await auth();

  // 1. Check for Clerk's organization roles
  // We map standard and custom Clerk roles to our application permissions
  if (orgRole === "org:admin") {
    return getCachedUserAccess("admin");
  }

  if (orgRole === "org:analyst" || orgRole === "org:bi_analyst") {
    return getCachedUserAccess("analyst");
  }

  // 2. Fallback to custom application metadata role
  // This allows overriding specific users or handling roles outside of organizations
  const role = (sessionClaims?.metadata as any)?.role || "member";
  return getCachedUserAccess(role as UserRole);
}

export async function requireAdmin(): Promise<void> {
  const access = await resolveUserAccess();
  if (!access.canAccessAdmin) {
    throw new Error("Admin access required");
  }
}

import { auth } from "@clerk/nextjs/server";

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

function getUserAccess(role: UserRole): UserAccess {
  return ROLE_ACCESS_MAP[role] || ROLE_ACCESS_MAP.member;
}

export async function resolveUserAccess(): Promise<UserAccess> {
  const { sessionClaims, orgRole } = await auth();

  // 1. Check for Clerk's organization roles
  // We map standard and custom Clerk roles to our application permissions
  if (orgRole === "org:admin") {
    return getUserAccess("admin");
  }

  if (orgRole === "org:analyst" || orgRole === "org:bi_analyst") {
    return getUserAccess("analyst");
  }

  // 2. Fallback to custom application metadata role
  // This allows overriding specific users or handling roles outside of organizations
  const role = (sessionClaims?.metadata as any)?.role || "member";
  return getUserAccess(role as UserRole);
}

export async function requireAdmin(): Promise<void> {
  const access = await resolveUserAccess();
  if (!access.canAccessAdmin) {
    throw new Error("Admin access required");
  }
}

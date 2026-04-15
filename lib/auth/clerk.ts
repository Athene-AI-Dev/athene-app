import { verifyToken } from "@clerk/nextjs/server";

export interface ClerkUserClaims {
  userId: string;
  orgId?: string;
  orgRole?: string;
  email?: string;
}

/**
 * Verifies the Clerk JWT from the Authorization header.
 * Throws 401 if no token, 403 if token invalid.
 */
export async function verifyClerkJWT(authHeader?: string): Promise<ClerkUserClaims> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("401: Unauthorized - No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
    });

    return {
      userId: payload.sub as string,
      orgId: payload.org_id as string | undefined,
      orgRole: payload.org_role as string | undefined,
      email: payload.email as string | undefined,
    };
  } catch (error) {
    console.error("Clerk Token Verification Error:", error);
    throw new Error("403: Forbidden - Invalid token");
  }
}

/**
 * Maps Clerk roles to application internal roles defined in the user_role ENUM.
 */
export function mapRole(orgRole?: string): "admin" | "member" | "super_user" | null {
  if (!orgRole) return null;

  switch (orgRole) {
    case "org:admin":
      return "admin";
    case "org:member":
      return "member";
    case "org:bi_analyst":
      return "super_user"; // Mapped to super_user for RLS grants
    default:
      return null;
  }
}

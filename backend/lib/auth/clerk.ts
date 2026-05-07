export type ClerkOrgRole = 'org:admin' | 'org:member' | 'org:bi_analyst';

/**
 * Maps Clerk organization roles to application internal roles.
 */
export function mapRole(orgRole?: ClerkOrgRole | string): "admin" | "member" | "super_user" | null {

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

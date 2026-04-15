import { redirect } from "next/navigation";
import { resolveUserAccess } from "@/lib/auth/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userAccess = await resolveUserAccess();

  // Role-guard admin pages
  if (!userAccess.canAccessAdmin) {
    redirect("/chat");
  }

  return <>{children}</>;
}

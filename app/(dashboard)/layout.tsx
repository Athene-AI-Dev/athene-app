import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { resolveUserAccess } from "@/lib/auth/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let { userId, orgId, orgRole } = await auth();
  
  // BYPASS: Mock auth for development
  if (process.env.NODE_ENV === 'development') {
    userId = userId || 'user_2mZ6p6t2S0Nl6U6x3X5l4G1j8K0'; // Hardcoded mock user
    orgId = orgId || 'org_2mZ6p6t2S0Nl6U6x3X5l4G1j8K0';   // Hardcoded mock org
    orgRole = orgRole || 'org:admin';
  }

  // Protect dashboard routes
  if (!userId && process.env.NODE_ENV !== 'development') {
    redirect("/");
  }
  
  if (!orgId && process.env.NODE_ENV !== 'development') {
    redirect("/sign-in");
  }

  const userAccess = await resolveUserAccess(userId!, orgId!, orgRole!);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar role={userAccess.role} className="hidden lg:flex" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header role={userAccess.role} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[var(--background)] via-[var(--background)] to-purple-950/5 dark:to-purple-950/20">
          <div className="container mx-auto max-w-7xl px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

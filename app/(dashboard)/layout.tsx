import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { resolveUserAccess } from "@/lib/auth/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId, orgRole } = await auth();

  // Protect dashboard routes
  if (!userId) {
    redirect("/");
  }
  // Dashboard requires an active org — Clerk may return null orgId if the
  // user hasn't joined/selected one. Send them to sign-in to pick one.
  if (!orgId) {
    redirect("/sign-in");
  }

  const userAccess = await resolveUserAccess(userId, orgId, orgRole);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar role={userAccess.role} className="hidden md:flex" />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <Header role={userAccess.role} />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

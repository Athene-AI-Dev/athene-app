import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/athene-sidebar";
import { Header } from "@/components/header";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { SidebarProvider } from "@/components/ui/sidebar";

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
  // Dashboard requires an active org
  if (!orgId) {
    redirect("/org-selection");
  }

  const userAccess = await resolveUserAccess(userId, orgId, orgRole);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-[#0b0e14] text-white overflow-hidden font-['Space_Grotesk'] relative">
        {/* Sidebar */}
        <Sidebar role={userAccess.role} />

        {/* Main Content Wrapper */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
          {/* Header */}
          <Header role={userAccess.role} />

          {/* Scrollable Page Content */}
          <main className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

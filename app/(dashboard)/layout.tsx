import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-sidebar";
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
    redirect("/sign-in");
  }

  const userAccess = await resolveUserAccess(userId, orgId, orgRole);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden font-sans relative">
        {/* Sidebar */}
        <Sidebar role={userAccess.role} />

        {/* Main Content Wrapper */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] -z-10 rounded-full" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/3 blur-[100px] -z-10 rounded-full" />

          {/* Header */}
          <Header role={userAccess.role} />

          {/* Scrollable Page Content */}
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="mx-auto max-w-7xl px-6 py-10 lg:px-12 min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


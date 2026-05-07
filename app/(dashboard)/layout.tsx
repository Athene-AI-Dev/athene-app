"use client";

import { useAuth } from "@clerk/nextjs";
import { redirect, useRouter } from "next/navigation";
import { Sidebar } from "@/components/athene-sidebar";
import { Header } from "@/components/header";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { SidebarProvider } from "@/components/ui/sidebar-base";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId, orgRole, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [userAccess, setUserAccess] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoaded && userId && orgId) {
      resolveUserAccess(userId, orgId, orgRole).then(setUserAccess);
    }
  }, [isLoaded, userId, orgId, orgRole]);

  if (!isLoaded || !mounted || !userAccess) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0b0e14]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#66ADE4] border-t-transparent" />
        </div>
    );
  }

  if (!userId) {
    redirect("/");
  }

  if (!orgId) {
    redirect("/org-selection");
  }

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


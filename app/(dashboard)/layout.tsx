"use client";

import { useAuth } from "@clerk/nextjs";
import { redirect, useRouter } from "next/navigation";
import { Sidebar } from "@/components/athene-sidebar";
import { Header } from "@/components/header";
import { resolveUserAccess } from "@/lib/auth/rbac";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        </div>
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
      <TooltipProvider>
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-['Space_Grotesk'] relative transition-colors duration-500">
          {/* Sidebar */}
          <Sidebar role={userAccess.role} />

          {/* Main Content Wrapper */}
          <div className="flex-1 flex flex-col h-full relative overflow-hidden">
            {/* Header */}
            <Header role={userAccess.role} />

            {/* Scrollable Page Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 lg:p-10">
              {children}
            </main>
          </div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}


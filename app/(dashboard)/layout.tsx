"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/athene-sidebar";
import { Header } from "@/components/header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import type { UserAccess } from "@/lib/auth/rbac";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !mounted) return;

    if (!userId) {
      router.push("/");
      return;
    }

    if (!orgId) {
      router.push("/org-selection");
      return;
    }

    // Fetch RBAC access from the server-side API route (avoids calling
    // server-only code — supabaseAdmin, Redis, react cache — in the browser)
    fetch("/api/auth/user-access")
      .then((res) => {
        if (!res.ok) throw new Error(`user-access returned ${res.status}`);
        return res.json() as Promise<UserAccess>;
      })
      .then(setUserAccess)
      .catch((err) => {
        console.error("[DashboardLayout] Failed to load user access:", err);
      });
  }, [isLoaded, mounted, userId, orgId, router]);

  if (!isLoaded || !mounted || !userAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0b0e14]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#66ADE4] border-t-transparent" />
      </div>
    );
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

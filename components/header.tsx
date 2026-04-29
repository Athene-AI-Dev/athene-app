"use client";

import { useEffect, useState, memo } from "react";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth/rbac";

interface HeaderProps {
  role: UserRole;
}

const Header = memo(function HeaderContent({ role }: HeaderProps) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Derive a simple title from pathname for the clean UI
  const getPageTitle = () => {
    if (pathname.includes("chat")) return "Chat";
    if (pathname.includes("briefing")) return "Briefing";
    if (pathname.includes("insights")) return "Insights";
    if (pathname.includes("admin")) return "Admin Panel";
    return "Workspace";
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
      <div className="flex items-center gap-4">
        {/* Mobile Sidebar */}
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-md">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r-0 w-64">
              <Sidebar role={role} className="w-full border-r-0" />
            </SheetContent>
          </Sheet>
        </div>

        <h1 className="text-lg font-semibold text-slate-900 hidden sm:block">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Organization Switcher (Clean UI) */}
        <OrganizationSwitcher
          hidePersonal={true}
          afterSelectOrganizationUrl="/chat"
          afterLeaveOrganizationUrl="/chat"
          appearance={{
            elements: {
              rootBox: "flex items-center justify-center",
              organizationSwitcherTrigger:
                "border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition-colors text-slate-900 bg-white shadow-sm",
            },
          }}
        />
      </div>
    </header>
  );
});

export { Header };

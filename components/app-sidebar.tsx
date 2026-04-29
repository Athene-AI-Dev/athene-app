"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  MessageSquare, 
  BookOpen, 
  BarChart3, 
  Users, 
  Key, 
  Zap, 
  Database, 
  ChevronDown, 
  ShieldCheck, 
  Workflow, 
  ClipboardList 
} from "lucide-react";
import { useState, memo } from "react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/rbac";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiresRole?: UserRole[];
}

interface SidebarProps {
  role: UserRole;
  className?: string;
}

const Sidebar = memo(function SidebarContent({ role, className }: SidebarProps) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith("/admin"));

  const mainLinks: NavLink[] = [
    {
      href: "/chat",
      label: "Chat",
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      href: "/briefing",
      label: "Briefing",
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      href: "/insights",
      label: "Insights",
      icon: <BarChart3 className="h-5 w-5" />,
      requiresRole: ["super_user", "admin"],
    },
  ];

  const adminLinks: NavLink[] = [
    { href: "/admin/users", label: "Users", icon: <Users className="h-5 w-5" /> },
    { href: "/admin/integrations", label: "Integrations", icon: <Zap className="h-5 w-5" /> },
    { href: "/admin/keys", label: "Keys", icon: <Key className="h-5 w-5" /> },
    { href: "/admin/grants", label: "BI Grants", icon: <Database className="h-5 w-5" /> },
    { href: "/admin/audit", label: "Audit", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/admin/automations", label: "Automations", icon: <Workflow className="h-5 w-5" /> },
  ];

  const isActive = (href: string) => pathname === href;
  const isAdminActive = adminLinks.some((link) =>
    pathname.startsWith(link.href.split("/").slice(0, -1).join("/"))
  );

  return (
    <aside className={cn("w-64 border-r border-slate-200 bg-white flex flex-col h-screen z-10", className)}>
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
        <Link href="/chat" className="flex items-center">
          <Image
            src="/athene-logo.png"
            alt="Athene AI"
            width={120}
            height={32}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {/* Main Links */}
        {mainLinks.map((link) => {
          if (link.requiresRole && !link.requiresRole.includes(role)) return null;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className={cn("flex-shrink-0", active ? "text-blue-700" : "text-slate-400")}>
                {link.icon}
              </div>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}

        {/* Admin Section */}
        {role === "admin" && (
          <div className="pt-2 mt-6 border-t border-slate-100">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors mt-2",
                isAdminActive || adminOpen
                  ? "text-blue-700 bg-slate-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <span className="flex items-center gap-3">
                <ShieldCheck className={cn("h-5 w-5 flex-shrink-0", (isAdminActive || adminOpen) ? "text-blue-700" : "text-slate-400")} />
                <span className="truncate">Admin Controls</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform duration-200 text-slate-400",
                  adminOpen && "rotate-180"
                )}
              />
            </button>

            {adminOpen && (
              <div className="ml-2 mt-1 space-y-1 border-l border-slate-200 pl-2 py-1">
                {adminLinks.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <div className={cn("flex-shrink-0", active ? "text-blue-700" : "text-slate-400")}>
                        {link.icon}
                      </div>
                      <span className="truncate">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors">
          <UserButton />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-slate-900 leading-none truncate">Account</span>
            <span className="text-xs text-slate-500 mt-1 leading-none truncate">Manage profile</span>
          </div>
        </div>
      </div>
    </aside>
  );
});

export { Sidebar };

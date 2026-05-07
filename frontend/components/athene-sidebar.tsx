"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Newspaper,
  FlaskConical,
  Users,
  Blocks,
  KeyRound,
  ShieldCheck,
  ClipboardList,
  Bot,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/rbac";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active = false }: SidebarItemProps) => (
  <Link href={href}>
    <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 group relative ${
      active ? 'text-[#66ADE4] bg-[#66ADE4]/10 rounded-xl mx-2 shadow-[0_0_20px_rgba(102,173,228,0.05)]' : 'text-slate-400 hover:text-white hover:bg-white/5 mx-2 rounded-xl'
    }`}>
      {active && <div className="absolute left-[-8px] top-3 bottom-3 w-1 bg-[#66ADE4] rounded-full shadow-[0_0_15px_#66ADE4]" />}
      <Icon size={18} className={active ? 'drop-shadow-[0_0_8px_rgba(102,173,228,0.5)]' : ''} />
      <span className="text-[11px] font-black tracking-widest uppercase font-['Space_Grotesk']">{label}</span>
    </div>
  </Link>
);

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function AppSidebar({ role, className }: { role: UserRole; className?: string }) {
  const pathname = usePathname();
  
  const primaryItems = [
    { icon: LayoutDashboard, label: "Command Center", href: "/dashboard" },
    { icon: MessageSquare, label: "Chat", href: "/chat" },
    { icon: BarChart3, label: "Insights", href: "/insights" },
    { icon: Newspaper, label: "Briefing", href: "/briefing" },
  ];

  const adminItems = [
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: Blocks, label: "Integrations", href: "/admin/integrations" },
    { icon: KeyRound, label: "BYOK Keys", href: "/admin/keys" },
    { icon: ShieldCheck, label: "BI Grants", href: "/admin/grants" },
    { icon: ClipboardList, label: "Audit Log", href: "/admin/audit" },
    { icon: Database, label: "Data Sources", href: "/files" },
    { icon: Bot, label: "Automations", href: "/admin/automations" },
  ];

  return (
    <aside className={cn("w-72 border-r border-white/5 bg-[#06080c] flex flex-col h-screen shrink-0 relative", className)}>
      {/* Sidebar Header */}
      <div className="p-8 pb-4">
        <Link href="/dashboard">
          <div className="flex items-center gap-4 group transition-all">
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-white shadow-[0_0_30px_rgba(218,136,182,0.2)] group-hover:scale-105 transition-transform duration-500">
               <img src="/logo.png" alt="A" className="w-9 h-9 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tighter text-white font-['Space_Grotesk'] uppercase">Athene</span>
                <span className="text-xl font-black tracking-tighter text-[#66ADE4] font-['Space_Grotesk'] uppercase">AI</span>
              </div>
              <p className="text-[8px] text-slate-600 uppercase tracking-[0.3em] mt-1 font-bold">Neural Engine v1.4</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-8">
        {/* Primary Navigation */}
        <nav className="space-y-1">
          <p className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-700 mb-4 ml-2">Core Hub</p>
          {primaryItems.map((item) => (
            <SidebarItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isRouteActive(pathname, item.href)}
            />
          ))}
        </nav>

        {/* Administration Section */}
        {role === "admin" && (
          <nav className="space-y-1 pt-6 border-t border-white/5">
            <p className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-700 mb-4 ml-2">Admin Control</p>
            {adminItems.map((item) => (
              <SidebarItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={isRouteActive(pathname, item.href)}
              />
            ))}
          </nav>
        )}

        {/* Laboratory Section */}
        <nav className="space-y-1 pt-6 border-t border-white/5">
          <p className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-700 mb-4 ml-2">Experimental</p>
          <SidebarItem
            icon={FlaskConical}
            label="Agent Laboratory"
            href="/builder"
            active={isRouteActive(pathname, "/builder")}
          />
        </nav>
      </div>

      {/* Deploy Button Pin */}
      <div className="p-6 bg-[#06080c] border-t border-white/5">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <button 
            onClick={() => {
              import("sonner").then(({ toast }) => {
                toast.success("Agent Deployment Initiated", {
                  description: "Synthesizing neural grid for production deployment.",
                });
              });
            }}
            className="relative w-full h-14 bg-gradient-to-r from-[#DA88B6] to-[#66ADE4] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-visible shadow-xl">
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-[#06080c] bg-white flex items-center justify-center shadow-lg">
               <img src="/logo.png" alt="A" className="w-7 h-7 object-contain" />
            </div>
            <span className="ml-6">Deploy Agent</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export { AppSidebar as Sidebar };

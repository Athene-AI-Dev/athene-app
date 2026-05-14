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
  Network
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/rbac";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, active = false }: SidebarItemProps) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={active} tooltip={label} className={cn(
      "h-12 px-4 transition-all duration-300 group relative rounded-xl mx-2",
      active 
        ? 'bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary),0.05)]' 
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    )}>
      <Link href={href}>
        {active && (
          <div className="absolute left-[-8px] top-3 bottom-3 w-1 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
        )}
        <Icon 
          size={18} 
          className={cn(
            "transition-all duration-300",
            active ? 'drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]' : 'group-hover:scale-110'
          )} 
        />
        <span className="text-[11px] font-black tracking-widest uppercase font-['Space_Grotesk'] ml-3">{label}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

const isRouteActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function AppSidebar({ role, className }: { role: UserRole; className?: string }) {
  const pathname = usePathname();
  
  const primaryItems = [
    { icon: LayoutDashboard, label: "Command Center", href: "/dashboard" },
    { icon: MessageSquare, label: "Chat", href: "/chat" },
    { icon: Network, label: "Knowledge Graph", href: "/graph" },
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
    <Sidebar className={cn("border-r border-border bg-card/50 backdrop-blur-xl transition-colors duration-300", className)}>
      <SidebarHeader className="p-8 pb-4">
        <Link href="/dashboard">
          <div className="flex items-center gap-4 group transition-all">
            <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-white shadow-xl group-hover:scale-105 transition-transform duration-500 border border-border/50">
               <img src="/logo.png" alt="A" className="w-9 h-9 object-contain" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tighter text-foreground font-['Space_Grotesk'] uppercase">Athene</span>
                <span className="text-xl font-black tracking-tighter text-primary font-['Space_Grotesk'] uppercase">AI</span>
              </div>
              <p className="text-[8px] text-muted-foreground uppercase tracking-[0.3em] mt-1 font-bold opacity-60">Neural Engine v1.4</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6 space-y-8 no-scrollbar">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-4 ml-2">Core Hub</SidebarGroupLabel>
          <SidebarMenu className="space-y-1">
            {primaryItems.map((item) => (
              <SidebarItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                active={isRouteActive(pathname, item.href)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup className="pt-6 border-t border-border/50">
            <SidebarGroupLabel className="px-4 text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-4 ml-2">Admin Control</SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              {adminItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={isRouteActive(pathname, item.href)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="pt-6 border-t border-border/50">
          <SidebarGroupLabel className="px-4 text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-4 ml-2">Experimental</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarItem
              icon={FlaskConical}
              label="Agent Laboratory"
              href="/builder"
              active={isRouteActive(pathname, "/builder")}
            />
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-6 bg-transparent border-t border-border/50">
        <button
          onClick={() => {
            import("sonner").then(({ toast }) => {
              toast.success("Agent Deployment Initiated", {
                description: "Synthesizing neural grid for production deployment.",
              });
            });
          }}
          className="relative w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-visible shadow-lg shadow-primary/25">
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-card bg-white flex items-center justify-center shadow-lg group-data-[collapsible=icon]:hidden">
             <img src="/logo.png" alt="A" className="w-7 h-7 object-contain" />
          </div>
          <span className="ml-6 group-data-[collapsible=icon]:hidden">Deploy Agent</span>
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
             <img src="/logo.png" alt="A" className="w-6 h-6 object-contain invert" />
          </div>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

export { AppSidebar as Sidebar };

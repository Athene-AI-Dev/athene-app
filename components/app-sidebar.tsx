"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Zap, 
  Files, 
  Settings2, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  Command,
  Plus
} from "lucide-react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/auth/rbac";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Synthesis Chat", icon: MessageSquare, href: "/chat" },
  { label: "Agent Builder", icon: Zap, href: "/builder" },
  { label: "Knowledge Base", icon: Files, href: "/files" },
];

export function AppSidebar({ role, className }: { role: UserRole; className?: string }) {
  const pathname = usePathname();

  return (
    <Sidebar className={cn("glass border-r border-white/5 animate-in slide-in-from-left duration-700", className)}>
      <SidebarHeader className="h-20 px-8 flex items-center justify-between border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="h-9 w-9 bg-[#D96FAB] rounded-xl flex items-center justify-center glow-primary shadow-lg group-hover:scale-105 transition-transform">
             <Command className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tighter text-foreground">
             Athene<span className="text-[#D96FAB]">AI</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-6 space-y-10">
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/40 px-4 mb-4">Operations</h3>
          <SidebarMenu className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === item.href}
                  className={cn(
                    "h-11 rounded-xl px-4 flex items-center gap-3 transition-all group",
                    pathname === item.href 
                      ? "bg-[#D96FAB]/10 text-[#D96FAB] border border-[#D96FAB]/20" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      pathname === item.href ? "text-[#D96FAB]" : "text-[#7AADCF]"
                    )} />
                    <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                    {pathname === item.href && (
                      <ChevronRight className="ml-auto w-3.5 h-3.5 animate-in slide-in-from-left-2" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {role === "admin" && (
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/40 px-4 mb-4">Governance</h3>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-11 rounded-xl px-4 flex items-center gap-3 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all group">
                  <Link href="/admin/integrations">
                    <Sparkles className="w-4 h-4 text-[#7AADCF] group-hover:text-[#D96FAB] transition-colors" />
                    <span className="text-[13px] font-bold tracking-tight">System Connectors</span>
                    <Badge variant="outline" className="ml-auto text-[9px] font-black tracking-widest px-1.5 h-4 border-white/5 bg-white/5">PRO</Badge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-11 rounded-xl px-4 flex items-center gap-3 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all group">
                  <Link href="/admin/settings">
                    <Settings2 className="w-4 h-4 text-[#7AADCF] group-hover:text-[#D96FAB] transition-colors" />
                    <span className="text-[13px] font-bold tracking-tight">Access Control</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-white/5 bg-accent/20">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#D96FAB]/10 to-[#7AADCF]/10 border border-white/5 space-y-4">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center border border-white/5 shadow-inner">
                 <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[12px] font-black text-foreground">Allan Walker</span>
                 <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Enterprise Tier</span>
              </div>
           </div>
           <Button className="w-full h-10 rounded-xl bg-[#D96FAB] text-white hover:bg-[#ECA8CC] font-black uppercase tracking-widest text-[9px] gap-2 shadow-lg">
              <Plus className="w-3.5 h-3.5" />
              Upgrade Plan
           </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export { AppSidebar as Sidebar };

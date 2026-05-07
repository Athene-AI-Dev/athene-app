"use client";

import { useEffect, useState, memo } from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { ShieldCheck, Radio, Bell, Cpu, Menu, Search, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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

  const isAgentLab = pathname.includes("agent-lab");

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-8 bg-black/20 shrink-0 z-40 sticky top-0 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <h2 className="text-sm font-black text-white tracking-tighter uppercase font-['Space_Grotesk']">AtheneAI</h2>
        <nav className="hidden md:flex items-center gap-8">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Network</span>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
            isAgentLab ? "text-[#66ADE4]" : "text-slate-500 hover:text-white"
          )}>Agent Lab</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Assets</span>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-4">
           <OrganizationSwitcher
              hidePersonal={true}
              afterSelectOrganizationUrl="/briefing"
              afterLeaveOrganizationUrl="/briefing"
              appearance={{
                elements: {
                  organizationSwitcherTrigger: "text-slate-500 hover:text-white transition-colors text-[9px] font-bold uppercase tracking-widest bg-transparent border-none p-0",
                  organizationPreviewMainIdentifier: "text-white",
                }
              }}
           />
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/admin/grants">
            <ShieldCheck 
              size={16} 
              className="text-slate-400 hover:text-[#DA88B6] transition-colors cursor-pointer" 
              onClick={() => {
                import("sonner").then(({ toast }) => toast("Accessing Security Hub", { description: "Redirecting to cross-scope grant management." }));
              }}
            />
          </Link>
          <Link href="/admin/integrations">
            <Radio 
              size={16} 
              className="text-slate-400 hover:text-[#66ADE4] transition-colors cursor-pointer" 
              onClick={() => {
                import("sonner").then(({ toast }) => toast("Accessing Network Cluster", { description: "Redirecting to integration bridge management." }));
              }}
            />
          </Link>
          <Link href="/dashboard">
            <Cpu 
              size={16} 
              className="text-slate-400 hover:text-white transition-colors cursor-pointer" 
              onClick={() => {
                import("sonner").then(({ toast }) => toast("Accessing Neural Pulse", { description: "Redirecting to system health overview." }));
              }}
            />
          </Link>
          <div className="relative">
            <Link href="/admin/audit">
              <Bell 
                size={16} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer" 
                onClick={() => {
                  import("sonner").then(({ toast }) => toast("Accessing Audit Log", { description: "Redirecting to full system execution trace." }));
                }}
              />
            </Link>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#DA88B6] rounded-full" />
          </div>
          <div className="w-7 h-7 rounded-full border border-white/10 overflow-hidden hover:border-white/30 transition-colors">
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-7 h-7 grayscale",
                  userButtonTrigger: "focus:shadow-none"
                }
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
});

export { Header };

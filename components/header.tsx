"use client";

import { useEffect, useState, memo } from "react";
import { OrganizationSwitcher, UserButton, SignOutButton } from "@clerk/nextjs";
import { ShieldCheck, Radio, Bell, Cpu, Menu, Search, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

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

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-8 bg-background/60 shrink-0 z-40 sticky top-0 backdrop-blur-xl transition-colors duration-300">
      <div className="flex items-center gap-6">
        <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-xl border border-transparent hover:border-border" />
        <h2 className="text-sm font-black text-foreground tracking-tighter uppercase font-['Space_Grotesk'] hidden sm:block">AtheneAI</h2>
        <nav className="hidden md:flex items-center gap-8">
          <Link 
            href="/graph" 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
              pathname.includes("graph") ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            Network
          </Link>
          <Link 
            href="/builder" 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
              pathname.includes("builder") ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            Agent Lab
          </Link>
          <Link 
            href="/files" 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors",
              pathname.includes("files") ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            Assets
          </Link>
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
                  organizationSwitcherTrigger: "text-muted-foreground hover:text-foreground transition-colors text-[9px] font-bold uppercase tracking-widest bg-transparent border-none p-0",
                  organizationPreviewMainIdentifier: "text-foreground",
                  organizationPreviewSecondaryIdentifier: "text-muted-foreground"
                }
              }}
           />
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/admin/grants" title="Security Hub">
            <ShieldCheck 
              size={16} 
              className="text-muted-foreground hover:text-secondary transition-colors cursor-pointer" 
            />
          </Link>
          <Link href="/admin/integrations" title="Network Cluster">
            <Radio 
              size={16} 
              className="text-muted-foreground hover:text-primary transition-colors cursor-pointer" 
            />
          </Link>
          <Link href="/dashboard" title="Neural Pulse">
            <Cpu 
              size={16} 
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" 
            />
          </Link>
          <div className="relative">
            <Link href="/admin/audit" title="Audit Log">
              <Bell 
                size={16} 
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" 
              />
            </Link>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_8px_rgba(217,122,46,0.45)]" />
          </div>
          <div className="w-7 h-7 rounded-full border border-border overflow-hidden hover:border-primary/50 transition-colors">
            <UserButton 
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-7 h-7 dark:grayscale-[0.5]",
                  userButtonTrigger: "focus:shadow-none"
                }
              }}
            />
          </div>
          {/* Accessible logout button for E2E tests and screen readers */}
          <div className="sr-only">
            <SignOutButton>
              <button data-testid="logout-button" aria-label="Logout">Log out</button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </header>

  );
});

export { Header };

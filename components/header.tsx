"use client";

import { useEffect, useState, memo } from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Menu, Bell, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/app-sidebar";
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

  const getBreadcrumbs = () => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, index) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1).replace("-", " "),
      href: "/" + parts.slice(0, index + 1).join("/"),
      active: index === parts.length - 1,
    }));
  };

  const breadcrumbs = getBreadcrumbs();
  return (
    <header className="h-16 glass border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-40 sticky top-0">
      <div className="flex items-center gap-6">
        {/* Mobile Sidebar Trigger */}
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r-0 w-72 glass">
              <Sidebar role={role} className="w-full border-r-0 bg-transparent" />
            </SheetContent>
          </Sheet>
        </div>

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground/60">Athene AI</span>
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              <span className={cn(
                "transition-colors",
                crumb.active ? "text-foreground font-semibold" : "text-muted-foreground/60 hover:text-foreground"
              )}>
                {crumb.label}
              </span>
            </div>
          ))}
        </nav>
      </div>

        {/* Right section */}
        <div className="flex items-center gap-6">
          {/* Search Bar - Aesthetic Only */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 border border-white/5 text-muted-foreground w-64 transition-all hover:bg-accent hover:border-primary/20 cursor-text group">
            <Search className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
            <span className="text-xs">Search intelligence...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>

          {/* Organization Switcher */}
          <div className="flex items-center">
            <OrganizationSwitcher
              hidePersonal={true}
              afterSelectOrganizationUrl="/briefing"
              afterLeaveOrganizationUrl="/briefing"
              appearance={{
                elements: {
                  organizationSwitcherTrigger:
                    "px-3 py-2 text-base font-medium text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-200 rounded-lg hover:bg-[var(--nav-hover)] dark:hover:bg-purple-950/30",
                  organizationSwitcherPopoverRoot:
                    "bg-[var(--sidebar-bg)] border-[var(--sidebar-border)]",
                },
              }}
            />
          </div>
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground transition-colors group">
            <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-primary rounded-full ring-2 ring-background animate-pulse" />
          </Button>

          <ThemeToggle />

          <div className="h-6 w-px bg-border mx-1" />

          {/* User Button */}
          <div className="flex items-center">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "h-9 w-9",
                  userButtonTrigger:
                    "rounded-lg transition-all duration-200 hover:ring-2 hover:ring-primary hover:ring-offset-2 hover:ring-offset-background",
                },
              }}
            />
          </div>
        </div>
    </header>
  );
});

export { Header };


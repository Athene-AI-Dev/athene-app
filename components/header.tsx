"use client";

import { useEffect, useState, memo } from "react";
import { OrganizationSwitcher } from "@clerk/nextjs";
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

      <div className="flex items-center gap-3">
        {/* Search Bar - Aesthetic Only */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 border border-white/5 text-muted-foreground w-64 transition-all hover:bg-accent hover:border-primary/20 cursor-text group">
          <Search className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
          <span className="text-xs">Search intelligence...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground transition-colors group">
          <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-primary rounded-full ring-2 ring-background animate-pulse" />
        </Button>

        <ThemeToggle />

        <div className="h-6 w-px bg-border mx-1" />

        {/* Organization Switcher */}
        <OrganizationSwitcher
          hidePersonal={true}
          afterSelectOrganizationUrl="/chat"
          afterLeaveOrganizationUrl="/chat"
          appearance={{
            elements: {
              rootBox: "flex items-center justify-center",
              organizationSwitcherTrigger:
                "h-9 border border-border rounded-xl px-4 py-1.5 hover:bg-accent transition-all text-foreground bg-accent/40 shadow-sm font-semibold text-[13px] gap-2",
              organizationPreviewMainIdentifier: "text-foreground font-semibold",
              organizationPreviewSecondaryIdentifier: "text-muted-foreground text-[11px]",
              userPreviewMainIdentifier: "text-foreground",
              userPreviewSecondaryIdentifier: "text-muted-foreground",
            },
          }}
        />
      </div>
    </header>
  );
});

export { Header };


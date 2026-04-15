"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, memo } from "react";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = memo(function HeaderContent() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <header className="border-b border-[var(--header-border)] bg-gradient-to-r from-[var(--header-bg)] via-[var(--header-bg)] to-purple-950/30 dark:via-purple-950/20 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-16 items-center justify-between px-8">
        {/* Left spacer */}
        <div className="flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-6">
          {/* Organization Switcher */}
          <div className="flex items-center">
            <OrganizationSwitcher
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

          {/* Divider */}
          <div className="h-6 w-px bg-[var(--sidebar-border)] dark:bg-purple-900/50" />

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg hover:bg-[var(--nav-hover)] dark:hover:bg-purple-950/30 transition-colors duration-200 text-[var(--foreground)] hover:text-[var(--accent)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* User Button */}
          <div className="flex items-center">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "h-9 w-9",
                  userButtonTrigger:
                    "rounded-lg transition-all duration-200 hover:ring-2 hover:ring-[var(--accent)] hover:ring-offset-2 hover:ring-offset-[var(--background)]",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
});

export { Header };

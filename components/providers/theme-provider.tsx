"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * Defers mounting NextThemesProvider until after hydration.
 *
 * React 19 warns when it encounters <script> tags inside components during
 * client-side rendering. next-themes injects exactly such a script for
 * its flash-of-unstyled-content (FOUC) prevention. By mounting only on the
 * client we skip that script injection entirely.
 *
 * The <html class="dark"> in app/layout.tsx ensures dark theme is applied
 * before React hydrates, so there is no visible flash.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render children without theme context during SSR / first hydration.
    // Dark theme is already applied via class="dark" on <html>.
    return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

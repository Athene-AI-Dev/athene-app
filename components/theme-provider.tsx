"use client"
// Cache invalidation comment
import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "@teispace/next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-500 px-6">
      <div className="relative">
        <div className="absolute -inset-8 bg-destructive/10 blur-3xl rounded-full" />
        <div className="relative h-24 w-24 bg-destructive/10 rounded-[2rem] border border-destructive/20 flex items-center justify-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
      </div>

      <div className="space-y-3 max-w-md">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground leading-relaxed">
          {error.message || "An unexpected error occurred. Your data is safe — please try again."}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest mt-2">
            Ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={reset}
          className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg shadow-primary/20"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-12 px-8 rounded-2xl border-white/10 font-bold uppercase tracking-widest text-[11px] gap-2 hover:bg-white/5"
        >
          <Link href="/dashboard">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

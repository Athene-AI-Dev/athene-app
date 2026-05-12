import { cn } from "@/lib/utils"
import { Button } from "./button"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-32 px-8 text-center frosted-card rounded-[3rem] border-2 border-dashed border-white/5 space-y-6 group",
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full animate-pulse opacity-40" />
        <div className="relative h-24 w-24 bg-accent/30 rounded-[2rem] flex items-center justify-center border border-white/5 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
          <Icon className="h-12 w-12 text-muted-foreground/30" />
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed font-medium">{description}</p>
      </div>

      {action && (
        action.href ? (
          <Button
            asChild
            size="lg"
            className="h-12 px-8 rounded-2xl glow-primary font-black uppercase tracking-widest text-[11px] mt-2"
          >
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button
            onClick={action.onClick}
            size="lg"
            className="h-12 px-8 rounded-2xl glow-primary font-black uppercase tracking-widest text-[11px] mt-2"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}

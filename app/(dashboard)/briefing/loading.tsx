import { Skeleton } from "@/components/ui/skeleton"

export default function BriefingLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* Header hero */}
      <Skeleton className="h-44 w-full rounded-[2.5rem]" />

      {/* Briefing sections */}
      <div className="grid gap-8">
        <Skeleton className="h-64 w-full rounded-[2rem]" />
        <Skeleton className="h-64 w-full rounded-[2rem]" />
        <Skeleton className="h-64 w-full rounded-[2rem]" />
      </div>
    </div>
  )
}

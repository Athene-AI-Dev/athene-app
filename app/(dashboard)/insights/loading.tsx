import { Skeleton } from "@/components/ui/skeleton"

export default function InsightsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* Header hero */}
      <Skeleton className="h-44 w-full rounded-[2.5rem]" />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-[1.5rem]" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Skeleton className="lg:col-span-2 h-96 rounded-[2rem]" />
        <Skeleton className="h-96 rounded-[2rem]" />
      </div>
    </div>
  )
}

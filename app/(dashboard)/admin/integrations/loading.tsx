import { Skeleton } from "@/components/ui/skeleton"

export default function IntegrationsLoading() {
  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-5 w-96 rounded-full" />
        </div>
        <Skeleton className="h-14 w-40 rounded-2xl" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-16 w-full rounded-2xl" />

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-[2.5rem]" />
        ))}
      </div>
    </div>
  )
}

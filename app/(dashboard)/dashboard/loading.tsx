import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Hero */}
      <Skeleton className="h-60 w-full rounded-[2.5rem]" />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-[2rem]" />
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-16 rounded-[2rem]" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-52 rounded-[2rem]" />
          <Skeleton className="h-44 rounded-[2rem]" />
        </div>
      </div>
    </div>
  )
}

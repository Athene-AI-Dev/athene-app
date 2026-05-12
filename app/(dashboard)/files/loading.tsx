import { Skeleton } from "@/components/ui/skeleton"

export default function FilesLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div className="space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="h-5 w-96 rounded-full" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-14 w-36 rounded-2xl" />
          <Skeleton className="h-14 w-44 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar */}
        <div className="space-y-6">
          <Skeleton className="h-52 rounded-[2rem]" />
          <div className="space-y-2 px-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-3 space-y-6">
          <Skeleton className="h-16 rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

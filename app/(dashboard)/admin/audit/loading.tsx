import { Skeleton } from "@/components/ui/skeleton"

export default function AuditLoading() {
  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-3">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-5 w-72 rounded-full" />
      </div>

      <div className="flex gap-4">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 w-32 rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-12 rounded-xl" />
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

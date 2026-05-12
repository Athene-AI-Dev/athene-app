import { Skeleton } from "@/components/ui/skeleton"

export default function GrantsLoading() {
  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-3">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-5 w-80 rounded-full" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-14 rounded-xl" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

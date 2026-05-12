import { Skeleton } from "@/components/ui/skeleton"

export default function KeysLoading() {
  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-3">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-5 w-80 rounded-full" />
      </div>

      <Skeleton className="h-14 w-36 rounded-2xl" />

      <div className="space-y-4">
        <Skeleton className="h-14 rounded-xl" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[1.5rem]" />
        ))}
      </div>
    </div>
  )
}

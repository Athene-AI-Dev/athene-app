import { Skeleton } from "@/components/ui/skeleton"

export default function AutomationsLoading() {
  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-5 w-80 rounded-full" />
        </div>
        <Skeleton className="h-14 w-44 rounded-2xl" />
      </div>

      <div className="grid gap-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[2rem]" />
        ))}
      </div>
    </div>
  )
}

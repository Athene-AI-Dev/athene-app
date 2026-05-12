import { Skeleton } from "@/components/ui/skeleton"

export default function UsersLoading() {
  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-5 w-72 rounded-full" />
      </div>

      <Skeleton className="h-[600px] w-full rounded-[2rem] mt-8" />

      <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-full" />
        <div className="flex gap-2 mt-6">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

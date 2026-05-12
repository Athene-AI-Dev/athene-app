import { Skeleton } from "@/components/ui/skeleton"

export default function BuilderLoading() {
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      {/* Toolbar */}
      <Skeleton className="h-20 w-full rounded-[2rem]" />

      {/* Canvas area */}
      <div className="flex-1 flex gap-8 overflow-hidden">
        <Skeleton className="w-80 rounded-[2rem]" />
        <Skeleton className="flex-1 rounded-[3rem]" />
        <Skeleton className="w-80 rounded-[2rem]" />
      </div>
    </div>
  )
}

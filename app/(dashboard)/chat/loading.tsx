import { Skeleton } from "@/components/ui/skeleton"

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-8 overflow-hidden">
      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* Main column */}
        <div className="flex flex-1 flex-col min-w-0 gap-6">
          <Skeleton className="h-20 w-full rounded-[2.5rem]" />

          {/* Message stubs */}
          <div className="flex-1 space-y-10 py-6 px-4 overflow-hidden">
            <div className="flex justify-start gap-5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
              <Skeleton className="h-28 w-96 rounded-[2rem]" />
            </div>
            <div className="flex justify-end gap-5 flex-row-reverse">
              <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
              <Skeleton className="h-16 w-64 rounded-[2rem]" />
            </div>
            <div className="flex justify-start gap-5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
              <Skeleton className="h-36 w-80 rounded-[2rem]" />
            </div>
          </div>

          {/* Input bar */}
          <Skeleton className="h-20 rounded-[3rem] mx-6 mb-4" />
        </div>

        {/* Intelligence sidebar */}
        <div className="hidden xl:flex w-80 flex-col gap-8 pr-4 pb-10">
          <Skeleton className="h-52 rounded-[2rem]" />
          <Skeleton className="flex-1 rounded-[2rem]" />
        </div>
      </div>
    </div>
  )
}

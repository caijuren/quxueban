import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md animate-pulse bg-slate-100/90 dark:bg-slate-800/60",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

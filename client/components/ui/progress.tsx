import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-amber-900/50 border-2 border-amber-700/80 shadow-inner", 
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-amber-500 transition-transform duration-500 ease-out"
      style={{ 
        transform: `translateX(-${100 - (value || 0)}%)`,
        boxShadow: '0 0 15px 3px rgba(251, 191, 36, 0.6), 0 0 5px 1px rgba(253, 230, 138, 1) inset'
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

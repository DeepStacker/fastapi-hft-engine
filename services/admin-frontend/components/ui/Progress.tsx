import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'gradient'
  size?: 'sm' | 'default' | 'lg'
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = 'default', size = 'default', ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100)
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary",
          {
            "h-1": size === "sm",
            "h-2": size === "default",
            "h-3": size === "lg",
          },
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            {
              "bg-primary": variant === "default",
              "bg-green-500": variant === "success",
              "bg-yellow-500": variant === "warning",
              "bg-red-500": variant === "destructive",
              "gradient-indigo": variant === "gradient",
            }
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }
)

Progress.displayName = "Progress"

export { Progress }
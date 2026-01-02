import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  pulse?: boolean
}

function Badge({ className, variant = "default", pulse, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all-smooth",
        {
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80": variant === "default",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80": variant === "destructive",
          "text-foreground border-border": variant === "outline",
          "border-transparent bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25": variant === "success",
          "border-transparent bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/25": variant === "warning",
          "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25": variant === "info",
        },
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {props.children}
    </div>
  )
}

export { Badge }

import { cn } from "@/lib/utils";
import * as React from "react";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-accent disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldClass, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export { fieldClass, Input };

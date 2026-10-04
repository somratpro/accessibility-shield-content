import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:opacity-90",
        outline: "border border-border bg-surface hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, isLoading, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };

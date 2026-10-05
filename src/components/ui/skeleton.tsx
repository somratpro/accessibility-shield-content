import { cn } from "@/lib/utils";
import * as React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-light", className)}
      style={{ animation: "skeleton-pulse 1.6s ease-in-out infinite" }}
      {...props}
    />
  );
}

export function PageSkeleton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={className}>
      {children}
    </div>
  );
}

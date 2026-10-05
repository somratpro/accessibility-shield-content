"use client";

import { Check, Loader2 } from "lucide-react";

interface ProgressMonitorProps {
  steps: string[];
  isGenerating: boolean;
  error?: string | null;
}

export function ProgressMonitor({ steps, isGenerating, error }: ProgressMonitorProps) {
  if (!isGenerating && steps.length === 0 && !error) return null;

  return (
    <div role="status" aria-live="polite" className="space-y-1.5 text-sm">
      {steps.map((step, i) => {
        const current = isGenerating && i === steps.length - 1;
        return (
          <div key={i} className={current ? "flex items-center gap-2" : "flex items-center gap-2 text-muted-foreground"}>
            {current ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            )}
            <span>{step}</span>
          </div>
        );
      })}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

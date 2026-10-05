"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A code snippet with a copy button. */
export function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  };

  return (
    <div className="relative mt-2 rounded-md border border-border bg-light">
      <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed">{code}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

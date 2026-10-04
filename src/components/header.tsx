"use client";

import { cn } from "@/lib/utils";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStudio } from "./studio-provider";
import { Button } from "./ui/button";

const PAGES = [
  { href: "/", label: "Calendar" },
  { href: "/write", label: "Write" },
  { href: "/posts", label: "Posts" },
];

export function Header() {
  const pathname = usePathname();
  const { site, hasApiKey, openKeyDialog } = useStudio();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
        <Link href="/" className="text-sm font-semibold">
          Content Studio <span className="font-normal text-muted">· {site.name}</span>
        </Link>

        <nav className="flex gap-1" aria-label="Main">
          {PAGES.map((page) => {
            const active = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
                )}
              >
                {page.label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant={hasApiKey ? "ghost" : "outline"}
          size="sm"
          onClick={openKeyDialog}
          className="ml-auto"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          {hasApiKey ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Groq
            </>
          ) : (
            "Add Groq key"
          )}
        </Button>
      </div>
    </header>
  );
}

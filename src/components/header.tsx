"use client";

import { cn } from "@/lib/utils";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { useStudio } from "./studio-provider";
import { Button } from "./ui/button";

const PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/ideas", label: "Ideas" },
  { href: "/write", label: "Write" },
  { href: "/posts", label: "Posts" },
];

export function Header() {
  const pathname = usePathname();
  const { site, hasApiKey, openKeyDialog } = useStudio();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="shrink-0 text-sm font-semibold">
          <span className="sm:hidden">Studio</span>
          <span className="hidden sm:inline">Content Studio</span>{" "}
          <span className="hidden font-normal text-muted-foreground md:inline">
            · {site.name}
          </span>
        </Link>

        <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Main">
          {PAGES.map((page) => {
            const active = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                  active
                    ? "bg-light font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {page.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant={hasApiKey ? "ghost" : "outline"}
            size="sm"
            onClick={openKeyDialog}
            className="shrink-0"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {hasApiKey ? (
              <>
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />
                Groq
              </>
            ) : (
              "Add Groq key"
            )}
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

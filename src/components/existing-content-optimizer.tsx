"use client";

import {
  AntiAIAuditResult,
  OptimizationResult,
} from "@/lib/ai/content-optimizer";
import type { SearchPerformance } from "@/lib/search-console";
import { cn } from "@/lib/utils";
import { marked } from "marked";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStudio } from "./studio-provider";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface AuditedPost {
  filename: string;
  slug: string;
  title: string;
  wordCount: number;
  audit: AntiAIAuditResult | null;
}

export function ExistingContentOptimizer() {
  const { apiKey, site } = useStudio();
  const [posts, setPosts] = useState<AuditedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [optimizingSlug, setOptimizingSlug] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [view, setView] = useState<"preview" | "original" | "optimized">(
    "preview",
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<SearchPerformance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/existing-content");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPosts(data.posts || []);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/search-performance")
      .then((r) => r.json())
      .then(setSearch)
      .catch(() => {});
  }, [load]);

  // Posts needing cleanup first, then the most-seen posts once Search Console data exists.
  const sorted = [...posts].sort(
    (a, b) =>
      issuesOf(b).length - issuesOf(a).length ||
      (search?.pages[b.slug]?.impressions ?? 0) -
        (search?.pages[a.slug]?.impressions ?? 0),
  );
  const needCleanup = posts.filter((p) => issuesOf(p).length > 0).length;

  const optimize = async (slug: string) => {
    setOptimizingSlug(slug);
    setActiveSlug(slug);
    setResult(null);
    try {
      const res = await fetch("/api/existing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize", slug, apiKey }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Cleanup failed");
      setResult(data.optimization);
      setView("preview");
    } catch (err: any) {
      toast.error(err?.message || "Cleanup failed");
    } finally {
      setOptimizingSlug(null);
    }
  };

  const save = async () => {
    if (!activeSlug || !result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/existing-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          slug: activeSlug,
          optimizedMarkdown: result.optimizedMarkdown,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      toast.success(`Saved ${activeSlug}.md`);
      setResult(null);
      setActiveSlug(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          Published posts{" "}
          <span className="font-normal text-muted">({posts.length})</span>
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {loading
            ? "Checking posts…"
            : needCleanup > 0
              ? `${needCleanup} ${needCleanup === 1 ? "post needs" : "posts need"} cleanup.`
              : "All posts pass the cleanup check."}{" "}
          {search &&
            (!search.configured
              ? "Connect Google Search Console in .env to see clicks per post."
              : search.error
                ? `Search Console: ${search.error}`
                : "Google numbers cover the last 28 days.")}
        </p>
      </div>

      {result && activeSlug && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <span className="text-sm font-medium">{activeSlug}.md</span>
            <div className="flex gap-1">
              {(["preview", "original", "optimized"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs capitalize",
                    view === v
                      ? "bg-surface-2 font-medium"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {v === "optimized" ? "New markdown" : v}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                Discard
              </Button>
              <Button size="sm" onClick={save} isLoading={saving}>
                Save
              </Button>
            </div>
          </div>
          {result.changesSummary.length > 0 && (
            <ul className="border-b border-border px-5 py-3 text-xs text-muted">
              {result.changesSummary.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <div className="max-h-150 overflow-auto p-5">
            {view === "preview" ? (
              <div
                className="prose-preview"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(result.optimizedMarkdown) as string,
                }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {view === "original"
                  ? result.originalMarkdown
                  : result.optimizedMarkdown}
              </pre>
            )}
          </div>
        </Card>
      )}

      {loading && posts.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {sorted.map((post) => {
            const issues = issuesOf(post);
            return (
              <li key={post.slug} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{post.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {site.blogPath}/{post.slug} · {post.wordCount.toLocaleString()} words
                    {issues.length > 0 && (
                      <span className="text-warn"> · {issues.join(", ")}</span>
                    )}
                  </p>
                </div>
                {search?.configured && !search.error && (
                  <PerformanceCell data={search.pages[post.slug]} />
                )}
                {issues.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => optimize(post.slug)}
                    isLoading={optimizingSlug === post.slug}
                    disabled={!!optimizingSlug}
                  >
                    Clean up
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Concrete, fixable problems the cleanup pass removes. Empty means the post is fine. */
function issuesOf(post: AuditedPost): string[] {
  const issues: string[] = [];
  const dashes = post.audit?.emDashCount ?? 0;
  const phrases = post.audit?.aiClicheCount ?? 0;
  const burstiness = post.audit?.burstinessScore ?? 100;
  if (dashes) issues.push(`${dashes} em-dash${dashes === 1 ? "" : "es"}`);
  if (phrases) issues.push(`${phrases} AI-sounding word${phrases === 1 ? "" : "s"}`);
  // Uniform sentence length is the strongest signal AI detectors use.
  if (burstiness < 70) issues.push("uniform sentence length");
  return issues;
}

function PerformanceCell({
  data,
}: {
  data?: SearchPerformance["pages"][string];
}) {
  if (!data)
    return (
      <span className="w-36 text-right text-xs text-muted">
        Not in Google yet
      </span>
    );
  return (
    <dl className="grid w-36 shrink-0 grid-cols-3 gap-2 text-right text-xs">
      <div>
        <dt className="text-muted">Clicks</dt>
        <dd className="font-medium tabular-nums">
          {data.clicks.toLocaleString()}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Views</dt>
        <dd className="font-medium tabular-nums">
          {data.impressions.toLocaleString()}
        </dd>
      </div>
      <div>
        <dt className="text-muted">Rank</dt>
        <dd className="font-medium tabular-nums">{data.position.toFixed(0)}</dd>
      </div>
    </dl>
  );
}

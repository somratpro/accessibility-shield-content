"use client";

import { cn } from "@/lib/utils";
import { ContentResult } from "@/types/content";
import { marked } from "marked";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useStudio } from "./studio-provider";
import { Card } from "./ui/card";

type View = "preview" | "markdown" | "seo";

export function PreviewTabs({
  content,
  onSave,
}: {
  content: ContentResult;
  onSave: () => Promise<void>;
}) {
  const { site } = useStudio();
  const [view, setView] = useState<View>("preview");
  const [saving, setSaving] = useState(false);
  const { meta_data: meta, quality_metrics: metrics } = content;

  const html = useMemo(() => marked.parse(content.humanized_content) as string, [content.humanized_content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content.markdown_with_frontmatter);
    toast.success("Copied");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="flex gap-1">
          {(["preview", "markdown", "seo"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs capitalize",
                view === v ? "bg-surface-2 font-medium" : "text-muted hover:text-fg",
              )}
            >
              {v === "seo" ? "SEO" : v}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {metrics.word_count.toLocaleString()} words · reading ease {metrics.flesch_reading_ease}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            Copy
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            Save post
          </Button>
        </div>
      </div>

      <div className="p-5">
        {view === "preview" && (
          <article>
            <h2 className="mb-4 text-xl font-semibold">{meta.title}</h2>
            <div className="prose-preview" dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        )}

        {view === "markdown" && (
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {content.markdown_with_frontmatter}
          </pre>
        )}

        {view === "seo" && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Search result</dt>
              <dd className="mt-1">
                <p className="text-xs text-muted">
                  {site.host}
                  {site.blogPath}/{meta.slug}
                </p>
                <p className="text-accent">{meta.meta_title}</p>
                <p className="text-muted">{meta.description}</p>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">File</dt>
              <dd className="break-all font-mono text-xs">
                {site.outputDir}/{content.filename}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Categories</dt>
              <dd>{meta.categories.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tags</dt>
              <dd>{meta.tags.join(", ")}</dd>
            </div>
          </dl>
        )}
      </div>
    </Card>
  );
}

"use client";

import { expectedImpact, Idea, IMPACT_STYLE, openIdeasByImpact } from "@/lib/ideas";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IdeasListSkeleton } from "./page-skeletons";
import { useStudio } from "./studio-provider";
import { Button } from "./ui/button";

export function IdeasView() {
  const router = useRouter();
  const { apiKey, hasApiKey, openKeyDialog } = useStudio();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas")
      .then((r) => r.json())
      .then((data) => Array.isArray(data.ideas) && setIdeas(data.ideas))
      .catch(() => toast.error("Couldn't load ideas"))
      .finally(() => setIsLoading(false));
  }, []);

  // Ideas that already have a post are done; the list only shows what's left to write.
  const open = openIdeasByImpact(ideas);

  const post = async (body: object) => {
    const data = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    if (!data.success) throw new Error(data.error);
    return data.ideas as Idea[];
  };

  const handleAdd = async () => {
    if (!hasApiKey) return openKeyDialog();
    setAdding(true);
    try {
      const next = await post({ action: "generate", apiKey: apiKey || undefined });
      const added = next.length - ideas.length;
      setIdeas(next);
      toast.success(added > 0 ? `Added ${added} ideas` : "No new ideas this time, try again");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't add ideas");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (idea: Idea) => {
    setRemoving(idea.id);
    try {
      setIdeas(await post({ action: "remove", id: idea.id }));
    } catch (err: any) {
      toast.error(err?.message || "Couldn't remove the idea");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">
            Ideas <span className="font-normal text-muted-foreground">({open.length})</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Highest estimated impact first.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          isLoading={adding}
          title="Ask AI for 6 new post ideas. Nothing is removed."
        >
          {adding ? "Thinking…" : "Add 6 ideas"}
        </Button>
      </div>

      {isLoading && open.length === 0 ? (
        <IdeasListSkeleton />
      ) : open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {ideas.length === 0
            ? "No ideas yet. Use “Add 6 ideas” to get your first post ideas."
            : "Every idea has been written. Add more when you're ready."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {open.map((idea) => {
            const impact = expectedImpact(idea);
            return (
              <li key={idea.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{idea.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className={IMPACT_STYLE[impact.level]}>
                      {impact.level} impact · {impact.goal}
                    </span>
                    {idea.category && ` · ${idea.category}`}
                    {idea.keywords[0] && ` · ${idea.keywords[0]}`}
                  </p>
                  {idea.rationale && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.rationale}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/write?idea=${encodeURIComponent(idea.id)}`)}
                >
                  Write
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemove(idea)}
                  isLoading={removing === idea.id}
                  aria-label={`Remove idea: ${idea.title}`}
                  title="Remove this idea"
                >
                  {removing !== idea.id && <X className="h-3.5 w-3.5" aria-hidden="true" />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

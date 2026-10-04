"use client";

import { CalendarTopic } from "@/lib/ai/calendar-generator";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStudio } from "./studio-provider";
import { Button } from "./ui/button";

type ImpactLevel = "High" | "Medium" | "Low";

// Planning estimate from the topic's intent and urgency (no search-volume data yet):
// commercial queries convert best, trust topics build credibility, informational brings traffic.
function expectedImpact(topic: CalendarTopic): {
  level: ImpactLevel;
  goal: string;
} {
  const intent =
    { Commercial: 3, Trust: 2, Informational: 1 }[
      topic.searchIntent
    ] ?? 1;
  const urgency = { Urgent: 3, High: 2, Medium: 1 }[topic.urgency] ?? 1;
  const score = intent + urgency;
  const level: ImpactLevel =
    score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
  const goal =
    topic.searchIntent === "Commercial"
      ? "Signups"
      : topic.searchIntent === "Trust"
        ? "Trust"
        : "Traffic";
  return { level, goal };
}

const IMPACT_STYLE: Record<ImpactLevel, string> = {
  High: "text-success",
  Medium: "text-warn",
  Low: "text-muted",
};

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CalendarView() {
  const router = useRouter();
  const { apiKey } = useStudio();
  const [topics, setTopics] = useState<CalendarTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => Array.isArray(data.topics) && setTopics(data.topics))
      .catch(() => toast.error("Couldn't load the calendar"))
      .finally(() => setIsLoading(false));
  }, []);

  // Published topics already exist in the output folder; the calendar only shows what's left to write.
  const planned = topics
    .filter((t) => t.status !== "published")
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  const handleAddIdeas = async () => {
    setRefreshing(true);
    try {
      const data = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", apiKey: apiKey || undefined }),
      }).then((r) => r.json());
      if (!data.success) throw new Error(data.error);
      const added = data.topics.length - topics.length;
      setTopics(data.topics);
      toast.success(added > 0 ? `Added ${added} ideas` : "No new ideas this time, try again");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't add ideas");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Up next</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddIdeas}
          isLoading={refreshing}
          title="Ask AI for 6 new topics, added after the last planned date. Nothing is removed."
        >
          {refreshing ? "Thinking…" : "Add 6 ideas"}
        </Button>
      </div>

      {isLoading && planned.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : planned.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
          {topics.length === 0
            ? "No topics planned yet. Use “Add 6 ideas” to plan your first posts."
            : "Everything in the calendar is published."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {planned.map((topic) => {
            const impact = expectedImpact(topic);
            return (
              <li key={topic.id} className="flex items-start gap-4 p-4">
                <time
                  dateTime={topic.targetDate}
                  className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted"
                >
                  {formatDate(topic.targetDate)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{topic.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    <span className={IMPACT_STYLE[impact.level]}>
                      {impact.level} impact · {impact.goal}
                    </span>
                    {" · "}
                    {topic.keywords[0]}
                  </p>
                  {topic.rationale && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {topic.rationale}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/write?topic=${encodeURIComponent(topic.id)}`)}
                >
                  Write
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Shared by the server (storage, dashboard) and the client (Ideas page). No Node imports.

export const SEARCH_INTENTS = ["Informational", "Commercial", "Trust"] as const;

export interface Idea {
  id: string;
  title: string;
  slug: string;
  category: string;
  keywords: string[];
  searchIntent: (typeof SEARCH_INTENTS)[number];
  urgency: "Urgent" | "High" | "Medium";
  rationale: string;
  /** "published" once a post with this slug exists in CONTENT_DIR */
  status: "idea" | "published";
  /** ISO date the idea was added */
  addedAt?: string;
}

export type ImpactLevel = "High" | "Medium" | "Low";

// Planning estimate from the idea's intent and urgency (no search-volume data yet):
// commercial queries convert best, trust topics build credibility, informational brings traffic.
export function expectedImpact(idea: Idea): {
  level: ImpactLevel;
  score: number;
  goal: string;
} {
  const intent =
    { Commercial: 3, Trust: 2, Informational: 1 }[idea.searchIntent] ?? 1;
  const urgency = { Urgent: 3, High: 2, Medium: 1 }[idea.urgency] ?? 1;
  const score = intent + urgency;
  const level: ImpactLevel =
    score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
  const goal =
    idea.searchIntent === "Commercial"
      ? "Signups"
      : idea.searchIntent === "Trust"
        ? "Trust"
        : "Traffic";
  return { level, score, goal };
}

/** Unwritten ideas, highest estimated impact first, then oldest first. */
export function openIdeasByImpact(ideas: Idea[]): Idea[] {
  return ideas
    .map((idea, index) => ({ idea, index, score: expectedImpact(idea).score }))
    .filter(({ idea }) => idea.status !== "published")
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ idea }) => idea);
}

export const IMPACT_STYLE: Record<ImpactLevel, string> = {
  High: "text-success",
  Medium: "text-warn",
  Low: "text-muted",
};

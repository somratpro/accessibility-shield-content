import fs from "fs";
import path from "path";
import { audienceLine } from "../brand-prompt";
import { getExistingBlogPosts } from "../posts-store";
import { requireStudioConfig } from "../studio-config";
import { slugify } from "../utils";
import { generateTextWithResilience } from "./groq-client";

export const SEARCH_INTENTS = ["Informational", "Commercial", "Trust"] as const;

export interface CalendarTopic {
  id: string;
  title: string;
  slug: string;
  category: string;
  keywords: string[];
  targetWeek: string;
  targetDate: string;
  searchIntent: (typeof SEARCH_INTENTS)[number];
  urgency: "Urgent" | "High" | "Medium";
  rationale: string;
  status: "planned" | "generated" | "published";
}

const calendarPath = () => requireStudioConfig().site.calendarFile;

// Calendars from older versions used "Legal / Risk" for trust-building topics.
function normalizeIntent(intent: unknown): CalendarTopic["searchIntent"] {
  if (SEARCH_INTENTS.includes(intent as CalendarTopic["searchIntent"])) {
    return intent as CalendarTopic["searchIntent"];
  }
  return intent === "Legal / Risk" ? "Trust" : "Informational";
}

/**
 * Loads the calendar from CALENDAR_FILE, marking topics whose slug already exists in
 * the output folder as published. A missing file is an empty calendar.
 */
export function getSavedCalendar(): CalendarTopic[] {
  const file = calendarPath();
  const existingSlugs = new Set(getExistingBlogPosts().map((p) => p.slug));

  let topics: CalendarTopic[] = [];
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (Array.isArray(data)) topics = data;
    } catch (e) {
      console.warn("Could not read stored calendar:", e);
    }
  }

  return topics.map((item) => ({
    ...item,
    searchIntent: normalizeIntent(item.searchIntent),
    status: existingSlugs.has(item.slug)
      ? "published"
      : item.status || "planned",
  }));
}

/**
 * Saves calendar state to disk.
 */
export function saveCalendar(topics: CalendarTopic[]): void {
  const file = calendarPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(topics, null, 2), "utf-8");
}

/**
 * Generates 6 new AI topic ideas, appended after the current plan.
 */
export async function generateFreshAICalendar(
  apiKey?: string,
): Promise<CalendarTopic[]> {
  const { site, brand } = requireStudioConfig();
  const existingPosts = getExistingBlogPosts();
  const existingTitles = existingPosts.map((p) => p.title).join("; ");
  const existingSlugs = new Set(existingPosts.map((p) => p.slug));

  try {
    const current = getSavedCalendar();
    const plannedTitles = current
      .filter((t) => t.status !== "published")
      .map((t) => t.title)
      .join("; ");

    // New ideas are appended after the existing plan: first Wednesday after the
    // later of today and the last planned date.
    const today = new Date();
    const lastPlanned = current.reduce(
      (max, t) => (t.targetDate > max ? t.targetDate : max),
      today.toISOString().split("T")[0],
    );
    const firstSlot = new Date(`${lastPlanned}T00:00:00Z`);
    firstSlot.setUTCDate(
      firstSlot.getUTCDate() + ((3 - firstSlot.getUTCDay() + 7) % 7 || 7),
    );
    const firstSlotIso = firstSlot.toISOString().split("T")[0];

    const product = [
      ...brand.product.does,
      ...brand.product.pages.map((p) => `${p.label} at ${p.url}`),
    ];
    const priorities = [
      "Questions real people type into Google about the audience's problems.",
      brand.competitors.length
        ? `Bottom-of-funnel queries: "<competitor> alternative", templates, checklists and how-to guides for specific tools or situations.`
        : "Bottom-of-funnel queries: templates, checklists and how-to guides for specific tools or situations.",
      "Long-tail over head terms. Avoid topics only large enterprises search for.",
      ...brand.planning,
    ];
    const rules = [
      ...brand.facts.banned.map(
        (claim) => `Never plan content that relies on this claim: ${claim}`,
      ),
      "Never plan content that relies on fear stats without a source.",
      `Never plan articles about alternatives to ${brand.name}, comparisons that favour other tools, or articles about ${brand.name}'s own features.${brand.competitors.length ? ` "Alternative" pages are only for competitors (${brand.competitors.join(", ")}).` : ""}`,
      ...brand.avoidTopics.map((t) => `Avoid: ${t}`),
    ];
    const categoryNames = brand.categories.map((c) => c.name);
    const categoryType = categoryNames.length
      ? categoryNames.map((c) => JSON.stringify(c)).join(" | ")
      : "string (a short blog category)";

    const prompt = `You are the Head of SEO for ${brand.name} (${site.host}). ${brand.summary}

TODAY: ${today.toISOString().split("T")[0]}

ALREADY PUBLISHED (do not repeat these topics):
${existingTitles || "none"}

ALREADY PLANNED (do not repeat these topics either):
${plannedTitles || "none"}

WHAT ${brand.name.toUpperCase()} OFFERS:
${product.length ? product.map((p) => `- ${p}`).join("\n") : `- ${brand.summary}`}
- Audience: ${audienceLine(brand)}

TASK:
Plan 6 NEW articles a new, low-authority site can realistically rank for. Prioritise:
${priorities.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${rules.join("\n")}

OUTPUT FORMAT:
Return a strictly valid JSON array of 6 objects with NO markdown, NO backticks, NO commentary.
Each object must match:
{
  "id": string (kebab-case unique id),
  "title": string (under 65 characters, contains the main query, no em-dashes),
  "slug": string (2-6 words, kebab-case, no year, no stop words),
  "category": ${categoryType},
  "keywords": string[] (main query first, then 3-4 related searches),
  "targetWeek": string ("Week 1" to "Week 6", counted from the first date below),
  "targetDate": string ("YYYY-MM-DD", weekly starting ${firstSlotIso}),
  "searchIntent": "Informational" | "Commercial" | "Trust" (Trust = builds credibility: risks, rules, myths, comparisons of approaches),
  "urgency": "Urgent" | "High" | "Medium",
  "rationale": string (1-2 sentences: who searches this and why it converts)
}`;

    // gpt-oss is a reasoning model: hidden reasoning counts against maxTokens,
    // so 6 topics need far more than the visible JSON length.
    const { text, finishReason } = await generateTextWithResilience({
      prompt,
      temperature: 0.7,
      maxTokens: 8000,
      apiKey,
    });

    if (finishReason === "length") {
      throw new Error(
        "The model ran out of tokens before finishing. Try again.",
      );
    }

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) {
      throw new Error("The model didn't return a topic list. Try again.");
    }

    const parsed = (
      JSON.parse(text.slice(start, end + 1)) as Array<
        Omit<CalendarTopic, "status">
      >
    )
      .filter((item) => typeof item?.title === "string" && item.title.trim())
      .map((item) => ({
        ...item,
        slug: slugify(item.slug || item.title),
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        searchIntent: normalizeIntent(item.searchIntent),
      }));

    if (parsed.length === 0) {
      throw new Error("The model returned no usable topics. Try again.");
    }

    const freshTopics: CalendarTopic[] = parsed.map((item, idx) => ({
      ...item,
      id: item.id || `topic-${idx + 1}-${Date.now()}`,
      status: existingSlugs.has(item.slug) ? "published" : "planned",
    }));

    // Append to the existing plan, skipping anything already in it.
    const knownSlugs = new Set([
      ...current.map((t) => t.slug),
      ...existingSlugs,
    ]);
    const fullTopics = [
      ...current,
      ...freshTopics.filter((t) => !knownSlugs.has(t.slug)),
    ];

    saveCalendar(fullTopics);
    return fullTopics;
  } catch (error: any) {
    // Leave the saved calendar untouched and let the UI show the real error.
    console.warn("AI calendar generation failed:", error);
    throw new Error(
      error instanceof SyntaxError
        ? "The model returned malformed JSON. Try again."
        : error?.message || "Calendar generation failed",
    );
  }
}

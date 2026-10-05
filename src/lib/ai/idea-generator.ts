import fs from "fs";
import path from "path";
import { audienceLine } from "../brand-prompt";
import { Idea, SEARCH_INTENTS } from "../ideas";
import { getExistingBlogPosts } from "../posts-store";
import { requireStudioConfig } from "../studio-config";
import { slugify } from "../utils";
import { generateTextWithResilience } from "./groq-client";

const ideasPath = () => requireStudioConfig().site.ideasFile;

// Older versions stored "Legal / Risk" for trust-building topics.
function normalizeIntent(intent: unknown): Idea["searchIntent"] {
  if (SEARCH_INTENTS.includes(intent as Idea["searchIntent"])) {
    return intent as Idea["searchIntent"];
  }
  return intent === "Legal / Risk" ? "Trust" : "Informational";
}

function normalizeIdea(raw: any, published: Set<string>): Idea {
  const slug = slugify(raw.slug || raw.title);
  return {
    id: String(raw.id || slug),
    title: String(raw.title).trim(),
    slug,
    category: typeof raw.category === "string" ? raw.category : "",
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.filter((k: unknown) => typeof k === "string")
      : [],
    searchIntent: normalizeIntent(raw.searchIntent),
    urgency: ["Urgent", "High", "Medium"].includes(raw.urgency)
      ? raw.urgency
      : "Medium",
    rationale: typeof raw.rationale === "string" ? raw.rationale : "",
    status: published.has(slug) ? "published" : "idea",
    addedAt: typeof raw.addedAt === "string" ? raw.addedAt : undefined,
  };
}

/**
 * Loads the ideas list (content-ideas.json next to the context file), marking ideas
 * whose slug already exists in the content folder as published. A missing file is an
 * empty list.
 */
export function getSavedIdeas(): Idea[] {
  const file = ideasPath();
  if (!fs.existsSync(file)) return [];
  const published = new Set(getExistingBlogPosts().map((p) => p.slug));
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => typeof item?.title === "string" && item.title.trim())
      .map((item) => normalizeIdea(item, published));
  } catch (e) {
    console.warn("Could not read stored ideas:", e);
    return [];
  }
}

export function saveIdeas(ideas: Idea[]): void {
  const file = ideasPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ideas, null, 2), "utf-8");
}

/** Removes one idea. Returns the remaining list. */
export function removeIdea(id: string): Idea[] {
  const remaining = getSavedIdeas().filter((idea) => idea.id !== id);
  saveIdeas(remaining);
  return remaining;
}

/**
 * Asks the model for 6 new post ideas and adds them to the list, skipping anything
 * already published or in the list.
 */
export async function generateIdeas(apiKey?: string): Promise<Idea[]> {
  const { site, brand } = requireStudioConfig();
  const existingPosts = getExistingBlogPosts();
  const existingTitles = existingPosts.map((p) => p.title).join("; ");
  const published = new Set(existingPosts.map((p) => p.slug));

  try {
    const current = getSavedIdeas();
    const openTitles = current
      .filter((t) => t.status !== "published")
      .map((t) => t.title)
      .join("; ");
    const today = new Date().toISOString().split("T")[0];

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
        (claim) => `Never suggest content that relies on this claim: ${claim}`,
      ),
      "Never suggest content that relies on fear stats without a source.",
      `Never suggest articles about alternatives to ${brand.name}, comparisons that favour other tools, or articles about ${brand.name}'s own features.${brand.competitors.length ? ` "Alternative" pages are only for competitors (${brand.competitors.join(", ")}).` : ""}`,
      ...brand.avoidTopics.map((t) => `Avoid: ${t}`),
    ];
    const categoryNames = brand.categories.map((c) => c.name);
    const categoryType = categoryNames.length
      ? categoryNames.map((c) => JSON.stringify(c)).join(" | ")
      : "string (a short blog category)";

    const prompt = `You are the Head of SEO for ${brand.name} (${site.host}). ${brand.summary}

TODAY: ${today}

ALREADY PUBLISHED (do not repeat these topics):
${existingTitles || "none"}

ALREADY IN THE IDEAS LIST (do not repeat these topics either):
${openTitles || "none"}

WHAT ${brand.name.toUpperCase()} OFFERS:
${product.length ? product.map((p) => `- ${p}`).join("\n") : `- ${brand.summary}`}
- Audience: ${audienceLine(brand)}

TASK:
Suggest 6 NEW articles a new, low-authority site can realistically rank for. Prioritise:
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
  "searchIntent": "Informational" | "Commercial" | "Trust" (Trust = builds credibility: risks, rules, myths, comparisons of approaches),
  "urgency": "Urgent" | "High" | "Medium" (Urgent = timely right now: seasonal, or a recent change people are searching about),
  "rationale": string (1-2 sentences: who searches this and why it converts)
}`;

    // gpt-oss is a reasoning model: hidden reasoning counts against maxTokens,
    // so 6 ideas need far more than the visible JSON length.
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
      throw new Error("The model didn't return a list of ideas. Try again.");
    }

    const parsed = (JSON.parse(text.slice(start, end + 1)) as unknown[])
      .filter((item: any) => typeof item?.title === "string" && item.title.trim())
      .map((item: any) => ({
        ...normalizeIdea(item, published),
        addedAt: new Date().toISOString(),
      }));

    if (parsed.length === 0) {
      throw new Error("The model returned no usable ideas. Try again.");
    }

    // Add to the list, skipping anything already published or listed.
    const knownSlugs = new Set([...current.map((t) => t.slug), ...published]);
    const knownIds = new Set(current.map((t) => t.id));
    const fresh = parsed.filter((idea) => {
      if (knownSlugs.has(idea.slug)) return false;
      knownSlugs.add(idea.slug);
      if (knownIds.has(idea.id)) idea.id = `${idea.slug}-${Date.now()}`;
      knownIds.add(idea.id);
      return true;
    });

    const all = [...current, ...fresh];
    saveIdeas(all);
    return all;
  } catch (error: any) {
    // Leave the saved ideas untouched and let the UI show the real error.
    console.warn("Idea generation failed:", error);
    throw new Error(
      error instanceof SyntaxError
        ? "The model returned malformed JSON. Try again."
        : error?.message || "Idea generation failed",
    );
  }
}

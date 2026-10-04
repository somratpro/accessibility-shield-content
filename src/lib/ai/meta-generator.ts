import { MetaData } from "@/types/content";
import { renderMarkdownWithFrontmatter } from "../frontmatter";
import { BrandContext, requireStudioConfig } from "../studio-config";
import { tokenizeSentences } from "../text-processor";
import { generateExcerpt, slugify } from "../utils";

const SLUG_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "your",
  "you",
  "our",
  "that",
  "this",
  "is",
  "are",
  "s",
]);

// Short, keyword-first slugs rank and share better than full-title slugs.
export function buildShortSlug(title: string, maxWords: number = 8): string {
  const words = slugify(title.replace(/\(\d{4}\)/g, ""))
    .split("-")
    .filter((w) => w && !SLUG_STOP_WORDS.has(w));
  return words.slice(0, maxWords).join("-");
}

// Google shows roughly 60 characters of a title. Sites usually append " | Site name".
export function buildMetaTitle(title: string): string {
  if (title.length <= 60) return title;
  const beforeColon = title.split(":")[0].trim();
  if (beforeColon.length >= 25 && beforeColon.length <= 60) return beforeColon;
  const cut = title.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,:;\s-]+$/, "");
}

// 120-155 characters, ending on a whole sentence when possible.
export function buildMetaDescription(content: string): string {
  const firstProse =
    content
      .split("\n\n")
      .map((p) => p.trim())
      .find(
        (p) => p.length > 60 && !/^(#|>|\||```|[-*+] |\d+\. |---|<)/.test(p),
      ) || content.slice(0, 400);

  const plain = firstProse
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = tokenizeSentences(plain);
  let description = "";
  for (const sentence of sentences) {
    const next = description ? `${description} ${sentence}` : sentence;
    if (next.length > 155) break;
    description = next;
  }

  if (description.length >= 90) return description;
  return generateExcerpt(plain, 152);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(text: string, phrase: string): boolean {
  return new RegExp(`(^|\\W)${escapeRegex(phrase.toLowerCase())}(\\W|$)`).test(text);
}

/**
 * Picks up to two categories from the context file: the planned category if it's one of
 * them, else the categories whose keywords (or name) the title and keywords mention most,
 * falling back to defaultCategory.
 */
function pickCategories(
  brand: BrandContext,
  topic: string,
  targetKeywords: string[],
  preferred?: string,
): string[] {
  const text = [topic, ...targetKeywords].join(" ").toLowerCase();
  const known = brand.categories;
  const canonical = (name?: string) =>
    name &&
    (known.find((c) => c.name.toLowerCase() === name.toLowerCase())?.name ??
      (known.length === 0 ? name : undefined));

  const ranked = known
    .map((c) => ({
      name: c.name,
      score:
        c.keywords.filter((k) => mentions(text, k)).length +
        (mentions(text, c.name) ? 1 : 0),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.name);

  const fallback = canonical(brand.defaultCategory) || known[0]?.name;
  const primary = canonical(preferred) || ranked[0] || fallback;
  const secondary = ranked.find((name) => name !== primary) || fallback;
  return Array.from(new Set([primary, secondary].filter(Boolean) as string[]));
}

// Always kept uppercase in tags; the context file's `acronyms` adds to these.
const BASE_ACRONYMS = ["ai", "api", "faq", "seo", "url"];

function titleCase(phrase: string, acronyms: Set<string>): string {
  return phrase
    .split(" ")
    .map((w) => {
      if (acronyms.has(w.toLowerCase())) return w.toUpperCase();
      return /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}

export function generateMetaContent(
  content: string,
  topic: string,
  targetKeywords: string[],
  _customInstruction?: string,
  retryAttempt: number = 0,
  calendar?: { slug?: string; category?: string },
): MetaData {
  const { brand } = requireStudioConfig();
  const title = topic.trim().replace(/[.\s]+$/, "");
  const metaTitle = buildMetaTitle(title);
  const metaDescription = buildMetaDescription(content);

  const baseSlug = calendar?.slug
    ? slugify(calendar.slug)
    : buildShortSlug(title);
  const slug = retryAttempt > 0 ? `${baseSlug}-${retryAttempt + 1}` : baseSlug;

  const categories = pickCategories(
    brand,
    title,
    targetKeywords,
    calendar?.category,
  );

  const acronyms = new Set(
    [...BASE_ACRONYMS, ...brand.acronyms].map((a) => a.toLowerCase()),
  );
  const tags = Array.from(
    new Set(
      targetKeywords.slice(0, 6).map((k) => titleCase(k.trim(), acronyms)),
    ),
  );

  return {
    title,
    meta_title: metaTitle,
    description: metaDescription,
    keywords: targetKeywords.join(", "),
    og_title: title,
    og_description: metaDescription,
    twitter_title: title,
    twitter_description: metaDescription,
    categories,
    tags,
    slug,
    date: new Date().toISOString(),
    draft: false,
  };
}

export function buildMarkdownWithFrontmatter(
  meta: MetaData,
  markdownBody: string,
): string {
  return renderMarkdownWithFrontmatter(
    requireStudioConfig().brand,
    meta,
    markdownBody,
  );
}

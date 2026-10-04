import { BrandContext, StudioConfig } from "./studio-config";

const bullets = (items: string[], indent = "- ") =>
  items.map((item) => `${indent}${item}`).join("\n");

/** Short description of who the site writes for, used inside prompts. */
export function audienceLine(brand: BrandContext, fallback = "the site's readers"): string {
  return brand.audience.length
    ? brand.audience.map((a) => a.name).join(", ")
    : fallback;
}

/** The main reader, phrased for "explaining this to ___" (e.g. "small-business owners"). */
export function primaryReader(brand: BrandContext, fallback = "a busy reader"): string {
  const name = brand.audience[0]?.name;
  if (!name) return fallback;
  // Lowercase an ordinary leading capital; acronyms ("SaaS", "IT") keep theirs.
  const firstWord = name.split(/\s/)[0];
  return /^[A-Z][a-z'-]*$/.test(firstWord)
    ? name.charAt(0).toLowerCase() + name.slice(1)
    : name;
}

export function describeFact(fact: { fact: string; source?: string }): string {
  return fact.source ? `${fact.fact} [Source to name: ${fact.source}]` : fact.fact;
}

/**
 * Brand and fact guidance injected into every writing prompt. Built from the context
 * file; the editorial rules at the end apply to every site.
 */
export function buildBrandPrompt({ site, brand }: StudioConfig): string {
  const parts: string[] = [];

  parts.push(
    `ABOUT ${brand.name.toUpperCase()} (${site.host}):\n${brand.summary}${brand.tagline ? `\nTagline: ${brand.tagline}` : ""}`,
  );

  if (brand.product.does.length) {
    parts.push(
      `WHAT ${brand.name.toUpperCase()} ACTUALLY DOES (only describe these, never invent features):\n${bullets(brand.product.does)}`,
    );
  }
  if (brand.product.doesNot.length) {
    parts.push(
      `WHAT IT DOES NOT DO (never claim these):\n${bullets(brand.product.doesNot)}`,
    );
  }
  if (brand.product.pages.length) {
    parts.push(
      `PAGES YOU MAY LINK TO:\n${bullets(brand.product.pages.map((p) => `${p.url}: ${p.label}`))}`,
    );
  }

  if (brand.audience.length) {
    parts.push(
      `AUDIENCE:\n${bullets(brand.audience.map((a) => (a.needs ? `${a.name}: ${a.needs}` : a.name)))}`,
    );
  }

  const factRules = [
    "Never invent statistics, case stories, work \"we did\", customer counts, testimonials, quotes or official rulings. If you use a number, it must be widely published and you must name the source naturally in the sentence (\"A 2024 report from X found...\"), never as a \"(source: ...)\" tag.",
    ...brand.facts.banned.map((claim) => `Never claim or imply: ${claim}`),
  ];
  if (brand.facts.allowed.length) {
    factRules.push(
      `Safe, well-documented facts you may use:\n${bullets(brand.facts.allowed.map(describeFact), "  * ")}`,
    );
  }
  if (brand.disclaimer?.triggers.length) {
    factRules.push(
      `When the article discusses ${brand.disclaimer.triggers.slice(0, 8).join(", ")}, include a one-line reminder that this is general information, not professional advice.`,
    );
  }
  parts.push(`FACT RULES (these protect readers and the brand):\n${bullets(factRules)}`);

  if (brand.guide) parts.push(`BRAND GUIDE:\n${brand.guide}`);

  parts.push(`EDITORIAL & VOICE STANDARDS:
- Practical, plain English. Write for ${audienceLine(brand, "a busy reader")}.
- Answer the reader's search question directly in the first two or three sentences, then go deeper.
- ZERO EM-DASHES (—). Use commas, parentheses, colons, or separate sentences.
- Vary sentence length naturally. Short sentences are fine. Every sentence must end with punctuation.
- No AI clichés: "In conclusion", "delve into", "tapestry", "moreover", "furthermore", "beacon", "testament", "in today's digital landscape".`);

  return parts.join("\n\n");
}

import matter from "gray-matter";
import { requireStudioConfig } from "../studio-config";
import { TextProcessor, tokenizeSentences } from "../text-processor";
import {
  isStructuralBlock,
  removeEmDashes,
  splitContentPreservingTables,
} from "../utils";
import { postIssues } from "../post-issues";
import { applyAdvancedHumanization } from "./content-humanizer";
import { humanizeArticle } from "./humanizer";
import { optimizeInternalLinking } from "./internal-linker";

export interface AntiAIAuditResult {
  emDashCount: number;
  aiClicheCount: number;
  clicheMatches: string[];
  burstinessScore: number; // 0 - 100 (higher = more human variance)
  fleschScore: number;
  readingEaseLabel: string;
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  healthScore: number; // 0 - 100
  riskLevel: "Low" | "Moderate" | "High";
  suggestions: string[];
}

export const AI_CLICHE_PHRASES = [
  "in conclusion",
  "delve into",
  "delving into",
  "a testament to",
  "tapestry of",
  "in today's fast-paced",
  "in today's digital landscape",
  "fast-paced digital landscape",
  "moreover",
  "furthermore",
  "it is important to remember",
  "it is worth noting",
  "game-changer",
  "beacon of",
  "navigating the complex",
  "vital role",
  "crucial role",
  "plays a crucial role",
  "dive deep into",
  "dive deep",
  "in this blog post",
  "in this comprehensive guide",
  "let's explore",
  "unlock the power",
  "without further ado",
  "at the end of the day",
  "utilize",
  "leverage",
  "ensure",
  "crucial",
  "comprehensive",
  "robust",
  "seamless",
  "seamlessly",
  "additionally",
  "ultimately",
  "pivotal",
  "paramount",
  "myriad",
  "plethora",
  "streamline",
  "empower",
  "it's important to note",
  "in summary",
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words from the context file's allowedWords, lowercased. */
function allowedWords(): string[] {
  return requireStudioConfig().brand.allowedWords.map((w) => w.toLowerCase());
}

const mentionsAllowed = (phrase: string, allowed: string[]) =>
  allowed.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`, "i").test(phrase));

// Code, inline code and link targets: never counted as prose, never edited.
const PROTECTED = /(^[ \t]*(?:```|~~~)[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$|`[^`\n]*`|\]\([^)]*\))/m;

/** Applies `fn` to everything outside code and link targets (headings and lists included). */
function mapText(body: string, fn: (text: string) => string): string {
  return body
    .split(new RegExp(PROTECTED.source, "gm"))
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/** The prose parts only (what readers and AI detectors see as writing). */
const textOnly = (body: string) =>
  body
    .split(new RegExp(PROTECTED.source, "gm"))
    .filter((_, i) => i % 2 === 0)
    .join(" ");

// Plain replacements for AI-sounding phrases, longest first. Matching ignores case and
// keeps a leading capital. Each entry fixes the cliché named in its pattern, so the
// cleanup can remove everything the audit counts (except allowedWords).
const WORD_FIXES: [string, string][] = [
  ["in today's fast-paced digital landscape", "these days"],
  ["in today's digital landscape", "these days"],
  ["fast-paced digital landscape", "fast-moving online world"],
  ["in today's fast-paced", "in today's busy"],
  ["in this comprehensive guide", "in this guide"],
  ["in this blog post,?", "below,"],
  ["in conclusion,?", "the takeaway:"],
  ["in summary,?", "in short,"],
  ["it is important to remember that", "keep in mind that"],
  ["it is important to remember", "keep in mind"],
  ["it(?: is|'s) important to note that", "note that"],
  ["it(?: is|'s) important to note", "note"],
  ["it is worth noting that", "notably,"],
  ["it is worth noting", "note"],
  ["plays a crucial role in", "directly affects"],
  ["crucial role", "central role"],
  ["vital role", "key role"],
  ["navigating the complex world of", "managing"],
  ["navigating the complex", "handling the complex"],
  ["without further ado,?", "so,"],
  ["at the end of the day", "in the end"],
  ["unlock the power of", "make the most of"],
  ["unlock the power", "make the most"],
  ["let's explore", "let's look at"],
  ["to delve into", "to look at"],
  ["delving into", "digging into"],
  ["delve into", "dig into"],
  ["dive deep into", "look closely at"],
  ["dive deep", "look closely"],
  ["a testament to", "clear proof of"],
  ["tapestry of", "mix of"],
  ["beacon of", "model of"],
  ["game-changer", "big shift"],
  ["moreover,?", "what's more,"],
  ["furthermore,?", "beyond that,"],
  ["additionally", "also"],
  ["ultimately", "in the end"],
  ["ensure that", "make sure"],
  ["ensures", "makes sure"],
  ["ensured", "made sure"],
  ["ensuring", "making sure"],
  ["ensure", "make sure"],
  ["utilizes", "uses"],
  ["utilized", "used"],
  ["utilizing", "using"],
  ["utilize", "use"],
  ["leverages", "uses"],
  ["leveraged", "used"],
  ["leveraging", "using"],
  ["leverage", "use"],
  ["seamlessly", "smoothly"],
  ["seamless", "smooth"],
  ["streamlines", "simplifies"],
  ["streamlined", "simplified"],
  ["streamlining", "simplifying"],
  ["streamline", "simplify"],
  ["empowers", "helps"],
  ["empowering", "helping"],
  ["empower", "help"],
  ["comprehensive", "complete"],
  ["crucial", "important"],
  ["robust", "solid"],
  ["pivotal", "key"],
  ["paramount", "most important"],
  ["a myriad of", "lots of"],
  ["myriad of", "lots of"],
  ["myriad", "many"],
  ["a plethora of", "lots of"],
  ["plethora of", "lots of"],
];

/** Swaps AI-sounding phrases for plain ones outside code and links. Returns the count. */
export function fixAiWords(body: string): { text: string; count: number } {
  const allowed = allowedWords();
  const fixes = WORD_FIXES.filter(([phrase]) => !mentionsAllowed(phrase.replace(/[,?]/g, ""), allowed)).map(
    ([phrase, plain]) => [new RegExp(`\\b${phrase.replace(/'/g, "['’]")}(?![\\w-])`, "gi"), plain] as const,
  );
  let count = 0;
  const text = mapText(body, (part) =>
    fixes.reduce(
      (acc, [pattern, plain]) =>
        acc.replace(pattern, (match) => {
          count++;
          return /^[A-Z]/.test(match) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain;
        }),
      part,
    ),
  );
  return { text, count };
}

/**
 * Audits text for AI patterns: em-dashes, clichés, sentence uniformity.
 */
export function auditContentForAntiAI(rawMarkdown: string): AntiAIAuditResult {
  const parsed = matter(rawMarkdown);
  const body = parsed.content || rawMarkdown;

  // 1. Em-dashes count (— and &mdash;)
  const emDashMatches = body.match(/—|&mdash;/g);
  const emDashCount = emDashMatches ? emDashMatches.length : 0;

  // 2. AI Clichés, in prose only (not code or link targets), skipping the site's allowedWords
  const lowerBody = textOnly(body).toLowerCase();
  const allowed = allowedWords();
  const clicheMatches: string[] = [];
  for (const phrase of AI_CLICHE_PHRASES) {
    if (mentionsAllowed(phrase, allowed)) continue;
    const regex = new RegExp(
      `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    const count = (lowerBody.match(regex) || []).length;
    if (count > 0) {
      clicheMatches.push(`${phrase} (${count}x)`);
    }
  }
  const aiClicheCount = clicheMatches.length;

  // 3. Sentence burstiness analysis, on prose paragraphs only. Headings and list items have
  // no end punctuation and would merge into giant "sentences" that fake high variance.
  const sentences = splitContentPreservingTables(body)
    .filter((block) => !isStructuralBlock(block))
    .flatMap((block) => tokenizeSentences(block));
  const sentenceCount = sentences.length;
  let wordCount = 0;
  const sentenceLengths: number[] = [];

  for (const s of sentences) {
    const wCount = s.trim().split(/\s+/).filter(Boolean).length;
    if (wCount > 0) {
      wordCount += wCount;
      sentenceLengths.push(wCount);
    }
  }

  const avgSentenceLength =
    sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  // Variance & standard deviation for burstiness
  let burstinessScore = 50;
  if (sentenceLengths.length > 2) {
    const variance =
      sentenceLengths.reduce(
        (acc, len) => acc + Math.pow(len - avgSentenceLength, 2),
        0,
      ) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);
    // Humans typically have stdDev > 7. AI typically has stdDev < 4.5.
    burstinessScore = Math.min(100, Math.round((stdDev / 10) * 100));
  }

  // 4. Flesch Reading Ease
  const metrics = TextProcessor.analyzeText(body);
  const fleschScore = metrics.flesch_reading_ease;

  // 5. Overall Health Score Calculation (100 is best)
  let healthScore = 100;
  // Penalty for em-dashes (-4 pts each, capped at -40)
  healthScore -= Math.min(40, emDashCount * 4);
  // Penalty for clichés (-5 pts each, capped at -30)
  healthScore -= Math.min(30, aiClicheCount * 6);
  // Penalty for low burstiness (uniform sentences)
  if (burstinessScore < 45) {
    healthScore -= Math.round((45 - burstinessScore) * 0.5);
  }

  healthScore = Math.max(10, Math.min(100, healthScore));

  const riskLevel: "Low" | "Moderate" | "High" =
    healthScore >= 80 ? "Low" : healthScore >= 55 ? "Moderate" : "High";

  const suggestions: string[] = [];
  if (emDashCount > 0) {
    suggestions.push(
      `Remove ${emDashCount} em-dash (—) occurrences to eliminate the #1 AI giveaway.`,
    );
  }
  if (aiClicheCount > 0) {
    suggestions.push(
      `Eliminate robotic transitions: ${clicheMatches.slice(0, 3).join(", ")}.`,
    );
  }
  if (burstinessScore < 50) {
    suggestions.push(
      "Increase sentence burstiness: mix short 3-5 word sentences with longer analytical observations.",
    );
  }
  if (body.includes("In conclusion")) {
    suggestions.push(
      "Replace 'In conclusion' with an actionable takeaway or a forward-looking summary.",
    );
  }
  const { brand } = requireStudioConfig();
  const pages = brand.product.pages.map((p) => p.url);
  if (pages.length && !pages.some((url) => body.includes(`](${url})`))) {
    suggestions.push(
      `Add internal links to ${brand.name} pages (${pages.slice(0, 3).join(", ")}).`,
    );
  }

  const readingEaseLabel =
    fleschScore >= 70
      ? "Conversational"
      : fleschScore >= 55
        ? "Professional / Accessible"
        : fleschScore >= 40
          ? "Technical"
          : "Complex";

  return {
    emDashCount,
    aiClicheCount,
    clicheMatches,
    burstinessScore,
    fleschScore,
    readingEaseLabel,
    wordCount,
    sentenceCount,
    avgSentenceLength,
    healthScore,
    riskLevel,
    suggestions,
  };
}

export interface OptimizationResult {
  originalMarkdown: string;
  optimizedMarkdown: string;
  beforeAudit: AntiAIAuditResult;
  afterAudit: AntiAIAuditResult;
  /** What the cleaned version still fails (empty = passes all checks) */
  remainingIssues: string[];
  changesSummary: string[];
}

// Rewrite passes per cleanup. Each pass is a full Qwen rewrite, so keep this small.
const MAX_REWRITE_PASSES = 3;

const list = (items: string[]) => items.join(", ");

// Fewer issues wins; then the more varied sentence rhythm, then the healthier score.
const isBetter = (a: AntiAIAuditResult, b: AntiAIAuditResult) =>
  postIssues(a).length - postIssues(b).length ||
  b.burstinessScore - a.burstinessScore ||
  b.healthScore - a.healthScore;

/**
 * Cleans up an existing post, then checks it again: the deterministic fixes run first,
 * and while the result still fails a check, it gets another spoken-voice rewrite (up to
 * MAX_REWRITE_PASSES). Every pass starts from the same cleaned text, so fillers from one
 * pass never stack onto the next; the version with the fewest remaining issues wins.
 */
export async function optimizeBlogPostWithAntiAI(
  rawMarkdown: string,
  apiKey?: string,
): Promise<OptimizationResult> {
  const beforeAudit = auditContentForAntiAI(rawMarkdown);
  const parsed = matter(rawMarkdown);
  const frontmatter = parsed.data;
  const changesSummary: string[] = [];
  const toMarkdown = (body: string) => matter.stringify(body, frontmatter);

  // Deterministic fixes: em-dashes, AI-sounding words, internal links.
  let body = parsed.content;
  if (beforeAudit.emDashCount > 0) {
    body = removeEmDashes(body);
    changesSummary.push(`Removed ${beforeAudit.emDashCount} em-dash${beforeAudit.emDashCount === 1 ? "" : "es"}.`);
  }
  const words = fixAiWords(body);
  if (words.count > 0) {
    body = words.text;
    changesSummary.push(`Replaced ${words.count} AI-sounding word${words.count === 1 ? "" : "s"} with plain ones.`);
  }
  const countLinks = (text: string) => (text.match(/\]\(/g) || []).length;
  const linkedBody = optimizeInternalLinking(body);
  const added = countLinks(linkedBody) - countLinks(body);
  if (added > 0) {
    changesSummary.push(`Added ${added} internal link${added === 1 ? "" : "s"}.`);
  }
  body = linkedBody;

  const cleaned = body;
  let best = { body: cleaned, audit: auditContentForAntiAI(toMarkdown(cleaned)) };

  // Check again; rewrite while something still fails.
  for (let pass = 1; pass <= MAX_REWRITE_PASSES && postIssues(best.audit).length > 0; pass++) {
    let next: string;
    let note: string;
    try {
      const { markdown, rewritten, total } = await humanizeArticle(cleaned, apiKey);
      next = markdown;
      note = rewritten > 0 ? `rewrote ${rewritten} of ${total} sections` : "couldn't safely rewrite any section";
    } catch (err) {
      console.warn("Human-voice rewrite failed, using word-level cleanup:", err);
      next = applyAdvancedHumanization(cleaned);
      note = "rewrite unavailable, word-level cleanup only";
    }
    // The rewrite can bring AI words or dashes back, so fix those again.
    next = fixAiWords(removeEmDashes(next)).text;

    const audit = auditContentForAntiAI(toMarkdown(next));
    const issues = postIssues(audit);
    changesSummary.push(`Pass ${pass}: ${note}; ${issues.length ? `still ${list(issues)}` : "passes all checks"}.`);
    if (isBetter(audit, best.audit) < 0) best = { body: next, audit };
    if (!note.startsWith("rewrote")) break; // another pass wouldn't change anything
  }

  const remainingIssues = postIssues(best.audit);

  return {
    originalMarkdown: rawMarkdown,
    optimizedMarkdown: toMarkdown(best.body),
    beforeAudit,
    afterAudit: best.audit,
    remainingIssues,
    changesSummary,
  };
}

import matter from "gray-matter";
import { requireStudioConfig } from "../studio-config";
import { TextProcessor, tokenizeSentences } from "../text-processor";
import {
  isStructuralBlock,
  removeEmDashes,
  splitContentPreservingTables,
} from "../utils";
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

/**
 * Audits text for AI patterns: em-dashes, clichés, sentence uniformity.
 */
export function auditContentForAntiAI(rawMarkdown: string): AntiAIAuditResult {
  const parsed = matter(rawMarkdown);
  const body = parsed.content || rawMarkdown;

  // 1. Em-dashes count (— and &mdash;)
  const emDashMatches = body.match(/—|&mdash;/g);
  const emDashCount = emDashMatches ? emDashMatches.length : 0;

  // 2. AI Clichés
  const lowerBody = body.toLowerCase();
  const clicheMatches: string[] = [];
  for (const phrase of AI_CLICHE_PHRASES) {
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
  changesSummary: string[];
}

/**
 * Optimizes an existing blog post following strict anti-AI rules.
 */
export async function optimizeBlogPostWithAntiAI(
  rawMarkdown: string,
  apiKey?: string,
): Promise<OptimizationResult> {
  const beforeAudit = auditContentForAntiAI(rawMarkdown);
  const parsed = matter(rawMarkdown);
  const frontmatter = parsed.data;
  let body = parsed.content;

  const changesSummary: string[] = [];

  // Pass 1: Strict em-dash eradication
  if (beforeAudit.emDashCount > 0) {
    body = removeEmDashes(body);
    changesSummary.push(
      `Eradicated ${beforeAudit.emDashCount} em-dash (—) occurrences.`,
    );
  }

  // Pass 2: Rule-based cliché removal
  const replacements: [RegExp, string][] = [
    [/\bIn conclusion,?\b/gi, "The takeaway:"],
    [/\bTo delve into\b/gi, "To examine"],
    [/\bdelve into\b/gi, "examine"],
    [/\bdelving into\b/gi, "examining"],
    [/\ba testament to\b/gi, "clear proof of"],
    [/\btapestry of\b/gi, "spectrum of"],
    [
      /\bIn today's fast-paced digital landscape,?\b/gi,
      "In modern digital commerce,",
    ],
    [/\bIn today's digital landscape,?\b/gi, "In modern web development,"],
    [/\bMoreover,?\b/gi, "What is more,"],
    [/\bFurthermore,?\b/gi, "Beyond that,"],
    [/\bit is important to remember that\b/gi, "keep in mind that"],
    [/\bit is worth noting that\b/gi, "notably,"],
    [/\bplays a crucial role in\b/gi, "directly impacts"],
    [/\bcrucial role\b/gi, "central role"],
    [/\bvital role\b/gi, "key role"],
    [/\bgame-changer\b/gi, "major shift"],
    [/\bnavigating the complex world of\b/gi, "managing"],
    [/\bdive deep into\b/gi, "analyze"],
    [/\bIn this blog post,?\b/gi, "Below,"],
  ];

  let clicheRemovedCount = 0;
  for (const [regex, rep] of replacements) {
    if (regex.test(body)) {
      body = body.replace(regex, rep);
      clicheRemovedCount++;
    }
  }
  if (clicheRemovedCount > 0) {
    changesSummary.push(
      `Replaced ${clicheRemovedCount} robotic AI transition phrases with authentic editorial language.`,
    );
  }

  // Pass 3: Internal linking enrichment
  const linkedBody = optimizeInternalLinking(body);
  if (linkedBody !== body) {
    body = linkedBody;
    changesSummary.push("Added contextual internal links.");
  }

  // Pass 4: human-voice rewrite (facts locked) + deterministic cleanup
  try {
    const { markdown, rewritten, total } = await humanizeArticle(body, apiKey);
    body = markdown;
    changesSummary.push(
      rewritten > 0
        ? `Rewrote ${rewritten} of ${total} sections in a more natural voice.`
        : "Couldn't safely rewrite any section; applied word-level cleanup only.",
    );
  } catch (err) {
    console.warn("Human-voice rewrite failed, using word-level cleanup:", err);
    body = applyAdvancedHumanization(body);
    changesSummary.push("Applied word-level cleanup (rewrite unavailable).");
  }

  // Reassemble markdown with frontmatter
  const finalMarkdown = matter.stringify(body, frontmatter);
  const afterAudit = auditContentForAntiAI(finalMarkdown);

  return {
    originalMarkdown: rawMarkdown,
    optimizedMarkdown: finalMarkdown,
    beforeAudit,
    afterAudit,
    changesSummary,
  };
}

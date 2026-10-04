import { generateText } from "ai";
import { applyAdvancedHumanization } from "./content-humanizer";
import { primaryReader } from "../brand-prompt";
import { BrandContext, getModelConfig, requireStudioConfig } from "../studio-config";
import { getGroqClient } from "./groq-client";
import { applyImperfectionPasses } from "./imperfection-passes";

/**
 * Humanization, modelled on content-hub's generator (conversational draft + rule-based
 * imperfection passes) with an extra LLM rewrite in a casual spoken voice. Content-hub's
 * author-persona system (named author, invented stories, fake trust signals) is not used.
 *
 * The LLM rewrite makes drafts read like an experienced person talking:
 * irregular sentence rhythm, contractions, plain words, a conversational voice.
 *
 * It changes HOW things are said, never WHAT is said. Code blocks and tables are swapped
 * for placeholders so they come back byte-for-byte, and any section that loses
 * placeholders, links or too many words is kept as the original.
 */

// Neutral examples used when the context file has no voiceExamples.
const DEFAULT_VOICE_EXAMPLES = [
  {
    draft:
      "Regular backups are essential, as hardware failures can occur without warning and recovery without a backup is often impossible.",
    rewrite:
      "Here's the thing about backups. Drives die without warning, and they don't care how busy you are. No backup? Then there's usually nothing to recover.",
  },
  {
    draft:
      "The checklist should be treated as a starting point for the process, not as a guarantee of results.",
    rewrite:
      "Think of the checklist as a starting point. It's not a promise. Nobody hands you a certificate for ticking every box.",
  },
  {
    draft:
      "Automated tools detect approximately half of the problems, according to the vendor's own study, providing a reasonable baseline.",
    rewrite:
      "Automated tools catch a lot, but not everything. The vendor's own study puts it at about half. Good enough for a first pass? Sure. Not the whole job.",
  },
];

// Casual, spoken voice. Measured on ZeroGPT: polished flowing prose scored 97% AI, this
// voice plus the imperfection passes scored 37% on the same draft.
export function buildRewriteSystem(brand: BrandContext): string {
  const examples = (
    brand.voiceExamples.length ? brand.voiceExamples : DEFAULT_VOICE_EXAMPLES
  )
    .map((e) => `Draft: ${e.draft}\nRewrite: ${e.rewrite}`)
    .join("\n\n");

  return `You turn stiff, textbook-sounding blog drafts into the way a real, experienced practitioner in ${brand.industry} actually talks when explaining this to ${primaryReader(brand)}. Think: smart friend on a call, not a white paper.

HARD RULES:
- Keep every fact, number, technical term, standard or rule reference, product name, link (same URL) and instruction. Change the wording, not the meaning.
- Never add facts, stats, examples, stories, quotes or claims that aren't in the input. Opinions about how to approach things are fine ("we'd start here").
- Keep headings (lightly reworded is fine), list items in the same order, and every placeholder like [[BLOCK_2]] exactly, on its own line, in the same spot.
- No em-dashes or en-dashes. No preamble, output only the markdown.

HOW REAL PEOPLE WRITE (do all of this):
- Mix very short sentences (2 to 5 words) with long, loose ones that ramble a bit and use "and" or "but" to keep going.
- Spoken phrasing: "Here's the thing.", "Honestly,", "Look,", "So what does that mean for you?", "That's it.", "Pretty simple, right?". Use these sparingly and vary them.
- Contractions everywhere. Second person ("you", "your").
- Prefer everyday words and idioms over formal ones: "a big chunk", "won't save you", "the catch is", "on the hook", "in plain English".
- Turn abstract claims into concrete, practical ones using only what the input says.
- Occasionally a one-line paragraph for emphasis.
- Avoid: delve, crucial, essential, comprehensive, robust, seamless, leverage, utilize, ensure, additionally, furthermore, moreover, landscape, realm, navigate (unless it's literal navigation), foster, pivotal, vital, overall, ultimately, in conclusion, it's important to note, not only... but also, and tidy groups of three.

EXAMPLES

${examples}`;
}

interface Protected {
  text: string;
  blocks: string[];
}

// Swap fenced code blocks and tables for placeholders the model must copy verbatim.
function protectBlocks(markdown: string): Protected {
  const blocks: string[] = [];
  const stash = (m: string) => {
    blocks.push(m);
    return `[[BLOCK_${blocks.length - 1}]]`;
  };
  const text = markdown
    .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, stash)
    .replace(
      /(?:^[ \t]*\|.*\|[ \t]*$\n?)+/gm,
      (m) => `${stash(m.trimEnd())}\n`,
    );
  return { text, blocks };
}

function restoreBlocks(text: string, blocks: string[]): string {
  // A placeholder the model indented (inside a list item) must not add to the block's own
  // indentation, or the code fence ends up at 6 spaces and breaks out of the list.
  return text
    .replace(/^[ \t]*\[\[BLOCK_(\d+)\]\]/gm, (_, i) => blocks[Number(i)] ?? "")
    .replace(/\[\[BLOCK_(\d+)\]\]/g, (_, i) => blocks[Number(i)] ?? "");
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const linksIn = (s: string): string[] =>
  (s.match(/\]\(([^)]+)\)/g) || []).sort();

function isFaithful(
  original: string,
  rewritten: string,
  placeholders: string[],
): boolean {
  if (!rewritten.trim()) return false;
  if (placeholders.some((p) => !rewritten.includes(p))) return false;
  const ratio = wordCount(rewritten) / Math.max(1, wordCount(original));
  // Turning terse bullets into sentences legitimately adds words; huge growth suggests invented content.
  if (ratio < 0.75 || ratio > 1.8) return false;
  // Every original link must survive (same URL).
  const rewrittenLinks = new Set(linksIn(rewritten));
  return linksIn(original).every((l) => rewrittenLinks.has(l));
}

function cleanModelOutput(text: string): string {
  return text
    .trim()
    .replace(/^```(?:markdown|md)?\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

export interface RewriteOptions {
  /** Groq model id for the rewrite; defaults to the REWRITE_MODELS list */
  model?: string;
  temperature?: number;
  system?: string;
}

// Rewrite models (REWRITE_MODELS) in order of preference. A different family from the
// drafting model (gpt-oss) gives the final text a different statistical fingerprint.

async function callRewriteModel(
  model: string,
  system: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
  apiKey?: string,
): Promise<{ text: string; finishReason: string }> {
  const isQwen = model.startsWith("qwen/");
  const run = () =>
    generateText({
      model: getGroqClient(apiKey)(model),
      system,
      // Qwen3 is a thinking model; "/no_think" skips the reasoning phase.
      prompt: isQwen ? `${prompt}\n\n/no_think` : prompt,
      temperature,
      topP: 0.95,
      maxTokens,
      providerOptions: isQwen
        ? { groq: { reasoningFormat: "hidden" } }
        : undefined,
      maxRetries: 0,
    });

  // Free-tier limits are tight (Qwen: ~1,000 output tokens/minute). Wait as long as Groq asks.
  let result: Awaited<ReturnType<typeof run>> | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      result = await run();
      break;
    } catch (err: any) {
      const wait = String(err?.message || "").match(
        /try again in ([\d.]+)(m?s)/i,
      );
      if (!wait || attempt >= 6) throw err;
      const ms = parseFloat(wait[1]) * (wait[2] === "ms" ? 1 : 1000) + 500;
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  const { text, finishReason } = result;
  return {
    // Some Qwen builds still emit an empty or filled <think> block inline.
    text: text.replace(/<think>[\s\S]*?<\/think>/g, ""),
    finishReason,
  };
}

async function rewriteSection(
  section: string,
  apiKey?: string,
  options: RewriteOptions = {},
): Promise<string> {
  const { text: protectedText, blocks } = protectBlocks(section);
  const placeholders = blocks.map((_, i) => `[[BLOCK_${i}]]`);

  // Nothing but code/tables: nothing to rewrite.
  if (wordCount(protectedText.replace(/\[\[BLOCK_\d+\]\]/g, "")) < 25)
    return section;

  const system =
    options.system ?? buildRewriteSystem(requireStudioConfig().brand);
  const prompt = `Rewrite this section:\n\n${protectedText}`;
  const temperature = options.temperature ?? 1.0;
  // Reasoning models spend tokens before answering; leave room.
  const maxTokens = Math.max(4000, Math.ceil(wordCount(protectedText) * 4));
  const models = options.model ? [options.model] : getModelConfig().rewrite;

  for (const model of models) {
    try {
      const { text, finishReason } = await callRewriteModel(
        model,
        system,
        prompt,
        temperature,
        maxTokens,
        apiKey,
      );
      const output = cleanModelOutput(text);
      if (
        finishReason !== "length" &&
        isFaithful(protectedText, output, placeholders)
      ) {
        return restoreBlocks(output, blocks);
      }
    } catch (err) {
      console.warn(`[humanizer] ${model} failed:`, (err as Error)?.message);
    }
  }
  return section;
}

/** Rewrites each H2 section (and the intro) in a human voice. Returns the original on failure. */
export async function rewriteInHumanVoice(
  markdown: string,
  apiKey?: string,
  options: RewriteOptions = {},
): Promise<{ markdown: string; rewritten: number; total: number }> {
  const sections = markdown.split(/\n(?=## )/);
  const results: string[] = new Array(sections.length);
  let rewritten = 0;

  // Two at a time keeps us under Groq's free-tier rate limits.
  for (let i = 0; i < sections.length; i += 2) {
    const batch = sections.slice(i, i + 2);
    const outputs = await Promise.all(
      batch.map((s) => rewriteSection(s, apiKey, options).catch(() => s)),
    );
    outputs.forEach((out, j) => {
      results[i + j] = out;
      if (out !== batch[j]) rewritten++;
    });
  }

  return {
    markdown: results.map((r) => r.trim()).join("\n\n"),
    rewritten,
    total: sections.length,
  };
}

/**
 * Full humanization chain used for drafts, revisions and Posts cleanup:
 * spoken-voice rewrite -> content-hub imperfection passes -> safe word/contraction cleanup.
 */
export async function humanizeArticle(
  markdown: string,
  apiKey?: string,
): Promise<{ markdown: string; rewritten: number; total: number }> {
  const result = await rewriteInHumanVoice(markdown, apiKey);
  const passed = applyImperfectionPasses(result.markdown, "standard");
  return { ...result, markdown: applyAdvancedHumanization(passed) };
}

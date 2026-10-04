import { tokenizeSentences } from "../text-processor";
import {
  isStructuralBlock,
  removeEmDashes,
  splitContentPreservingTables,
} from "../utils";

// Deterministic cleanup that runs after the LLM rewrite (see humanizer.ts). It only makes
// local, meaning-preserving edits: contractions and swapping words that AI detectors and
// readers associate with machine text. It never inserts sentences or claims.

// Only pairs that are safe to contract anywhere. "you will"/"you have" are left out:
// "a way to contact you will fall short" must not become "contact you'll".
const CONTRACTIONS: Record<string, string> = {
  "it is": "it's",
  "It is": "It's",
  "do not": "don't",
  "Do not": "Don't",
  "does not": "doesn't",
  "Does not": "Doesn't",
  "did not": "didn't",
  "is not": "isn't",
  "are not": "aren't",
  "was not": "wasn't",
  "will not": "won't",
  "would not": "wouldn't",
  "should not": "shouldn't",
  "could not": "couldn't",
  cannot: "can't",
  Cannot: "Can't",
  "they are": "they're",
  "They are": "They're",
  "you are": "you're",
  "You are": "You're",
  "we are": "we're",
  "We are": "We're",
  "there is": "there's",
  "There is": "There's",
  "that is": "that's",
  "That is": "That's",
};

// Words and phrases strongly associated with LLM output, mapped to plain equivalents.
// Only swaps that stay grammatical in any context. Words like "ensure", "navigate"
// (literal navigation) and "robust" (a technical term in some fields) are left to the
// rewrite prompt.
type Replacement = string | ((match: string, ...groups: string[]) => string);

const AI_TELLS: [RegExp, Replacement][] = [
  [/\butilize(s|d)?\b/g, "use$1"],
  [/\butilizing\b/g, "using"],
  [/\bensure that\b/g, "make sure"],
  [/\bEnsure that\b/g, "Make sure"],
  [/\bcrucial\b/g, "important"],
  [/\bcomprehensive\b/g, "complete"],
  [/\bseamlessly\b/g, "smoothly"],
  [/\bAdditionally,\s*/g, "Also, "],
  [/\bFurthermore,\s*/g, "Also, "],
  [/\bMoreover,\s*/g, "And "],
  [/\bIn conclusion,\s*/g, "So, "],
  [
    /\bIt'?s (?:important|worth) (?:to note|noting) that\s+(\w)/g,
    (_m, c) => c.toUpperCase(),
  ],
  [/\bdelve into\b/g, "dig into"],
  [/\bplethora of\b/g, "lots of"],
  [/\bmyriad of\b/g, "lots of"],
  [/\bfacilitate(s)?\b/g, "help$1"],
  [/\bcommence(s)?\b/g, "start$1"],
  [/\bprior to\b/g, "before"],
  [/\bin order to\b/g, "to"],
];

/**
 * Applies `transform` to each sentence of every prose paragraph, leaving headings,
 * lists, tables, code blocks and quotes untouched. Paragraph breaks are preserved.
 */
export function mapProseSentences(
  content: string,
  transform: (sentence: string, index: number) => string,
): string {
  const blocks = splitContentPreservingTables(content);
  return blocks
    .map((block) => {
      if (isStructuralBlock(block)) return block;
      const sentences = tokenizeSentences(block);
      if (sentences.length === 0) return block;
      return sentences.map(transform).join(" ");
    })
    .join("\n\n");
}

/** Applies a text transform to prose and list items, never to code, tables or headings. */
function mapEditableText(
  content: string,
  transform: (text: string) => string,
): string {
  return splitContentPreservingTables(content)
    .map((block) => {
      const trimmed = block.trimStart();
      if (
        /^(```|~~~)/.test(trimmed) ||
        /^\|/.test(trimmed) ||
        trimmed.startsWith("#")
      ) {
        return block;
      }
      // Leave inline code and link URLs alone.
      return block
        .split(/(`[^`]*`|\]\([^)]*\))/)
        .map((part, i) => (i % 2 === 1 ? part : transform(part)))
        .join("");
    })
    .join("\n\n");
}

export function addNaturalContractions(content: string): string {
  return mapEditableText(content, (text) => {
    let out = text;
    for (const [formal, informal] of Object.entries(CONTRACTIONS)) {
      // Most, not all: a few formal forms read naturally and keep the text from looking processed.
      // Only contract when another word follows in the same clause: "how conformant you
      // are and" or "that's what it is." must keep the full form.
      out = out.replace(
        new RegExp(
          `\\b${formal}\\b(?=\\s+(?!(?:and|or|but|so|because|when|if)\\b)[A-Za-z0-9"'(])`,
          "g",
        ),
        (m) => (Math.random() < 0.8 ? informal : m),
      );
    }
    return out;
  });
}

export function replaceAiTells(content: string): string {
  return mapEditableText(content, (text) =>
    AI_TELLS.reduce(
      (acc, [pattern, replacement]) =>
        typeof replacement === "string"
          ? acc.replace(pattern, replacement)
          : acc.replace(pattern, replacement),
      text,
    ),
  );
}

// Typographic characters that LLMs emit but people typing in an editor almost never do.
export function normalizeTypography(text: string): string {
  return text
    .replace(/[\u202F\u00A0\u2007\u2009\u200A]/g, " ") // narrow/no-break/thin spaces
    .replace(/[\u2010\u2011\u2012]/g, "-") // non-breaking and other hyphens
    .replace(/\u2026/g, "...")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, ""); // zero-width characters
}

export function applyAdvancedHumanization(rawContent: string): string {
  const humanized = addNaturalContractions(
    replaceAiTells(normalizeTypography(rawContent)),
  );
  return removeEmDashes(humanized).trim();
}

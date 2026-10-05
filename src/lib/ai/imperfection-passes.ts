import { tokenizeSentences } from "../text-processor";
import { isStructuralBlock, splitContentPreservingTables } from "../utils";

/**
 * Port of content-hub's rule-based humanization passes (addHumanImperfections,
 * varySentenceStructures, addConversationalElements, addNaturalElements), same rates.
 *
 * Differences from the original, on purpose:
 * - No author system: no first-person anecdotes, no experience-claiming starters, no
 *   fake trust signals (those invent facts about who wrote the post).
 * - Sentence punctuation is kept (the original splitter dropped every period).
 * - Only the first letter is lowercased after a starter, so "NASA" doesn't become "nasa".
 * - Headings, lists, tables, code, quotes and sentences with links or inline code are
 *   never edited; asides go in at a comma instead of a random word position.
 * - Openers stay grammatical: ones that need a full clause after them ("The truth is,",
 *   "...surprising that") only go before sentences that start with a subject; other
 *   sentences get a stand-alone opener ("Here's the thing:") instead. A question opener
 *   keeps the next sentence capitalized, and proper nouns are never lowercased.
 * - No stacking or repeats: a sentence that already opens with a filler gets no second
 *   one, and each phrase is used at most once per post (including phrases left by an
 *   earlier run, since revisions and cleanup run these passes again).
 *
 * "max" adds the original's typos, gonna/wanna, um/uh and internet slang.
 */

export type ImperfectionLevel = "standard" | "max";

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PATTERNS = {
  fillers: {
    standard: ["honestly", "basically", "I mean", "you know", "look"],
    max: ["um", "uh", "like", "you know", "I mean", "basically"],
  },
  casual: {
    standard: ["honestly", "to be fair", "in plain English", "frankly"],
    max: ["tbh", "ngl", "imo", "fwiw", "btw"],
  },
  punctuation: {
    standard: ["!", "..."],
    max: ["...", "!!", "!?", ".."],
  },
  starters: [
    "Here's something most people don't realize:",
    "You know what really bugs me?",
    "Here's the thing:",
    "This might sound obvious, but",
    "Funny enough,",
    "The truth is,",
  ],
  emotions: [
    "This is the part that frustrates people:",
    "Honestly, it's a little surprising that",
    "We get why this trips people up:",
    "The encouraging bit is that",
  ],
  transitions: [
    "Now, here's where it gets interesting.",
    "But wait, there's more to consider.",
    "Here's what we wish someone had said earlier.",
    "This is where most people get confused, so let's clear it up.",
    "You might be wondering about this, and that's fair.",
  ],
  questions: [
    "Why does this matter?",
    "What does this mean for you?",
    "Sound familiar?",
    "Make sense?",
  ],
  elements: [
    "here's the thing",
    "funny enough",
    "surprisingly",
    "honestly",
    "the truth is",
    "interestingly",
  ],
  asides: [
    "(and this matters)",
    "believe it or not,",
    "you see,",
  ],
  typos: {
    the: "teh",
    receive: "recieve",
    separate: "seperate",
    occurred: "occured",
    definitely: "definately",
  } as Record<string, string>,
  informal: {
    "going to": "gonna",
    "want to": "wanna",
    "kind of": "kinda",
    "sort of": "sorta",
  } as Record<string, string>,
};

// Sentences carrying markup or code are left alone so links and code never break.
const isSafeSentence = (s: string) =>
  !/[`[\]<>|]/.test(s) &&
  !/https?:\/\//.test(s) &&
  !/^[*_]/.test(s.trim()); // emphasis lines like the italic legal disclaimer

/** Per-article state: phrases already used, and how the article capitalizes words. */
interface PassContext {
  used: Set<string>;
  /** Words capitalized mid-sentence: names like "Google", never lowercased */
  properNouns: Set<string>;
  /** Words the article also writes in lowercase, so they're safe to lowercase */
  lowerWords: Set<string>;
}

const firstWordOf = (sentence: string) =>
  (sentence.trim().split(/\s/)[0] || "").replace(/[^\p{L}\p{N}'’-]/gu, "");

// Words that start a full clause, so "The truth is, <sentence>" stays grammatical.
const SUBJECT_STARTERS = new Set(
  "i you we they it he she this that these those there here the a an your our their its my most many some every each all any no nobody everyone everybody people one both few more less nothing something anyone".split(" "),
);
/**
 * How the first word may be written after an opener: "lower" for ordinary words, "keep" for
 * "I", acronyms and names ("NASA", "KitchenAid", "Google"), "unknown" when the article never
 * shows the word mid-sentence (it might be a name like "Shopify", so don't guess).
 */
function firstWordCase(sentence: string, ctx: PassContext): "lower" | "keep" | "unknown" {
  const word = firstWordOf(sentence);
  if (word === "I" || /^I['’]/.test(word)) return "keep";
  if (word.length > 1 && word === word.toUpperCase()) return "keep";
  const lower = word.toLowerCase();
  // Common subject words ("The", "You") are never names, even if a mis-split sentence
  // put them mid-sentence ("...in the U.S. The numbers...").
  if (SUBJECT_STARTERS.has(lower)) return "lower";
  if (/\p{Lu}/u.test(word.slice(1)) || ctx.properNouns.has(word)) return "keep";
  return ctx.lowerWords.has(lower) ? "lower" : "unknown";
}

// Lowercase the first letter only when it starts an ordinary word.
function lowerFirst(sentence: string, ctx: PassContext): string {
  return firstWordCase(sentence, ctx) === "lower"
    ? sentence.charAt(0).toLowerCase() + sentence.slice(1)
    : sentence;
}

const CONJUNCTION_STARTERS = new Set("and but or so yet because plus nor".split(" "));

const canFollowClause = (sentence: string, ctx: PassContext) => {
  const first = firstWordOf(sentence);
  return (
    sentence.trim().endsWith(".") &&
    (SUBJECT_STARTERS.has(first.toLowerCase()) || ctx.properNouns.has(first) || /^\d/.test(first))
  );
};

const OPENER_PHRASES = () => [
  ...PATTERNS.fillers.standard,
  ...PATTERNS.fillers.max,
  ...PATTERNS.casual.standard,
  ...PATTERNS.casual.max,
  ...PATTERNS.starters,
  ...PATTERNS.emotions,
  ...PATTERNS.elements,
  ...PATTERNS.transitions,
];

// Already opens with one of our phrases or a short "Word," / "Two words," lead-in.
const hasOpener = (sentence: string) => {
  const lower = sentence.trim().toLowerCase();
  return (
    /^[\p{L}'’]+(?:\s[\p{L}'’]+)?,\s/u.test(lower) ||
    OPENER_PHRASES().some((p) => lower.startsWith(p.toLowerCase().replace(/[,:]$/, "")))
  );
};

const canTakeOpener = (sentence: string) =>
  !hasOpener(sentence) && !CONJUNCTION_STARTERS.has(firstWordOf(sentence).toLowerCase());

// A phrase and its lead-in word: "Honestly, it's a little surprising that" also uses "honestly".
const usageKeys = (item: string) => {
  const key = item.toLowerCase().replace(/[,:]$/, "");
  const lead = key.includes(", ") ? key.split(", ")[0] : null;
  return lead ? [key, lead] : [key];
};

/** Picks a phrase this article hasn't used yet, and marks it used. */
function pickUnused(items: string[], ctx: PassContext): string | null {
  const fresh = items.filter((item) => !usageKeys(item).some((k) => ctx.used.has(k)));
  if (fresh.length === 0) return null;
  const choice = pick(fresh);
  usageKeys(choice).forEach((k) => ctx.used.add(k));
  return choice;
}

/** "Here's the thing:" + sentence, choosing a phrase that fits the sentence's grammar. */
function withOpener(sentence: string, phrases: string[], ctx: PassContext): string {
  if (!canTakeOpener(sentence)) return sentence;
  // Phrases ending in ":" or "?" stand alone; the rest need a full clause after them.
  const standalone = phrases.filter((p) => /[:?]$/.test(p));
  const opener = pickUnused(canFollowClause(sentence, ctx) ? phrases : standalone, ctx);
  if (!opener) return sentence;
  const rest = opener.endsWith("?") ? capitalize(sentence) : lowerFirst(sentence, ctx);
  return `${opener} ${rest}`;
}

// Comma lead-ins that, like "...surprising that", need a full clause after them.
const CLAUSE_LEAD_INS = new Set(["the truth is", "funny enough", "here's the thing"]);

/** "Honestly, " + sentence. */
function withLeadIn(sentence: string, words: string[], ctx: PassContext, keepCase = false): string {
  if (!canTakeOpener(sentence) || firstWordCase(sentence, ctx) === "unknown") return sentence;
  const fits = canFollowClause(sentence, ctx);
  const word = pickUnused(
    words.filter((w) => fits || !CLAUSE_LEAD_INS.has(w.toLowerCase())),
    ctx,
  );
  if (!word) return sentence;
  return `${keepCase ? word : capitalize(word)}, ${lowerFirst(sentence, ctx)}`;
}

function createContext(content: string): PassContext {
  // Phrases an earlier run already added. Long phrases and questions count anywhere; short
  // ones ("look", "honestly") only as a sentence opener, since they're ordinary words.
  const lower = content.toLowerCase();
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const used = new Set(
    [...OPENER_PHRASES(), ...PATTERNS.questions, ...PATTERNS.asides]
      .map((p) => p.toLowerCase().replace(/[,:]$/, ""))
      .filter((p) =>
        p.split(" ").length >= 3 || p.endsWith("?")
          ? lower.includes(p)
          : new RegExp(`(?:^|[.!?:]\\s+)${escape(p)}[,:]`, "m").test(lower),
      ),
  );
  // Words capitalized mid-sentence are names ("Shopify", "Google"), never lowercased;
  // words written in lowercase somewhere are ordinary and safe to lowercase.
  const properNouns = new Set<string>();
  const lowerWords = new Set<string>();
  for (const block of splitContentPreservingTables(content)) {
    if (isStructuralBlock(block)) continue;
    for (const sentence of tokenizeSentences(block)) {
      const words = sentence.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'’-]/gu, ""));
      words.forEach((w, i) => {
        if (/^\p{Ll}/u.test(w)) lowerWords.add(w);
        else if (i > 0 && /^\p{Lu}/u.test(w) && w !== "I") properNouns.add(w);
      });
    }
  }
  return { used, properNouns, lowerWords };
}

// Words that start a new clause after a comma ("…water, which makes…"). An aside goes only
// there, never between list items ("text, you see, hover states").
const CLAUSE_AFTER_COMMA = new Set(
  "and but so which because while since though although when if or yet plus".split(" "),
);

function insertAtComma(sentence: string, insertion: string | null): string {
  if (!insertion) return sentence;
  // Skip the first few words so an aside never stacks onto an opener ("I mean, (and...").
  for (let idx = sentence.indexOf(", ", 20); idx !== -1; idx = sentence.indexOf(", ", idx + 2)) {
    const next = (sentence.slice(idx + 2).split(/\s/)[0] || "").toLowerCase();
    if (CLAUSE_AFTER_COMMA.has(next) || SUBJECT_STARTERS.has(next)) {
      return `${sentence.slice(0, idx + 2)}${insertion} ${sentence.slice(idx + 2)}`;
    }
  }
  return sentence;
}

function mapProseBlocks(
  content: string,
  fn: (block: string, blockIndex: number) => string,
): string {
  let proseIndex = 0;
  return splitContentPreservingTables(content)
    .map((block) =>
      isStructuralBlock(block) ? block : fn(block, proseIndex++),
    )
    .join("\n\n");
}

function mapSentences(
  content: string,
  fn: (sentence: string, index: number) => string,
): string {
  let index = 0;
  return mapProseBlocks(content, (block) => {
    const sentences = tokenizeSentences(block);
    if (sentences.length === 0) return block;
    return sentences
      .map((s) => (isSafeSentence(s) ? fn(s, index++) : (index++, s)))
      .join(" ");
  });
}

// Pass 1: typos, informal contractions and filler words
function addHumanImperfections(
  content: string,
  level: ImperfectionLevel,
  ctx: PassContext,
): string {
  return mapSentences(content, (sentence) => {
    let out = sentence;
    if (level === "max" && Math.random() < 0.02) {
      out = out
        .split(" ")
        .map((w) =>
          PATTERNS.typos[w.toLowerCase()] && Math.random() < 0.3
            ? PATTERNS.typos[w.toLowerCase()]
            : w,
        )
        .join(" ");
    }
    if (level === "max" && Math.random() < 0.05) {
      for (const [formal, informal] of Object.entries(PATTERNS.informal)) {
        out = out.replace(new RegExp(`\\b${formal}\\b`, "gi"), informal);
      }
    }
    // The original inserted fillers at a random word ("While the I mean, act..."); a
    // sentence-initial filler reads the same to detectors and stays grammatical.
    if (Math.random() < 0.08 && out.split(" ").length > 3) {
      out = withLeadIn(out, PATTERNS.fillers[level], ctx);
    }
    return out;
  });
}

// Pass 2: starters, emotional openers, punctuation variety, casual phrases
function varySentenceStructures(
  content: string,
  level: ImperfectionLevel,
  ctx: PassContext,
): string {
  return mapSentences(content, (sentence, i) => {
    if (i > 0 && i % 8 === 0 && Math.random() < 0.25) {
      return withOpener(sentence, PATTERNS.starters, ctx);
    }
    if (i > 0 && i % 6 === 0 && Math.random() < 0.15) {
      return withOpener(sentence, PATTERNS.emotions, ctx);
    }
    if (Math.random() < 0.12 && sentence.endsWith(".")) {
      return sentence.slice(0, -1) + pick(PATTERNS.punctuation[level]);
    }
    if (Math.random() < 0.06) {
      // Internet slang stays lowercase ("tbh,"); normal phrases start the sentence properly.
      return withLeadIn(sentence, PATTERNS.casual[level], ctx, level === "max");
    }
    return sentence;
  });
}

// Pass 3: transitions between paragraphs and rhetorical questions inside them
function addConversationalElements(content: string, ctx: PassContext): string {
  return mapProseBlocks(content, (block, i) => {
    let out = block;
    if (i > 0 && i % 3 === 0 && Math.random() < 0.3 && !hasOpener(out)) {
      const transition = pickUnused(PATTERNS.transitions, ctx);
      if (transition) out = `${transition} ${out}`;
    }
    if (Math.random() < 0.15) {
      const sentences = tokenizeSentences(out);
      const at = Math.floor(sentences.length / 2);
      // Never next to another question, so two questions don't end up back to back.
      const nearQuestion = [sentences[at - 1], sentences[at]].some((s) => s?.trim().endsWith("?"));
      if (sentences.length > 2 && !nearQuestion) {
        const question = pickUnused(PATTERNS.questions, ctx);
        if (question) {
          sentences.splice(at, 0, question);
          out = sentences.join(" ");
        }
      }
    }
    return out;
  });
}

// Pass 5 (pass 4, anecdotes, belongs to the author system and is not ported)
function addNaturalElements(content: string, ctx: PassContext): string {
  return mapSentences(content, (sentence, i) => {
    let out = sentence;
    if (i > 0 && i % 7 === 0 && Math.random() < 0.2) {
      out = withLeadIn(out, PATTERNS.elements, ctx);
    }
    // Not inside a phrase these passes added ("You might be wondering about this, ...").
    if (Math.random() < 0.08 && !hasOpener(out)) {
      const withAside = insertAtComma(out, PATTERNS.asides[0]);
      if (withAside !== out) out = insertAtComma(out, pickUnused(PATTERNS.asides, ctx));
    }
    return out;
  });
}

export function applyImperfectionPasses(
  content: string,
  level: ImperfectionLevel = "standard",
): string {
  const ctx = createContext(content);
  let out = addHumanImperfections(content, level, ctx);
  out = varySentenceStructures(out, level, ctx);
  out = addConversationalElements(out, ctx);
  out = addNaturalElements(out, ctx);
  return out;
}

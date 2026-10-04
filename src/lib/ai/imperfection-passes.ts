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

// Lowercase the first letter only when it starts an ordinary word (not "NASA", "I", "HTML").
function lowerFirst(sentence: string): string {
  const firstWord = sentence.split(/\s/)[0] || "";
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase())
    return sentence;
  if (firstWord === "I" || /^I'/.test(firstWord)) return sentence;
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function insertAtComma(sentence: string, insertion: string): string {
  // Skip the first few words so an aside never stacks onto an opener ("I mean, (and...").
  const idx = sentence.indexOf(", ", 20);
  if (idx === -1) return sentence;
  return `${sentence.slice(0, idx + 2)}${insertion} ${sentence.slice(idx + 2)}`;
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
      out = `${capitalize(pick(PATTERNS.fillers[level]))}, ${lowerFirst(out)}`;
    }
    return out;
  });
}

// Pass 2: starters, emotional openers, punctuation variety, casual phrases
function varySentenceStructures(
  content: string,
  level: ImperfectionLevel,
): string {
  return mapSentences(content, (sentence, i) => {
    if (i > 0 && i % 8 === 0 && Math.random() < 0.25) {
      return `${pick(PATTERNS.starters)} ${lowerFirst(sentence)}`;
    }
    if (i > 0 && i % 6 === 0 && Math.random() < 0.15) {
      return `${pick(PATTERNS.emotions)} ${lowerFirst(sentence)}`;
    }
    if (Math.random() < 0.12 && sentence.endsWith(".")) {
      return sentence.slice(0, -1) + pick(PATTERNS.punctuation[level]);
    }
    if (Math.random() < 0.06) {
      const casual = pick(PATTERNS.casual[level]);
      // Internet slang stays lowercase ("tbh,"); normal phrases start the sentence properly.
      return `${level === "max" ? casual : capitalize(casual)}, ${lowerFirst(sentence)}`;
    }
    return sentence;
  });
}

// Pass 3: transitions between paragraphs and rhetorical questions inside them
function addConversationalElements(content: string): string {
  return mapProseBlocks(content, (block, i) => {
    let out = block;
    if (i > 0 && i % 3 === 0 && Math.random() < 0.3) {
      out = `${pick(PATTERNS.transitions)} ${out}`;
    }
    if (Math.random() < 0.15) {
      const sentences = tokenizeSentences(out);
      if (sentences.length > 2) {
        sentences.splice(
          Math.floor(sentences.length / 2),
          0,
          pick(PATTERNS.questions),
        );
        out = sentences.join(" ");
      }
    }
    return out;
  });
}

// Pass 5 (pass 4, anecdotes, belongs to the author system and is not ported)
function addNaturalElements(content: string): string {
  return mapSentences(content, (sentence, i) => {
    let out = sentence;
    if (i > 0 && i % 7 === 0 && Math.random() < 0.2) {
      out = `${capitalize(pick(PATTERNS.elements))}, ${lowerFirst(out)}`;
    }
    if (Math.random() < 0.08) {
      out = insertAtComma(out, pick(PATTERNS.asides));
    }
    return out;
  });
}

export function applyImperfectionPasses(
  content: string,
  level: ImperfectionLevel = "standard",
): string {
  let out = addHumanImperfections(content, level);
  out = varySentenceStructures(out, level);
  out = addConversationalElements(out);
  out = addNaturalElements(out);
  return out;
}

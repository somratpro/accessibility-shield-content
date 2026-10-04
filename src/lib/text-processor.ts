import { QualityMetrics } from "@/types/content";

// Stop words to exclude from keywords
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "i",
  "me",
  "my",
  "mine",
  "in",
  "is",
  "it",
  "its",
  "you",
  "your",
  "yours",
  "we",
  "our",
  "ours",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "will",
  "with",
  "this",
  "but",
  "they",
  "have",
  "had",
  "what",
  "said",
  "each",
  "which",
  "she",
  "do",
  "how",
  "their",
  "if",
  "up",
  "out",
  "many",
  "then",
  "them",
  "these",
  "so",
  "some",
  "her",
  "would",
  "make",
  "like",
  "into",
  "him",
  "time",
  "two",
  "more",
  "go",
  "no",
  "way",
  "could",
  "than",
  "first",
  "been",
  "call",
  "who",
  "now",
  "find",
  "down",
  "day",
  "did",
  "get",
  "come",
  "made",
  "may",
  "part",
  "can",
  "over",
  "new",
  "work",
  "where",
  "when",
  "also",
  "back",
  "after",
  "use",
  "just",
  "any",
  "see",
  "say",
  "guide",
  "tips",
  "best",
  "top",
  "why",
]);

// Split on whitespace that follows sentence-ending punctuation, keeping the punctuation
// with its sentence. The lookbehinds run at the split point, so "Mr. Smith" and
// "e.g. Shopify" are not treated as sentence ends.
const SENTENCE_SPLIT_REGEX =
  /(?<=[.!?]["')\]]?)(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|Esq|No|e\.g|i\.e)\.)(?<!\b[A-Z]\.)(?<!(?:^|\s)[0-9]{1,2}\.)\s+(?=["'(\[]?[A-Z])/;
const WORD_EXTRACT_REGEX = /\b[a-zA-Z]{2,}\b/g;
const VOWEL_GROUP_REGEX = /[aeiouy]{1,2}/g;
const WORD_VALIDATION_REGEX = /^[a-zA-Z]+$/;

export function isStopWord(word: string): boolean {
  if (!word) return true;
  return STOP_WORDS.has(word.toLowerCase());
}

export function tokenizeSentences(text: string): string[] {
  if (!text?.trim()) return [];
  const clean = text.replace(/```[\s\S]*?```/g, "").replace(/\|.*\|/g, "");
  const sentences = clean
    .split(SENTENCE_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return clean
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return sentences;
}

export function tokenizeWords(text: string): string[] {
  if (!text?.trim()) return [];
  const matches = text.toLowerCase().match(WORD_EXTRACT_REGEX);
  return matches ? matches.filter((w) => w.length > 1) : [];
}

function countSyllables(word: string): number {
  if (!word || !WORD_VALIDATION_REGEX.test(word)) return 1;
  const clean = word.toLowerCase().trim();
  if (clean.length <= 3) return 1;
  const vowelGroups = clean.match(VOWEL_GROUP_REGEX);
  let syllableCount = vowelGroups ? vowelGroups.length : 1;
  if (clean.endsWith("e") && syllableCount > 1) {
    syllableCount--;
  }
  return Math.max(1, syllableCount);
}

export function calculateFleschReadingEase(text: string): number {
  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord =
    words.reduce((sum, word) => sum + countSyllables(word), 0) / words.length;
  const fleschScore =
    206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(fleschScore * 10) / 10));
}

export function calculateFleschKincaidGrade(text: string): number {
  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord =
    words.reduce((sum, word) => sum + countSyllables(word), 0) / words.length;
  const gradeLevel =
    0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(0, Math.round(gradeLevel * 10) / 10);
}

export function extractTopKeywords(text: string, topN: number = 10): string[] {
  const words = tokenizeWords(text);
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    if (
      word.length > 2 &&
      !STOP_WORDS.has(word) &&
      WORD_VALIDATION_REGEX.test(word)
    ) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

export function calculateUniquenessScore(text: string): number {
  const words = tokenizeWords(text);
  if (words.length === 0) return 0;
  const uniqueWords = new Set(words.filter((word) => word.length > 2));
  const diversityRatio = uniqueWords.size / words.length;
  const rawScore = diversityRatio * 100;
  const curvedScore = Math.sqrt(rawScore) * 10;
  return Math.min(100, Math.round(curvedScore * 10) / 10);
}

export function calculateSEOScore(text: string): number {
  let score = 0;
  const words = tokenizeWords(text);
  const sentences = tokenizeSentences(text);

  // Word count
  if (words.length >= 800 && words.length <= 2500) {
    score += 25;
  } else if (words.length >= 500) {
    score += 15;
  }

  // Reading ease
  const readingEase = calculateFleschReadingEase(text);
  if (readingEase >= 55 && readingEase <= 75) {
    score += 20;
  } else if (readingEase >= 45 && readingEase <= 85) {
    score += 15;
  }

  // Sentence variety
  if (sentences.length > 0) {
    const avgSentenceLength = words.length / sentences.length;
    if (avgSentenceLength >= 14 && avgSentenceLength <= 22) {
      score += 20;
    } else if (avgSentenceLength >= 10 && avgSentenceLength <= 28) {
      score += 12;
    }
  }

  // Paragraphs
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 5) {
    score += 15;
  }

  // Headings
  const hasHeadings = /#{1,4}\s+/m.test(text);
  if (hasHeadings) {
    score += 20;
  }

  return Math.min(100, score);
}

export function calculateAIDetectionRisk(
  text: string,
): "Low Risk (< 15%)" | "Moderate Risk (15-35%)" | "Review Recommended" {
  // Check for presence of em-dashes (classic AI marker)
  const hasEmDashes = /—/g.test(text);
  // Check for robotic transition phrases
  const roboticPhrases = [
    "in conclusion",
    "delve into",
    "testament to",
    "tapestry of",
    "crucial to remember",
    "it is important to note",
    "in the digital age",
    "moreover,",
    "furthermore,",
  ];
  let roboticCount = 0;
  const lower = text.toLowerCase();
  for (const phrase of roboticPhrases) {
    if (lower.includes(phrase)) roboticCount++;
  }

  // Check burstiness (variance of sentence lengths)
  const sentences = tokenizeSentences(text);
  const lengths = sentences.map((s) => tokenizeWords(s).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance =
    lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
    (lengths.length || 1);
  const stdDev = Math.sqrt(variance);

  // High standard deviation indicates high burstiness (very human)
  if (!hasEmDashes && roboticCount <= 1 && stdDev >= 6) {
    return "Low Risk (< 15%)";
  } else if (roboticCount <= 3 && !hasEmDashes) {
    return "Moderate Risk (15-35%)";
  }
  return "Review Recommended";
}

export function analyzeText(text: string): QualityMetrics {
  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);

  return {
    word_count: words.length,
    sentence_count: sentences.length,
    avg_sentence_length:
      sentences.length > 0
        ? Math.round((words.length / sentences.length) * 10) / 10
        : 0,
    flesch_reading_ease: calculateFleschReadingEase(text),
    flesch_kincaid_grade: calculateFleschKincaidGrade(text),
    uniqueness_score: calculateUniquenessScore(text),
    seo_score: calculateSEOScore(text),
    top_keywords: extractTopKeywords(text, 8),
    ai_detection_estimate: calculateAIDetectionRisk(text),
  };
}

export const TextProcessor = {
  isStopWord,
  tokenizeSentences,
  tokenizeWords,
  calculateFleschReadingEase,
  calculateFleschKincaidGrade,
  extractTopKeywords,
  calculateUniquenessScore,
  calculateSEOScore,
  calculateAIDetectionRisk,
  analyzeText,
};

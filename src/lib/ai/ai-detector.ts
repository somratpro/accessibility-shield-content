import { marked } from "marked";

/**
 * Optional AI-detection check, ported from content-hub's content-checker (Originality.ai).
 * Skipped when ORIGINALITY_API_KEY is not set.
 */

export interface AiScan {
  /** 0-100, higher = more likely AI */
  aiScore: number;
  likelyAI: boolean;
}

function toPlainText(markdown: string): string {
  const html = marked.parse(
    markdown.replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, ""),
  ) as string;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const isAiDetectorConfigured = () =>
  Boolean(process.env.ORIGINALITY_API_KEY?.trim());

export async function scanForAi(
  markdown: string,
  title: string,
): Promise<AiScan | null> {
  const apiKey = process.env.ORIGINALITY_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.originality.ai/api/v3/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-OAI-API-KEY": apiKey },
      body: JSON.stringify({
        title,
        content: toPlainText(markdown),
        check_ai: true,
        check_plagiarism: false,
        check_facts: false,
        check_readability: false,
        check_grammar: false,
        storeScan: false,
        aiModelVersion: "turbo",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ai = data?.results?.ai;
    const confidence =
      typeof ai?.confidence?.AI === "number" ? ai.confidence.AI : null;
    if (confidence === null) return null;
    const aiScore = Math.round(confidence * 100);
    return { aiScore, likelyAI: ai?.classification?.AI === 1 || aiScore >= 50 };
  } catch {
    return null;
  }
}

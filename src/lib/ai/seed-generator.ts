import { audienceLine, buildBrandPrompt, primaryReader } from "../brand-prompt";
import { requireStudioConfig } from "../studio-config";
import { removeEmDashes } from "../utils";
import { generateTextWithResilience } from "./groq-client";

export async function generateAdvancedSeedContent(
  topic: string,
  targetKeywords: string[],
  customInstruction?: string,
  apiKey?: string,
): Promise<string> {
  const config = requireStudioConfig();
  const { site, brand } = config;
  const primaryQuery = targetKeywords[0] || topic;

  // Voice and sampling follow content-hub's generator (conversational, opinionated,
  // "authentically imperfect", temperature 0.9 with frequency/presence penalties), minus
  // its author-persona system: no named author, no invented personal stories.
  const systemPrompt = `You're a passionate, experienced practitioner in ${brand.industry} writing for the ${brand.name} blog (${site.host}). Write in a natural, conversational voice, like you're explaining this to ${primaryReader(brand)} over coffee.

${buildBrandPrompt(config)}

VOICE:
- Write as the ${brand.name} team. "We" and "you" are both fine. No named author, no author introduction.
- Never invent personal stories, clients, projects or cases. Share opinions and practical insight instead ("we'd start here", "this is the step people skip").

KEY ELEMENTS:
1. Natural language and casual transitions
2. Specific, practical examples and details (only real ones)
3. Mix short and long sentences
4. Personality through opinions and insights
5. Write like you're having a conversation, not presenting a report
6. Keep it natural, flowing and authentically imperfect

SEARCH INTENT (this is what ranks):
1. The first paragraph answers the reader's question in 2-3 plain sentences.
2. Use the reader's own words in headings; phrase some as the questions people type into Google.
3. End with a "## Frequently asked questions" section of 4-5 questions, each a ### heading with a short answer.
4. Accuracy beats drama. If you're unsure of a number, leave it out.

PUNCTUATION AND FORMAT:
- No em dashes (—). Use commas, periods or split the sentence.
- Markdown with ## and ### headings (no H1). Prefer paragraphs; use lists only for real steps or reference items. Code blocks only if the topic is aimed at developers.

${customInstruction ? `\nSPECIAL INSTRUCTIONS (HIGHEST PRIORITY):\n${customInstruction}\n` : ""}`;

  const pages = brand.product.pages.length
    ? ` Mention the most relevant of these pages as markdown links: ${brand.product.pages.map((p) => `${p.url} (${p.label})`).join(", ")}.`
    : "";
  const outline = brand.outline.length
    ? brand.outline
    : [
        `Why this matters: the real impact on ${audienceLine(brand, "the reader")}, with sourced facts only.`,
        "The core steps or checklist: numbered and concrete. Include short code examples ONLY if the topic is aimed at developers; otherwise explain the steps in plain words.",
        "Common mistakes and shortcuts that do not work, stated factually.",
        "How to keep it working: what to check or repeat over time.",
        `Where ${brand.name} fits: 2-4 sentences, no hard sell.${pages}`,
      ];
  const structure = [
    `Direct answer (no heading): 2-3 sentences that fully answer "${primaryQuery}".`,
    ...outline,
    "## Frequently asked questions (4-5 Q&As).",
  ]
    .map((item, i) => `${i + 1}. ${item}`)
    .join("\n");

  const userPrompt = `Write a blog article titled: "${topic}".

Primary search query to answer: "${primaryQuery}"
Secondary keywords to use naturally (do not stuff): ${targetKeywords.slice(1).join(", ")}

Suggested structure (adapt it to the topic; these are descriptions, so write your own natural headings instead of copying them):
${structure}

Length: 1,200 to 1,600 words.`;

  try {
    const { text } = await generateTextWithResilience({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      // gpt-oss reasoning tokens count against this budget
      maxTokens: 8000,
      apiKey,
    });

    return removeEmDashes(text.trim());
  } catch (error: any) {
    console.error("❌ Seed generation error:", error);
    throw new Error(
      `Failed to generate seed content: ${error?.message || "Unknown error"}`,
    );
  }
}

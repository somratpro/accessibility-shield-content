import { generateText } from "ai";
import { audienceLine } from "../brand-prompt";
import { BrandContext, requireStudioConfig } from "../studio-config";
import { getFastModel } from "./groq-client";

export interface DynamicConfig {
  topic: string;
  target_phrases: string[];
  audience_focus: string;
  style: string;
}

export async function generateDynamicConfig(
  userTopic: string,
  apiKey?: string,
): Promise<DynamicConfig> {
  const { site, brand } = requireStudioConfig();
  const model = getFastModel(apiKey);
  const fallback = getFallbackConfig(userTopic, brand);

  const doesNot = brand.product.doesNot.length
    ? ` It does not: ${brand.product.doesNot.join("; ")}.`
    : "";

  const configPrompt = `You are an SEO content strategist for ${brand.name} (${site.host}). ${brand.summary}${doesNot}
Plan an article about: "${userTopic}".

TARGET AUDIENCES OF ${brand.name.toUpperCase()}:
${audienceLine(brand, "general readers interested in " + brand.industry)}

Pick keywords people actually type into Google: question phrasing ("how to...", "do I need...", "what is..."), "checklist", "template", "alternative", names of tools or platforms the audience uses. The first target phrase must be the single main query the article answers.

Return a single JSON object with this exact structure:
{
  "topic": "[clear article title under 65 characters that contains the main query, no em-dashes, no clickbait]",
  "target_phrases": ["main query first, then 4-6 related searches"],
  "audience_focus": "[primary audience segment matching one of ${brand.name}'s audiences]",
  "style": "practical guide"
}

Return ONLY valid JSON without markdown wrapping.`;

  try {
    const { text } = await generateText({
      model,
      system: `You are an expert ${brand.industry} content strategist for ${brand.name}. Always output strictly valid JSON only.`,
      prompt: configPrompt,
      temperature: 0.7,
      maxTokens: 1200,
    });

    let clean = text.trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      clean = jsonMatch[0];
    }

    const parsed = JSON.parse(clean);
    return {
      topic: parsed.topic || userTopic,
      target_phrases:
        Array.isArray(parsed.target_phrases) && parsed.target_phrases.length > 0
          ? parsed.target_phrases
          : fallback.target_phrases,
      audience_focus: parsed.audience_focus || fallback.audience_focus,
      style: parsed.style || "blog post",
    };
  } catch (error) {
    console.warn("⚠️ Dynamic config generation fallback used:", error);
    return fallback;
  }
}

export function getFallbackConfig(
  topic: string,
  brand: BrandContext,
): DynamicConfig {
  const query = topic.toLowerCase();
  return {
    topic: topic,
    target_phrases: [query, `${query} guide`, ...brand.tags.slice(0, 5)],
    audience_focus: audienceLine(brand),
    style: "practical guide",
  };
}

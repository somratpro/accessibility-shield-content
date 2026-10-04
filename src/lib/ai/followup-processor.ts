import { ContentResult, FollowupInstructionOptions } from "@/types/content";
import { audienceLine, buildBrandPrompt } from "../brand-prompt";
import { requireStudioConfig } from "../studio-config";
import { TextProcessor } from "../text-processor";
import { removeEmDashes } from "../utils";
import { generateTextWithResilience } from "./groq-client";
import { humanizeArticle } from "./humanizer";
import { buildMarkdownWithFrontmatter } from "./meta-generator";

export async function processFollowupInstruction(
  existing: ContentResult,
  options: FollowupInstructionOptions,
  apiKey?: string,
): Promise<ContentResult> {
  const config = requireStudioConfig();
  const { site, brand } = config;
  const prompt = `You are a principal ${brand.industry} editor for ${brand.name} (${site.host}).

${buildBrandPrompt(config)}

CURRENT CONTENT:
# Title: ${existing.meta_data.title}
${existing.humanized_content}

USER FOLLOW-UP INSTRUCTION:
"${options.instruction}"

PARAMETERS:
- Tone: ${options.tone || "maintain author authentic voice"}
- Target Audience: ${options.targetAudience || audienceLine(brand)}
- Modify Content: ${options.modifyContent ?? true}
- Modify Title: ${options.modifyTitle ?? false}
- Add New Sections: ${options.addNewSections ?? false}

RULES:
1. STRICTLY NO EM-DASHES (—).
2. Maintain the collective editorial voice of ${brand.name} (no individual author persona or byline).
3. Preserve the authentic, humanized anti-AI writing style (high burstiness, punchy sentences).
4. Preserve factual accuracy. Do not add statistics, stories or claims that are not sourced, and follow the fact rules above.
5. Apply the user's requested revisions seamlessly.
6. Return the updated markdown content directly. If modifying the title, output the title on the very first line starting with "# Title: [New Title]" followed by the body.`;

  // gpt-oss reasoning tokens count against maxTokens; a full article needs plenty of room.
  const { text, finishReason } = await generateTextWithResilience({
    prompt,
    temperature: 0.7,
    maxTokens: 9000,
    apiKey,
  });
  if (finishReason === "length") {
    throw new Error("The revision was cut off before it finished. Try again.");
  }

  let clean = removeEmDashes(text.trim());
  let newTitle = existing.meta_data.title;

  if (clean.startsWith("# Title:")) {
    const lines = clean.split("\n");
    newTitle = lines[0].replace("# Title:", "").trim();
    clean = lines.slice(1).join("\n").trim();
  }

  // Revisions come back in the drafting model's voice; run them through the humanizer too.
  clean = (await humanizeArticle(clean, apiKey)).markdown;

  const updatedMeta = {
    ...existing.meta_data,
    title: newTitle,
  };

  const fullMarkdown = buildMarkdownWithFrontmatter(updatedMeta, clean);
  const metrics = TextProcessor.analyzeText(clean);

  return {
    ...existing,
    humanized_content: clean,
    markdown_with_frontmatter: fullMarkdown,
    meta_data: updatedMeta,
    quality_metrics: metrics,
    processing_steps: [
      ...existing.processing_steps,
      `Revised: "${options.instruction}"`,
    ],
  };
}

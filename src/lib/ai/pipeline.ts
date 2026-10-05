import { ContentResult } from "@/types/content";
import { postExists } from "../posts-store";
import { TextProcessor } from "../text-processor";
import { generateDynamicConfig } from "./author-generator";
import { isAiDetectorConfigured, scanForAi } from "./ai-detector";
import { humanizeArticle } from "./humanizer";
import { optimizeForEEAT } from "./eeat-optimizer";
import { optimizeInternalLinking } from "./internal-linker";
import { formatMarkdownWithAI, stripLeadingTitle } from "./markdown-formatter";
import {
  buildMarkdownWithFrontmatter,
  generateMetaContent,
} from "./meta-generator";
import { generateAdvancedSeedContent } from "./seed-generator";

export interface PipelineOptions {
  userTopic: string;
  customInstruction?: string;
  apiKey?: string;
  onProgress?: (step: string) => void;
  /** Set when generating from a saved idea, so its title, slug and keywords are kept. */
  idea?: {
    slug?: string;
    keywords?: string[];
    category?: string;
  };
}

export async function runContentPipeline(
  options: PipelineOptions,
): Promise<ContentResult> {
  const { userTopic, customInstruction, apiKey, onProgress, idea } =
    options;
  const steps: string[] = [];

  const log = (msg: string) => {
    steps.push(msg);
    onProgress?.(msg);
  };

  const startTime = Date.now();

  try {
    // 1. Content Strategy & Keywords
    log("Planning keywords");
    const dynamicConfig = await generateDynamicConfig(userTopic, apiKey);
    if (idea) {
      // The idea is the plan: keep its title and keyword research.
      dynamicConfig.topic = userTopic;
      if (idea.keywords?.length) {
        dynamicConfig.target_phrases = idea.keywords;
      }
    }
    log(`Keywords: ${dynamicConfig.target_phrases.slice(0, 4).join(", ")}`);

    // 2. Seed Content Generation
    log("Writing draft");
    const rawContent = await generateAdvancedSeedContent(
      dynamicConfig.topic,
      dynamicConfig.target_phrases,
      customInstruction,
      apiKey,
    );

    // 3. Humanize: spoken-voice rewrite + content-hub imperfection passes + cleanup.
    // Like content-hub, if an AI detector is configured, retry when flagged and keep the best.
    const draft = stripLeadingTitle(rawContent, dynamicConfig.topic);
    const maxAttempts = isAiDetectorConfigured() ? 3 : 1;
    let humanizedContent = "";
    let bestScore = Infinity;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(
        attempt === 1
          ? "Rewriting in a human voice"
          : `Rewriting again (attempt ${attempt} of ${maxAttempts})`,
      );
      const { markdown, rewritten, total } = await humanizeArticle(
        draft,
        apiKey,
      );
      if (rewritten < total) {
        log(
          `Rewrote ${rewritten} of ${total} sections (kept the rest unchanged to protect facts)`,
        );
      }
      const scan = await scanForAi(markdown, dynamicConfig.topic);
      if (!scan) {
        humanizedContent = markdown;
        break;
      }
      log(`AI detection (Originality.ai): ${scan.aiScore}% AI`);
      if (scan.aiScore < bestScore) {
        bestScore = scan.aiScore;
        humanizedContent = markdown;
      }
      if (!scan.likelyAI) break;
    }

    // 4. Trust disclaimer & Internal Linking
    log("Adding internal links");
    const eatOptimized = optimizeForEEAT(humanizedContent);
    const linkedContent = optimizeInternalLinking(eatOptimized);

    // 5. Markdown Formatting & Syntax Normalization
    log("Formatting markdown");
    const polishedContent = await formatMarkdownWithAI(linkedContent, apiKey);

    // 6. SEO Metadata & Frontmatter Creation with Uniqueness Checking
    log("Building title, slug and description");
    let retryAttempt = 0;
    let metaData = generateMetaContent(
      polishedContent,
      dynamicConfig.topic,
      dynamicConfig.target_phrases,
      customInstruction,
      retryAttempt,
      idea,
    );

    // Slug collision prevention: if the slug already exists in the content folder, try a variation
    while (postExists(metaData.slug) && retryAttempt < 4) {
      retryAttempt++;
      log(`Slug "${metaData.slug}" is taken, trying another`);
      metaData = generateMetaContent(
        polishedContent,
        dynamicConfig.topic,
        dynamicConfig.target_phrases,
        customInstruction,
        retryAttempt,
        idea,
      );
    }

    if (postExists(metaData.slug)) {
      metaData.slug = `${metaData.slug}-guide`;
    }

    const fullMarkdown = buildMarkdownWithFrontmatter(
      metaData,
      polishedContent,
    );
    const metrics = TextProcessor.analyzeText(polishedContent);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Done in ${elapsed}s`);

    return {
      filename: `${metaData.slug}.md`,
      slug: metaData.slug,
      raw_content: rawContent,
      humanized_content: polishedContent,
      markdown_with_frontmatter: fullMarkdown,
      meta_data: metaData,
      quality_metrics: metrics,
      processing_steps: steps,
      target_keywords: dynamicConfig.target_phrases,
    };
  } catch (error: any) {
    const errorMsg = `Failed: ${error?.message || "Unknown error"}`;
    log(errorMsg);
    console.error(errorMsg, error);
    throw error;
  }
}

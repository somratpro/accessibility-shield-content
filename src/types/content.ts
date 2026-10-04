export interface QualityMetrics {
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  flesch_reading_ease: number;
  flesch_kincaid_grade: number;
  uniqueness_score: number;
  seo_score: number;
  top_keywords: string[];
  ai_detection_estimate:
    | "Low Risk (< 15%)"
    | "Moderate Risk (15-35%)"
    | "Review Recommended";
}

export interface MetaData {
  title: string;
  meta_title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  twitter_title: string;
  twitter_description: string;
  categories: string[];
  tags: string[];
  slug: string;
  date: string;
  updated?: string;
  draft: boolean;
}

export interface ContentResult {
  filename: string;
  slug: string;
  raw_content: string;
  humanized_content: string;
  markdown_with_frontmatter: string;
  meta_data: MetaData;
  quality_metrics: QualityMetrics;
  processing_steps: string[];
  target_keywords: string[];
}

export interface FollowupInstructionOptions {
  instruction: string;
  modifyContent?: boolean;
  modifyTitle?: boolean;
  modifyMetaDescription?: boolean;
  addNewSections?: boolean;
  tone?: "professional" | "casual" | "academic" | "conversational";
  targetAudience?: string;
}

/** Planned values from a content calendar entry, passed through generation unchanged. */
export interface CalendarGenerationContext {
  slug?: string;
  keywords?: string[];
  category?: string;
}

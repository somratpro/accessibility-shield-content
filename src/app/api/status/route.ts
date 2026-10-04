import { getExistingBlogPosts } from "@/lib/posts-store";
import { getStudioConfig } from "@/lib/studio-config";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hasEnvGroqKey = Boolean(
      process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0,
    );
    const config = getStudioConfig();
    if (!config.ok) {
      return NextResponse.json({
        groqKeyConfigured: hasEnvGroqKey,
        groqKeySource: hasEnvGroqKey ? "env" : "missing",
        setupErrors: config.errors,
      });
    }

    const existingPosts = getExistingBlogPosts();
    return NextResponse.json({
      groqKeyConfigured: hasEnvGroqKey,
      groqKeySource: hasEnvGroqKey ? "env" : "missing",
      site: config.site.name,
      targetAppDir: config.site.outputDir,
      articlesCount: existingPosts.length,
      articles: existingPosts.map((p) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        wordCount: p.wordCount,
        categories: p.categories,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to get system status" },
      { status: 500 },
    );
  }
}

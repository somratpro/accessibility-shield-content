import {
  auditContentForAntiAI,
  optimizeBlogPostWithAntiAI,
} from "@/lib/ai/content-optimizer";
import { postIssues } from "@/lib/post-issues";
import {
  getExistingBlogPostBySlug,
  getExistingBlogPosts,
  savePost,
} from "@/lib/posts-store";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 800;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    // If single slug requested
    if (slug) {
      const post = getExistingBlogPostBySlug(slug);
      if (!post) {
        return NextResponse.json(
          { error: `Post with slug "${slug}" not found.` },
          { status: 404 },
        );
      }
      const audit = auditContentForAntiAI(post.rawMarkdown);
      return NextResponse.json({ success: true, post, audit });
    }

    // Otherwise list all posts with quick anti-AI audit
    const posts = getExistingBlogPosts();
    const auditedPosts = posts.map((p) => {
      const full = getExistingBlogPostBySlug(p.slug);
      const audit = full ? auditContentForAntiAI(full.rawMarkdown) : null;
      return {
        ...p,
        audit,
      };
    });

    const totalEmDashes = auditedPosts.reduce(
      (acc, p) => acc + (p.audit?.emDashCount || 0),
      0,
    );
    const totalCliches = auditedPosts.reduce(
      (acc, p) => acc + (p.audit?.aiClicheCount || 0),
      0,
    );
    const avgHealth =
      auditedPosts.length > 0
        ? Math.round(
            auditedPosts.reduce(
              (acc, p) => acc + (p.audit?.healthScore || 0),
              0,
            ) / auditedPosts.length,
          )
        : 100;

    return NextResponse.json({
      success: true,
      posts: auditedPosts,
      stats: {
        totalPosts: auditedPosts.length,
        totalEmDashes,
        totalCliches,
        avgHealth,
        postsNeedingOptimization: auditedPosts.filter(
          (p) => postIssues(p.audit).length > 0,
        ).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load existing content",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, slug, apiKey, optimizedMarkdown } = body;

    if (!slug) {
      return NextResponse.json({ error: "Slug is required." }, { status: 400 });
    }

    const post = getExistingBlogPostBySlug(slug);
    if (!post) {
      return NextResponse.json(
        { error: `Post "${slug}" not found in the content folder.` },
        { status: 404 },
      );
    }

    // Action: Optimize with Anti-AI rules. Long posts take minutes on Groq's free tier, so
    // progress is streamed as server-sent events ("step", then "result" or "error").
    if (action === "optimize") {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const sendEvent = (type: "step" | "result" | "error", data: any) =>
        writer
          .write(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
          .catch(() => {}); // the browser went away; finish quietly

      (async () => {
        try {
          sendEvent("step", { step: "Fixing dashes, AI words and links" });
          const optimization = await optimizeBlogPostWithAntiAI(
            post.rawMarkdown,
            apiKey,
            (step) => sendEvent("step", { step }),
          );
          await sendEvent("result", { slug, filename: post.filename, optimization });
        } catch (err: any) {
          console.error("Existing content cleanup error:", err);
          await sendEvent("error", { message: err?.message || "Cleanup failed" });
        } finally {
          await writer.close().catch(() => {});
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Action: Save optimized version to the content folder
    if (action === "save") {
      const contentToSave = optimizedMarkdown || post.rawMarkdown;
      const saveRes = savePost(post.filename, contentToSave);
      const newAudit = auditContentForAntiAI(contentToSave);

      return NextResponse.json({
        success: true,
        message: `Updated ${post.filename} successfully.`,
        filePath: saveRes.filePath,
        audit: newAudit,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Existing content API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process existing content request",
      },
      { status: 500 },
    );
  }
}

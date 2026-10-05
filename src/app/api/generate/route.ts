import { runContentPipeline } from "@/lib/ai/pipeline";
import { NextRequest } from "next/server";

export const maxDuration = 800;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, customInstruction, apiKey, idea } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return new Response(
        JSON.stringify({
          error: "A valid topic of at least 3 characters is required.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Set up SSE Stream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (type: "step" | "result" | "error", data: any) => {
      const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Execute in background
    (async () => {
      try {
        const result = await runContentPipeline({
          userTopic: topic.trim(),
          customInstruction,
          apiKey,
          idea:
            idea && typeof idea === "object"
              ? {
                  slug:
                    typeof idea.slug === "string" ? idea.slug : undefined,
                  keywords: Array.isArray(idea.keywords)
                    ? idea.keywords.filter(
                        (k: unknown) => typeof k === "string",
                      )
                    : undefined,
                  category:
                    typeof idea.category === "string"
                      ? idea.category
                      : undefined,
                }
              : undefined,
          onProgress: async (stepText) => {
            await sendEvent("step", { step: stepText, timestamp: Date.now() });
          },
        });

        await sendEvent("result", result);
      } catch (err: any) {
        await sendEvent("error", {
          message:
            err?.message ||
            "An unexpected error occurred during content generation.",
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

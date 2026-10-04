import { processFollowupInstruction } from "@/lib/ai/followup-processor";
import { ContentResult, FollowupInstructionOptions } from "@/types/content";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      existingContent,
      instruction,
      tone,
      targetAudience,
      modifyContent = true,
      modifyTitle = false,
      apiKey,
    } = body as {
      existingContent: ContentResult;
      instruction: string;
      tone?: "professional" | "casual" | "academic" | "conversational";
      targetAudience?: string;
      modifyContent?: boolean;
      modifyTitle?: boolean;
      apiKey?: string;
    };

    if (!existingContent || !instruction?.trim()) {
      return NextResponse.json(
        { error: "Existing content and revision instruction are required." },
        { status: 400 },
      );
    }

    const options: FollowupInstructionOptions = {
      instruction: instruction.trim(),
      tone,
      targetAudience,
      modifyContent,
      modifyTitle,
    };

    const updated = await processFollowupInstruction(
      existingContent,
      options,
      apiKey,
    );

    return NextResponse.json({ success: true, result: updated });
  } catch (error: any) {
    console.error("Followup route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process follow-up revision." },
      { status: 500 },
    );
  }
}

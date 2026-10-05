import { getContentDir, savePost } from "@/lib/posts-store";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { filename, content } = await req.json();

    if (!filename || !content) {
      return NextResponse.json(
        { error: "Filename and markdown content are required." },
        { status: 400 },
      );
    }

    const result = savePost(filename, content);

    return NextResponse.json({
      success: true,
      filePath: result.filePath,
      alreadyExisted: result.alreadyExisted,
      message: result.alreadyExisted
        ? `Updated existing post at ${result.filePath}`
        : `Successfully published new post to ${result.filePath}`,
      bytes: result.bytes,
      targetDir: getContentDir(),
    });
  } catch (error: any) {
    console.error("Save to project error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save the post." },
      { status: 500 },
    );
  }
}

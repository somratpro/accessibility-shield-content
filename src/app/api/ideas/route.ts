import {
  generateIdeas,
  getSavedIdeas,
  removeIdea,
} from "@/lib/ai/idea-generator";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const ideas = getSavedIdeas();
    return NextResponse.json({ success: true, ideas });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load ideas" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, apiKey, id } = await req.json();

    if (action === "generate") {
      return NextResponse.json({ success: true, ideas: await generateIdeas(apiKey) });
    }
    if (action === "remove" && typeof id === "string") {
      return NextResponse.json({ success: true, ideas: removeIdea(id) });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action." },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update ideas" },
      { status: 500 },
    );
  }
}

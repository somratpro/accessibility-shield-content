import { testGroqConnection } from "@/lib/ai/groq-client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { success: false, message: "API key is required" },
        { status: 400 },
      );
    }

    const result = await testGroqConnection(apiKey.trim());
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Verification failed." },
      { status: 500 },
    );
  }
}

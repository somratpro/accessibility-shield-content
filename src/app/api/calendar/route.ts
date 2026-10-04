import {
  generateFreshAICalendar,
  getSavedCalendar,
} from "@/lib/ai/calendar-generator";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const calendar = getSavedCalendar();
    return NextResponse.json({
      success: true,
      topics: calendar,
      total: calendar.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load calendar" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, apiKey } = body;

    if (action === "generate") {
      const freshTopics = await generateFreshAICalendar(apiKey);
      return NextResponse.json({
        success: true,
        topics: freshTopics,
        message: "Fresh content calendar generated successfully!",
      });
    }

    return NextResponse.json(
      { error: "Unknown action specified." },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process calendar request",
      },
      { status: 500 },
    );
  }
}

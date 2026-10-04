import { getBlogSearchPerformance } from "@/lib/search-console";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(await getBlogSearchPerformance());
}

import { NextResponse } from "next/server";
import { fetchLatestReadings, isIudxConfigured } from "@/lib/data/iudx";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function GET() {
  if (!isIudxConfigured()) {
    return NextResponse.json(
      { error: "IUDX credentials not configured" },
      { status: 503 }
    );
  }

  try {
    const readings = await fetchLatestReadings();
    return NextResponse.json({
      totalSensors: readings.length,
      readings,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[IUDX]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "IUDX fetch failed" },
      { status: 502 }
    );
  }
}

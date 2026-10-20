import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import { findNearbyIssues } from "@/lib/sightings/nearby";
import { isValidReport } from "@/lib/sightings/taxonomy";

export const runtime = "nodejs";

/**
 * Open issues near a point that may be what a new report is about, so the reporter can say "still there" instead of
 * sending it again. Public: everything returned is already on public pages, and distances run to rounded points.
 */
export async function GET(request: NextRequest) {
  if (!reportsEnabled()) return NextResponse.json({ data: [] });
  const q = request.nextUrl.searchParams;
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (!q.get("lat") || !q.get("lng") || !(lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98)) {
    return NextResponse.json({ error: "We could not read a location in India." }, { status: 400 });
  }
  const category = (q.get("category") ?? "").slice(0, 40);
  const subcategory = q.get("subcategory")?.slice(0, 40) || null;
  if (!isValidReport(category, subcategory)) return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  const acc = q.get("accuracy") ? Number(q.get("accuracy")) : NaN;

  try {
    const data = await findNearbyIssues(adminClient(), { lat, lng, category, subcategory, accuracyM: Number.isFinite(acc) && acc >= 0 ? acc : null });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch (err) {
    logRouteError("sightings/nearby", err);
    return internalServerError();
  }
}

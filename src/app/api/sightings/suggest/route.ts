import { NextResponse, after, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { reportsEnabled } from "@/lib/sightings/auth";
import { longEnough, suggest, suggestQuery } from "@/lib/sightings/suggest";
import { suggestIndex } from "@/lib/sightings/suggest-server";

export const runtime = "nodejs";

/**
 * Covered places whose names match what a reporter is typing in the report map's search box: named lakes and tanks,
 * wards, gram panchayats and basin towns, from our own static files, so it may run on every keystroke (Nominatim may
 * not; that stays behind the signed-in search route). Public. `lat` and `lng`, the map's centre, put nearer places
 * first; the answer then depends on the visitor, so only a query without them is cached where others share it.
 * Under 2 characters it answers empty and starts building the index, so the box can warm it when it takes focus.
 */
export async function GET(request: NextRequest) {
  if (!reportsEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const p = request.nextUrl.searchParams;
  const q = suggestQuery(p.get("q") ?? "");
  const pointed = p.has("lat") || p.has("lng");
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (pointed && !(lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98)) {
    return NextResponse.json({ error: "We could not read a location in India." }, { status: 400 });
  }
  const origin = request.nextUrl.origin;
  if (!longEnough(q)) {
    after(() => suggestIndex(origin).then(() => undefined));
    return NextResponse.json({ data: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const data = suggest(await suggestIndex(origin), q, pointed ? { lat, lng } : null);
    return NextResponse.json({ data }, { headers: { "Cache-Control": pointed ? "private, max-age=60" : "public, s-maxage=300" } });
  } catch (err) {
    logRouteError("sightings/suggest", err);
    return internalServerError();
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { reportsEnabled } from "@/lib/sightings/auth";
import { nearbyWater, placePoint, viewOf } from "@/lib/sightings/locate-server";
import { where } from "@/lib/sightings/serialize";

export const runtime = "nodejs";

// A point is the visitor's own; never cache it anywhere shared.
const CACHE = { "Cache-Control": "private, no-store" };

/**
 * Where a point would land, so the form can name the place, or say it is not covered, before anything is sent, and the
 * mapped water near it (`nearby`, nearest first, at most 3), so the form can ask "Are you at this lake?". `accuracy` is
 * the phone's reported accuracy in metres; it widens how far a lake outline may be.
 * With `place` instead of a point: where the map should open for a report started from that place's page.
 * Public, so a visitor can start a report before signing in: it reads only our own static place files.
 */
export async function GET(request: NextRequest) {
  if (!reportsEnabled()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const q = request.nextUrl.searchParams;
  try {
    const place = q.get("place");
    if (place) {
      const view = await viewOf(request.nextUrl.origin, { place, ward: q.get("ward"), body: q.get("body"), panchayat: q.get("panchayat") });
      return NextResponse.json({ data: view }, { headers: CACHE });
    }
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
    const acc = q.get("accuracy") ? Number(q.get("accuracy")) : NaN;
    const accuracy = Number.isFinite(acc) && acc >= 0 && acc <= 5000 ? acc : null;
    const [p, nearby] = await Promise.all([placePoint(request.nextUrl.origin, lng, lat), nearbyWater(request.nextUrl.origin, lng, lat, accuracy)]);
    if (!p) return NextResponse.json({ data: null }, { headers: CACHE });
    const label = where({ water_body_name: p.waterBodyName, ward_name: p.wardName, ward_id: p.wardId, panchayat_name: p.panchayatName, locality: p.locality });
    return NextResponse.json({ data: { placeName: p.placeName, where: label, nearby } }, { headers: CACHE });
  } catch (err) {
    logRouteError("sightings/locate", err);
    return internalServerError();
  }
}

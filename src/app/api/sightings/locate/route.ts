import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { requireUser } from "@/lib/sightings/auth";
import { placePoint, viewOf } from "@/lib/sightings/locate-server";
import { where } from "@/lib/sightings/serialize";

export const runtime = "nodejs";

/**
 * Where a point would land, so the form can name the place, or say it is not covered, before anything is sent.
 * With `place` instead of a point: where the map should open for a report started from that place's page.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const q = request.nextUrl.searchParams;
  try {
    const place = q.get("place");
    if (place) {
      const view = await viewOf(request.nextUrl.origin, { place, ward: q.get("ward"), body: q.get("body"), panchayat: q.get("panchayat") });
      return NextResponse.json({ data: view });
    }
    const lat = Number(q.get("lat"));
    const lng = Number(q.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
    const p = await placePoint(request.nextUrl.origin, lng, lat);
    const label = p
      ? where({ water_body_name: p.waterBodyName, ward_name: p.wardName, ward_id: p.wardId, panchayat_name: p.panchayatName, locality: p.locality })
      : null;
    return NextResponse.json({ data: p ? { placeName: p.placeName, where: label } : null });
  } catch (err) {
    logRouteError("sightings/locate", err);
    return internalServerError();
  }
}

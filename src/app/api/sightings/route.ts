import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, reportsEnabled, requireUser } from "@/lib/sightings/auth";
import { CAP_MESSAGES, LIMITS, type CapReason } from "@/lib/sightings/limits";
import { placePoint } from "@/lib/sightings/locate-server";
import { storePhotos } from "@/lib/sightings/photos";
import { assess, getParameter, valueText } from "@/lib/sightings/parameters";
import { resolveAuthority } from "@/lib/sightings/routing";
import { byId, toPublic } from "@/lib/sightings/serialize";
import { roleFor } from "@/lib/sightings/taxonomy";
import type { EventRow, PhotoRow, SightingRow } from "@/lib/sightings/types";
import { parseSubmit } from "@/lib/sightings/validate";

export const runtime = "nodejs";

/** Send a report. Signed-in only; caps are enforced in the database. */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;

  try {
    const parsed = parseSubmit(await request.formData());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    const place = await placePoint(request.nextUrl.origin, v.lng, v.lat);
    if (!place) return NextResponse.json({ error: "This location is outside the places we cover so far." }, { status: 422 });

    // Caps first, so a capped or suspended account costs no image processing.
    const admin = adminClient();
    const key = reporterKey(user.id);
    const { data: created, error } = await admin.rpc("create_sighting", {
      p_row: {
        reporter_key: key,
        place_kind: place.placeKind,
        place_id: place.placeId,
        state_code: place.stateCode,
        corporation_id: place.corporationId,
        ward_id: place.wardId,
        ward_name: place.wardName,
        block_code: place.blockCode,
        panchayat_code: place.panchayatCode,
        panchayat_name: place.panchayatName,
        water_body_id: place.waterBodyId,
        water_body_name: place.waterBodyName,
        lat: v.lat,
        lng: v.lng,
        location_accuracy_m: v.accuracy,
        category: v.category,
        subcategory: v.subcategory,
        note: v.note,
        readings: v.readings,
        water_source: v.waterSource,
        authority_role: roleFor(v.category, v.subcategory),
      },
      p_daily_new: LIMITS.dailyNew,
      p_daily_trusted: LIMITS.dailyTrusted,
      p_pending_new: LIMITS.pendingNew,
      p_pending_trusted: LIMITS.pendingTrusted,
      p_new_site_daily: LIMITS.newSiteDaily,
      p_all_site_daily: LIMITS.allSiteDaily,
    });
    if (error) throw error;
    if (!created.ok) return NextResponse.json({ error: CAP_MESSAGES[created.reason as CapReason] }, { status: 429 });
    const id = created.id as string;

    const stored = await storePhotos(id, key, place.placeId, "report", v.photos).catch(async (err) => {
      await admin.from("sightings").delete().eq("id", id);
      throw err;
    });
    if ("error" in stored) {
      await admin.from("sightings").delete().eq("id", id);
      return NextResponse.json({ error: stored.error }, { status: stored.status });
    }
    const exif = stored.exif ?? (v.photoMeta.capturedAt || v.photoMeta.lat != null ? v.photoMeta : null);
    if (exif) await admin.from("sightings").update({ exif_captured_at: exif.capturedAt, exif_lat: exif.lat, exif_lng: exif.lng }).eq("id", id);

    const readings = Object.entries(v.readings ?? {}).flatMap(([k, val]) => {
      const p = getParameter(k);
      return p ? [{ text: valueText(p, val), assessment: assess(p, val) }] : [];
    });
    // A piped-supply test outside a limit is the water board's to hear about.
    const role = roleFor(v.category, v.subcategory) ?? (v.waterSource === "piped" && readings.some((r) => r.assessment) ? "water_supply" : null);
    const routed = role ? resolveAuthority(role, { stateCode: place.stateCode, placeId: place.placeId, placeKind: place.placeKind, corporationId: place.corporationId }) : null;
    return NextResponse.json({ data: { id, placeName: place.placeName, handler: routed?.authority ?? null, national: routed?.national ?? [], readings } });
  } catch (err) {
    logRouteError("sightings/POST", err);
    return internalServerError();
  }
}

/** Published reports on one place, optionally narrowed to a ward, water body or panchayat. */
export async function GET(request: NextRequest) {
  if (!reportsEnabled()) return NextResponse.json({ data: [] });
  const q = request.nextUrl.searchParams;
  const placeId = q.get("place");
  if (!placeId || !/^[a-z0-9-]{2,40}$/.test(placeId)) return NextResponse.json({ error: "Invalid place" }, { status: 400 });

  try {
    const admin = adminClient();
    let query = admin
      .from("sightings")
      .select("*")
      .eq("place_id", placeId)
      .eq("review_status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);
    for (const [param, column] of [["ward", "ward_id"], ["body", "water_body_id"], ["panchayat", "panchayat_code"]] as const) {
      const value = q.get(param);
      if (value && /^[A-Za-z0-9:_-]{1,40}$/.test(value)) query = query.eq(column, value);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as SightingRow[];
    const ids = rows.map((r) => r.id);
    const [photos, events] = ids.length
      ? await Promise.all([
          admin.from("sighting_photos").select("*").in("sighting_id", ids),
          admin.from("sighting_events").select("*").in("sighting_id", ids).order("created_at"),
        ])
      : [{ data: [] }, { data: [] }];
    const photoMap = byId(photos.data as PhotoRow[]);
    const eventMap = byId(events.data as EventRow[]);
    return NextResponse.json(
      { data: rows.map((r) => toPublic(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? [])) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    logRouteError("sightings/GET", err);
    return internalServerError();
  }
}

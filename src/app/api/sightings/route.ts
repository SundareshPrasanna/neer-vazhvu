import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, reportsEnabled, requireUser } from "@/lib/sightings/auth";
import { CARDS_PER_ISSUE, buildIssues, type IssueEvent } from "@/lib/sightings/issues";
import { CAP_MESSAGES, LIMITS, type CapReason } from "@/lib/sightings/limits";
import { placePoint } from "@/lib/sightings/locate-server";
import { publicPhotoUrl, storePhotos } from "@/lib/sightings/photos";
import { assess, getParameter, valueText } from "@/lib/sightings/parameters";
import { GROUP_DAILY_MESSAGE, GROUP_LIMITS, groupSentToday } from "@/lib/sightings/groups";
import { placeUrl } from "@/lib/sightings/place-url";
import { resolveAuthority } from "@/lib/sightings/routing";
import { loadExtras } from "@/lib/sightings/extras";
import { byId, toPublic } from "@/lib/sightings/serialize";
import { REPORT_GROUPS, isCommunityReport, roleFor } from "@/lib/sightings/taxonomy";
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
    if (!place) return NextResponse.json({ error: "This location is outside the cities, districts and river basins we cover so far." }, { status: 422 });

    const readings = Object.entries(v.readings ?? {}).flatMap(([k, val]) => {
      const p = getParameter(k);
      return p ? [{ text: valueText(p, val), assessment: assess(p, val) }] : [];
    });
    // A piped-supply test outside a limit is the water board's to hear about.
    const role = roleFor(v.category, v.subcategory) ?? (v.waterSource === "piped" && readings.some((r) => r.assessment) ? "water_supply" : null);

    // Caps first, so a capped or suspended account costs no image processing.
    const admin = adminClient();
    const key = reporterKey(user.id);
    if (v.groupId && isCommunityReport(v.category) && (await groupSentToday(admin, v.groupId)) >= GROUP_LIMITS.reportsDaily) {
      return NextResponse.json({ error: GROUP_DAILY_MESSAGE }, { status: 429 });
    }
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
        locality: place.locality,
        lat: v.lat,
        lng: v.lng,
        location_accuracy_m: v.accuracy,
        category: v.category,
        subcategory: v.subcategory,
        note: v.note,
        // Omitted, not null: JSON null is a value, and the readings check rejects it.
        ...(v.readings && { readings: v.readings }),
        water_source: v.waterSource,
        authority_role: role,
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
    if (v.testMeta) await admin.from("sightings").update({ test_meta: v.testMeta }).eq("id", id);
    // A group name beside a home report would narrow down who sent it.
    if (v.groupId && isCommunityReport(v.category)) {
      const [member, group] = await Promise.all([
        admin.from("sighting_group_members").select("group_id").eq("group_id", v.groupId).eq("reporter_key", key).maybeSingle(),
        admin.from("sighting_groups").select("status").eq("id", v.groupId).maybeSingle(),
      ]);
      if (member.data && group.data?.status === "approved") await admin.from("sightings").update({ group_id: v.groupId }).eq("id", id);
    }

    const routed = role ? resolveAuthority(role, { stateCode: place.stateCode, placeId: place.placeId, placeKind: place.placeKind, corporationId: place.corporationId }) : null;
    const shownOn = placeUrl({
      place_kind: place.placeKind,
      place_id: place.placeId,
      ward_id: place.wardId,
      water_body_id: place.waterBodyId,
      water_body_name: place.waterBodyName,
      panchayat_code: place.panchayatCode,
      panchayat_name: place.panchayatName,
      category: v.category,
    });
    return NextResponse.json({
      data: { id, placeName: place.placeName, placeHref: shownOn?.href ?? null, placeLabel: shownOn?.label ?? null, role, handler: routed?.authority ?? null, national: routed?.national ?? [], readings },
    });
  } catch (err) {
    logRouteError("sightings/POST", err);
    return internalServerError();
  }
}

/** Shown at ward or village level only, so never listed under the water body their point fell in. */
const PRIVATE_GROUPS = `(${REPORT_GROUPS.filter((g) => g.private).map((g) => g.key).join(",")})`;

/** The map's view as west,south,east,north; null when absent or not a small enough box inside India. */
function parseBbox(raw: string | null): [number, number, number, number] | null {
  const b = raw?.split(",").map(Number);
  if (!b || b.length !== 4 || b.some((v) => !Number.isFinite(v))) return null;
  const [w, s, e, n] = b;
  if (w >= e || s >= n || w < 60 || e > 100 || s < 0 || n > 40 || e - w > 12 || n - s > 12) return null;
  return [w, s, e, n];
}

/** Newest published reports a place page lists as cards; its issues are built from up to 500. */
const PLACE_CARDS = 50;

const firstPhoto = (photos: PhotoRow[], kind: PhotoRow["kind"]) => {
  const p = photos.filter((x) => x.kind === kind && x.public_path).sort((a, b) => a.ordinal - b.ordinal)[0];
  return p ? publicPhotoUrl(p.public_path!) : null;
};

/**
 * Published reports on one place, optionally narrowed to a ward, water body or panchayat, with the issues they make
 * (issues.ts) and the cards those issues open to beyond the newest 50 (`issueReports`); or, with `bbox`, every
 * published report with a public point inside a map's view (tap water and water tests have none).
 */
export async function GET(request: NextRequest) {
  if (!reportsEnabled()) return NextResponse.json({ data: [] });
  const q = request.nextUrl.searchParams;
  const placeId = q.get("place");
  const bbox = parseBbox(q.get("bbox"));
  if (q.get("bbox") && !bbox) return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
  if (!bbox && (!placeId || !/^[a-z0-9-]{2,40}$/.test(placeId))) return NextResponse.json({ error: "Invalid place" }, { status: 400 });

  try {
    const admin = adminClient();
    // A water body is one record wherever it sits: a city's lake panel also shows reports filed under the district around it.
    const bodyId = q.get("body");
    const byBody = !bbox && !!bodyId && /^[A-Za-z0-9:_-]{1,40}$/.test(bodyId);
    let query = admin.from("sightings").select("*").eq("review_status", "approved").order("created_at", { ascending: false });
    query = bbox
      ? query.gte("lng", bbox[0]).gte("lat", bbox[1]).lte("lng", bbox[2]).lte("lat", bbox[3]).limit(500)
      : query.eq(byBody ? "water_body_id" : "place_id", byBody ? bodyId : placeId!).limit(500);
    if (byBody || bbox) query = query.not("category", "in", PRIVATE_GROUPS);
    for (const [param, column] of bbox ? [] : ([["ward", "ward_id"], ["panchayat", "panchayat_code"]] as const)) {
      const value = q.get(param);
      if (value && /^[A-Za-z0-9:_-]{1,40}$/.test(value)) query = query.eq(column, value);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as SightingRow[];
    const ids = rows.map((r) => r.id);
    // In batches: 500 ids in one query string is too long a URL.
    const batches = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150));
    const parts = await Promise.all(
      batches.map((b) =>
        Promise.all([
          admin.from("sighting_photos").select("*").in("sighting_id", b),
          admin.from("sighting_events").select("*").in("sighting_id", b).order("created_at"),
        ]),
      ),
    );
    const photos = { data: parts.flatMap(([p]) => (p.data ?? []) as PhotoRow[]) };
    // `select("*")` brings each actor's tag: issues count people by it, and it never leaves the server.
    const events = { data: parts.flatMap(([, e]) => (e.data ?? []) as (EventRow & IssueEvent)[]) };
    const photoMap = byId(photos.data as PhotoRow[]);
    const extras = await loadExtras(admin, rows);
    const eventMap = byId(events.data);
    const all = rows.map((r) => toPublic(r, photoMap.get(r.id) ?? [], eventMap.get(r.id) ?? [], extras.get(r.id)));
    const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
    if (bbox) return NextResponse.json({ data: all }, { headers });

    const cards = all.slice(0, PLACE_CARDS);
    const issues = buildIssues(
      rows.map((r, i) => {
        const p = photoMap.get(r.id) ?? [];
        return { row: r, report: all[i], events: eventMap.get(r.id) ?? [], reportPhoto: firstPhoto(p, "report"), fixedPhoto: firstPhoto(p, "fixed") };
      }),
    );
    const listed = new Set(cards.map((r) => r.id));
    const opens = new Set(issues.flatMap((i) => i.reportIds.slice(0, CARDS_PER_ISSUE)));
    return NextResponse.json({ data: cards, issues, issueReports: all.filter((r) => opens.has(r.id) && !listed.has(r.id)) }, { headers });
  } catch (err) {
    logRouteError("sightings/GET", err);
    return internalServerError();
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reporterKey, requireUser } from "@/lib/sightings/auth";
import { kindLabel, parsePackPeriod, placeNameOf, shapePack, type PackCleanupSource, type PackReportSource } from "@/lib/sightings/groups";
import { publicPhotoUrl } from "@/lib/sightings/photos";
import { byId, toPublic } from "@/lib/sightings/serialize";
import type { EventRow, PhotoRow, SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: PRIVATE });
const UUID = /^[0-9a-f-]{36}$/;
const PAGE = 1000;
const CHUNK = 150;

type Result = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/** Every row of a query, a page at a time: the database returns at most 1000 at once, and a count must not stop short. */
async function paged<T>(run: (from: number, to: number) => Result): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) return out;
  }
}

/** The same for a long id list, in chunks, as long lists make the URL too long. */
async function pagedIn<T>(ids: string[], run: (part: string[], from: number, to: number) => Result): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    out.push(...(await paged<T>((from, to) => run(part, from, to))));
  }
  return out;
}

/** One published report as the pack counts it: labels and public links only. */
function source(row: SightingRow, photos: PhotoRow[], nods: EventRow[]): PackReportSource {
  const pub = toPublic(row, photos, nods);
  const first = (kind: PhotoRow["kind"]) => {
    const p = photos.filter((x) => x.kind === kind && x.public_path).sort((a, b) => a.ordinal - b.ordinal)[0];
    return p ? publicPhotoUrl(p.public_path!) : null;
  };
  return {
    reviewStatus: row.review_status,
    reporterKey: row.reporter_key,
    category: row.category,
    publishedAt: row.reviewed_at ?? row.created_at,
    type: pub.label,
    caseStatus: pub.caseStatus,
    place: [pub.where, pub.placeName].filter(Boolean).join(", "),
    placeKey: pub.followTarget,
    href: pub.placeHref,
    photo: first("report"),
    fixedPhoto: first("fixed"),
    seen: pub.seenCount,
    thanks: pub.thanksCount,
  };
}

/**
 * A reviewed group's evidence pack for its members: reports sent with it and published in the period, and the clean-ups
 * it held then. `from` and `to` are India dates (YYYY-MM-DD, both included); the default is the last 3 months. Counts
 * only: never who sent or came.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const q = request.nextUrl.searchParams;
  const groupId = q.get("groupId") ?? "";
  if (!UUID.test(groupId)) return fail("Not found", 404);
  const now = Date.now();
  const period = parsePackPeriod(q.get("from") || null, q.get("to") || null, now);
  if (!period.ok) return fail(period.error, 400);
  const { start, end } = period.value;

  try {
    const admin = adminClient();
    const [member, group, members] = await Promise.all([
      admin.from("sighting_group_members").select("role").eq("group_id", groupId).eq("reporter_key", reporterKey(user.id)).maybeSingle(),
      admin.from("sighting_groups").select("name, kind, place_id, status").eq("id", groupId).maybeSingle(),
      admin.from("sighting_group_members").select("group_id", { count: "exact", head: true }).eq("group_id", groupId),
    ]);
    if (member.error) throw member.error;
    if (group.error) throw group.error;
    if (members.error) throw members.error;
    if (!member.data || !group.data) return fail("Only members of this group can see its evidence pack.", 403);
    if (group.data.status !== "approved") return fail("The evidence pack is ready once the group is checked.", 409);

    const [rows, fixits] = await Promise.all([
      paged<SightingRow>((a, b) =>
        admin.from("sightings").select("*").eq("group_id", groupId).eq("review_status", "approved").gte("reviewed_at", start).lt("reviewed_at", end).order("reviewed_at").order("id").range(a, b),
      ),
      paged<{ id: string; sighting_id: string; starts_at: string; status: PackCleanupSource["status"] }>((a, b) =>
        admin.from("sighting_fixits").select("id, sighting_id, starts_at, status").eq("group_id", groupId).eq("status", "done").gte("starts_at", start).lt("starts_at", end).order("starts_at").order("id").range(a, b),
      ),
    ]);
    // Clean-ups can be at anyone's report, sent with this group or not.
    const loaded = new Set(rows.map((r) => r.id));
    const extraIds = [...new Set(fixits.map((f) => f.sighting_id))].filter((id) => !loaded.has(id));
    const [extra, rsvps] = await Promise.all([
      pagedIn<SightingRow>(extraIds, (part, a, b) => admin.from("sightings").select("*").in("id", part).eq("review_status", "approved").order("id").range(a, b)),
      pagedIn<{ fixit_id: string; reporter_key: string }>(
        fixits.map((f) => f.id),
        (part, a, b) => admin.from("sighting_fixit_rsvps").select("fixit_id, reporter_key").in("fixit_id", part).order("fixit_id").order("reporter_key").range(a, b),
      ),
    ]);
    const all = [...rows, ...extra];
    const [photos, nods] = await Promise.all([
      pagedIn<PhotoRow>(
        all.map((r) => r.id),
        (part, a, b) => admin.from("sighting_photos").select("id, sighting_id, kind, storage_path, public_path, ordinal").in("sighting_id", part).not("public_path", "is", null).order("id").range(a, b),
      ),
      pagedIn<EventRow>(
        rows.map((r) => r.id),
        (part, a, b) => admin.from("sighting_events").select("id, sighting_id, event, created_at, actor_role").in("sighting_id", part).in("event", ["seen_too", "thanks"]).order("id").range(a, b),
      ),
    ]);
    const photoMap = byId(photos);
    const nodMap = byId(nods);
    const sources = new Map(all.map((r) => [r.id, source(r, photoMap.get(r.id) ?? [], nodMap.get(r.id) ?? [])]));
    const coming = new Map<string, string[]>();
    for (const r of rsvps) coming.set(r.fixit_id, [...(coming.get(r.fixit_id) ?? []), r.reporter_key]);

    const pack = shapePack({
      group: { name: group.data.name, kindLabel: kindLabel(group.data.kind), placeName: placeNameOf(group.data.place_id) },
      period: period.value,
      now,
      members: members.count ?? 0,
      reports: rows.map((r) => sources.get(r.id)!),
      cleanups: fixits.flatMap((f) => {
        const report = sources.get(f.sighting_id);
        return report ? [{ status: f.status, startsAt: f.starts_at, coming: coming.get(f.id) ?? [], report }] : [];
      }),
    });
    return NextResponse.json({ data: pack }, { headers: PRIVATE });
  } catch (err) {
    logRouteError("sightings/groups/pack", err);
    return internalServerError();
  }
}

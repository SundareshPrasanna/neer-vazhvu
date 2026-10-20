import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExtras } from "./extras";
import { ISSUE_RADIUS_M, buildIssues, issuePhotos, type IssueEvent, type IssueSource } from "./issues";
import { metresBetween } from "./locate";
import { publicPhotoUrl } from "./photos";
import { byId, toPublic } from "./serialize";
import { OPEN_STATUSES } from "./status";
import { OTHER_KEY, isPrivateCategory, relatedSubcategories } from "./taxonomy";
import type { EventRow, NearbyIssue, PhotoRow, SightingRow } from "./types";

/** At most this many issues are offered as "the same thing?". */
const NEARBY_MAX = 3;

/** How close an issue must be: 100 m, or the phone's accuracy plus 50 m when that is more, at most 150 m. */
export function sameSpotRadiusM(accuracyM?: number | null): number {
  return Math.min(150, Math.max(100, (accuracyM ?? 0) + 50));
}

/** Published reports as issues.ts takes them, with photos, history, group and clean-up; ids in batches of 150. */
export async function issueSources(admin: SupabaseClient, rows: SightingRow[]): Promise<IssueSource[]> {
  const ids = rows.map((r) => r.id);
  const batches = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150));
  const parts = await Promise.all(
    batches.map((b) =>
      Promise.all([
        admin.from("sighting_photos").select("*").in("sighting_id", b),
        admin.from("sighting_events").select("*").in("sighting_id", b).order("created_at"),
      ]),
    ),
  );
  for (const [p, e] of parts) {
    if (p.error) throw p.error;
    if (e.error) throw e.error;
  }
  const photos = byId(parts.flatMap(([p]) => (p.data ?? []) as PhotoRow[]));
  // `select("*")` brings each actor's tag: issues count people by it, and it never leaves the server.
  const events = byId(parts.flatMap(([, e]) => (e.data ?? []) as (EventRow & IssueEvent)[]));
  const extras = await loadExtras(admin, rows);
  return rows.map((row) => {
    const p = photos.get(row.id) ?? [];
    const ev = events.get(row.id) ?? [];
    return { row, report: toPublic(row, p, ev, extras.get(row.id)), events: ev, photos: issuePhotos(p, publicPhotoUrl) };
  });
}

/**
 * Open community issues near a point that may be the same thing as a new report: the same type or one residents mix it
 * up with (RELATED_TYPES), within sameSpotRadiusM of any report in the issue. Nearest first, at most three; never a home
 * report, an "other" report or `excludeId`. `reportId` is the issue's newest report, which "still there" and "seen it
 * too" are recorded against.
 *
 * By default distances run to each report's public point, rounded to about 100 m, and come back to the nearest 10 m:
 * what anyone may ask can never pin down an exact point. `precise` (reviewers only) uses the exact points.
 */
export async function findNearbyIssues(
  admin: SupabaseClient,
  q: { lat: number; lng: number; category: string; subcategory: string | null; accuracyM?: number | null; excludeId?: string; precise?: boolean },
): Promise<NearbyIssue[]> {
  if (q.category === OTHER_KEY || isPrivateCategory(q.category) || !q.subcategory) return [];
  const radius = sameSpotRadiusM(q.accuracyM);
  // Reports chained to a nearby one belong to its issue, so load a wider box than the radius (and the rounding).
  const reach = radius + 2 * ISSUE_RADIUS_M + (q.precise ? 0 : 80);
  const dLat = reach / 111_320;
  const dLng = reach / (111_320 * Math.cos((q.lat * Math.PI) / 180));
  const { data, error } = await admin
    .from("sightings")
    .select("*")
    .eq("review_status", "approved")
    .in("subcategory", [...relatedSubcategories(q.subcategory)])
    .gte("lat", q.lat - dLat)
    .lte("lat", q.lat + dLat)
    .gte("lng", q.lng - dLng)
    .lte("lng", q.lng + dLng)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = ((data ?? []) as SightingRow[]).filter((r) => r.id !== q.excludeId && !isPrivateCategory(r.category));
  if (rows.length === 0) return [];

  const sources = new Map((await issueSources(admin, rows)).map((s) => [s.row.id, s]));
  const pointOf = (s: IssueSource): [number, number] | null => (q.precise ? [Number(s.row.lat), Number(s.row.lng)] : s.report.point);
  const out: NearbyIssue[] = [];
  for (const issue of buildIssues([...sources.values()])) {
    if (!issue.status || !OPEN_STATUSES.has(issue.status)) continue;
    const d = Math.min(
      ...issue.reportIds.map((id) => {
        const p = pointOf(sources.get(id)!);
        return p ? metresBetween(q.lng, q.lat, p[1], p[0]) : Infinity;
      }),
    );
    if (d <= radius) out.push({ issue, distanceM: Math.round(d / 10) * 10, reportId: issue.reportIds[0] });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM || b.issue.people - a.issue.people).slice(0, NEARBY_MAX);
}

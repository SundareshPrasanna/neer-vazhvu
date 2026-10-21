import "server-only";

import { cache } from "react";

import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import { issuePhotos, type IssueEvent, type IssueSource } from "@/lib/sightings/issues";
import { findIssue, isIssueId } from "@/lib/sightings/issue-share";
import { publicPhotoUrl } from "@/lib/sightings/photos";
import { byId, toPublic } from "@/lib/sightings/serialize";
import { isCommunityReport } from "@/lib/sightings/taxonomy";
import type { EventRow, PhotoRow, PublicIssue, SightingRow } from "@/lib/sightings/types";

export interface SharedIssue {
  issue: PublicIssue & { placeHref: string };
  /** The city, district or basin of its first report. */
  placeName: string;
}

/**
 * The issue a shared link points at, rebuilt as its place page builds it (issues.ts), or null: not found, not
 * published, a home report, no issue, or no page to send people to. Loaded once per request for the page and its tags.
 */
export const loadSharedIssue = cache(async (id: string): Promise<SharedIssue | null> => {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on" || !reportsEnabled() || !isIssueId(id)) return null;
  const admin = adminClient();
  const one = await admin.from("sightings").select("*").eq("id", id).maybeSingle();
  if (one.error) throw one.error;
  const row = one.data as SightingRow | null;
  if (!row || row.review_status !== "approved" || !isCommunityReport(row.category) || !row.case_status) return null;

  // Reports share an issue only under the same place key (issuePlaceKey): load the published ones there, of every type,
  // as its place page does, so related types join the same way.
  let q = admin.from("sightings").select("*").eq("review_status", "approved");
  if (row.water_body_id) q = q.eq("water_body_id", row.water_body_id);
  else {
    q = q.eq("place_id", row.place_id).is("water_body_id", null);
    if (row.panchayat_code) q = q.eq("panchayat_code", row.panchayat_code);
    else if (row.ward_id) q = q.eq("ward_id", row.ward_id);
  }
  const many = await q.order("created_at", { ascending: false }).limit(500);
  if (many.error) throw many.error;
  const rows = (many.data ?? []) as SightingRow[];
  const ids = rows.map((r) => r.id);
  // In batches: hundreds of ids in one query string is too long a URL.
  const parts = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150)).map((b) =>
      Promise.all([
        admin.from("sighting_photos").select("*").in("sighting_id", b),
        admin.from("sighting_events").select("*").in("sighting_id", b).order("created_at"),
      ]),
    ),
  );
  const photos = byId(parts.flatMap(([p]) => (p.data ?? []) as PhotoRow[]));
  const events = byId(parts.flatMap(([, e]) => (e.data ?? []) as (EventRow & IssueEvent)[]));
  const sources: IssueSource[] = rows.map((r) => {
    const p = photos.get(r.id) ?? [];
    const ev = events.get(r.id) ?? [];
    return { row: r, report: toPublic(r, p, ev), events: ev, photos: issuePhotos(p, publicPhotoUrl) };
  });

  const issue = findIssue(sources, id);
  if (!issue?.placeHref) return null;
  const first = sources.find((s) => s.row.id === issue.id) ?? sources.find((s) => s.row.id === id)!;
  return { issue: { ...issue, placeHref: issue.placeHref }, placeName: first.report.placeName };
});

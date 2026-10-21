import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyReporter, type Notice } from "./notify";
import { isCommunityReport } from "./taxonomy";
import type { SightingRow } from "./types";

/** Notices per event at most; a place with more followers than this is told in later events. */
const MAX_NOTICES = 200;

/** The place keys a follower can hold: the place, its ward or panchayat, and the water body wherever it sits. */
export function followTargets(p: { place_id: string; ward_id?: string | null; water_body_id?: string | null; panchayat_code?: string | null }): string[] {
  const t = [p.place_id];
  if (p.ward_id) t.push(`${p.place_id}:ward:${p.ward_id}`);
  if (p.panchayat_code) t.push(`${p.place_id}:gp:${p.panchayat_code}`);
  if (p.water_body_id) t.push(`body:${p.water_body_id}`);
  return t;
}

/** A follow key from a place page's own identifiers (the same ones PlaceReports takes). */
export function followTargetFor(q: { place: string; ward?: string | number | null; body?: string | number | null; panchayat?: string | null }): string {
  if (q.body != null) return `body:${q.body}`;
  if (q.panchayat) return `${q.place}:gp:${q.panchayat}`;
  if (q.ward != null) return `${q.place}:ward:${q.ward}`;
  return q.place;
}

/** Tells everyone following this report's place, except the people named (the reporter, whoever acted). Never throws. */
export async function notifyFollowers(admin: SupabaseClient, row: SightingRow, notice: Notice, except: (string | null | undefined)[] = []): Promise<void> {
  // A home's tap or well is never announced to a place's followers.
  if (!isCommunityReport(row.category)) return;
  try {
    const { data } = await admin.from("sighting_follows").select("reporter_key").in("target", followTargets(row)).limit(MAX_NOTICES * 2);
    const skip = new Set(except.filter(Boolean));
    const keys = [...new Set((data ?? []).map((r) => r.reporter_key as string))].filter((k) => !skip.has(k)).slice(0, MAX_NOTICES);
    await Promise.all(keys.map((k) => notifyReporter(k, notice)));
  } catch {
    // A failed notice must not fail the update that caused it.
  }
}

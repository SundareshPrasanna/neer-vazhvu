import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicExtras } from "./serialize";
import type { SightingRow } from "./types";

/** In batches: long id lists make URLs too long. */
async function batched<T>(ids: string[], run: (b: string[]) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...(((await run(ids.slice(i, i + 150))).data ?? []) as T[]));
  return out;
}

type Fixit = { id: string; sighting_id: string; group_id: string; starts_at: string; meeting_point: string; note: string | null };

/**
 * The group each report was sent with and its next planned clean-up, by report id. Only reviewed (approved) groups are
 * named; a clean-up that started over three hours ago is no longer "next".
 */
export async function loadExtras(admin: SupabaseClient, rows: SightingRow[]): Promise<Map<string, PublicExtras>> {
  const out = new Map<string, PublicExtras>();
  if (rows.length === 0) return out;
  const since = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const fixits = await batched<Fixit>(rows.map((r) => r.id), (b) =>
    admin.from("sighting_fixits").select("id, sighting_id, group_id, starts_at, meeting_point, note").in("sighting_id", b).eq("status", "planned").gte("starts_at", since).order("starts_at"),
  );
  const groupIds = [...new Set([...rows.map((r) => r.group_id), ...fixits.map((f) => f.group_id)].filter((g): g is string => !!g))];
  const groups = await batched<{ id: string; name: string; status: string }>(groupIds, (b) => admin.from("sighting_groups").select("id, name, status").in("id", b));
  const named = new Map(groups.filter((g) => g.status === "approved").map((g) => [g.id, g.name]));
  const rsvps = await batched<{ fixit_id: string }>(fixits.map((f) => f.id), (b) => admin.from("sighting_fixit_rsvps").select("fixit_id").in("fixit_id", b));
  const going = new Map<string, number>();
  for (const r of rsvps) going.set(r.fixit_id, (going.get(r.fixit_id) ?? 0) + 1);
  for (const row of rows) {
    const f = fixits.find((x) => x.sighting_id === row.id && named.has(x.group_id));
    out.set(row.id, {
      groupName: row.group_id ? (named.get(row.group_id) ?? null) : null,
      fixit: f ? { id: f.id, groupName: named.get(f.group_id)!, startsAt: f.starts_at, meetingPoint: f.meeting_point, note: f.note, going: going.get(f.id) ?? 0 } : null,
    });
  }
  return out;
}

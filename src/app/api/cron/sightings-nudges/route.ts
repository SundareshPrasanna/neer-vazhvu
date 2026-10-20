import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import { CLEANUPS_ON, REMIND_AHEAD_HOURS, fixitWhen, reminderDue, type ReminderRow } from "@/lib/sightings/groups";
import { sendNotice } from "@/lib/sightings/notify";
import { placeUrl } from "@/lib/sightings/place-url";
import { NUDGE_DAYS, dueByReporter, nudgeNotice, type NudgeRow } from "@/lib/sightings/push";
import { OPEN_STATUSES } from "@/lib/sightings/status";
import type { SightingRow } from "@/lib/sightings/types";

export const runtime = "nodejs";

/** Ids or tags per PostgREST request, so the URL stays short. */
const CHUNK = 100;
const PAGE = 1000;
/** Reporters sent to at once. */
const BATCH = 10;

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Every row of a query, a page at a time. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) return out;
  }
}

/** Bearer SIGHTINGS_CRON_SECRET, its own secret: the repository CRON_SECRET belongs to the Python API pipeline. */
function cronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.SIGHTINGS_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured: SIGHTINGS_CRON_SECRET is missing" }, { status: 500 });
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

type FixitRow = ReminderRow & { id: string; sighting_id: string; group_id: string; meeting_point: string };

/**
 * Clean-ups: a day ahead, everyone who said "I'll come" and the group's hosts are reminded; once one has been over for
 * six hours, the hosts are asked for an "It's gone" photo if the report is still open. Each once per clean-up (reminded_at).
 */
async function remindFixits(admin: ReturnType<typeof adminClient>, now: Date): Promise<{ reminded: number; asked: number }> {
  const t = now.getTime();
  // Wide enough for both: the coming day, and the last week of clean-ups that have ended.
  const from = new Date(t - 8 * 86_400_000).toISOString();
  const to = new Date(t + REMIND_AHEAD_HOURS * 3_600_000).toISOString();
  const rows = await all<FixitRow>((a, b) =>
    admin
      .from("sighting_fixits")
      .select("id, sighting_id, group_id, starts_at, meeting_point, status, reminded_at")
      .in("status", ["planned", "done"])
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("id")
      .range(a, b),
  );
  const due = rows.flatMap((f) => {
    const kind = reminderDue(f, t);
    return kind ? [{ f, kind }] : [];
  });
  if (!due.length) return { reminded: 0, asked: 0 };

  const groupIds = [...new Set(due.map((d) => d.f.group_id))];
  const fixitIds = due.filter((d) => d.kind === "before").map((d) => d.f.id);
  const sightingIds = [...new Set(due.filter((d) => d.kind === "after").map((d) => d.f.sighting_id))];
  const [groups, hosts, rsvps, sightings] = await Promise.all([
    admin.from("sighting_groups").select("id, name").in("id", groupIds),
    admin.from("sighting_group_members").select("group_id, reporter_key").in("group_id", groupIds).eq("role", "host"),
    fixitIds.length ? admin.from("sighting_fixit_rsvps").select("fixit_id, reporter_key").in("fixit_id", fixitIds) : Promise.resolve({ data: [], error: null }),
    sightingIds.length ? admin.from("sightings").select("*").in("id", sightingIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [groups, hosts, rsvps, sightings]) if (r.error) throw r.error;
  const nameOf = new Map((groups.data ?? []).map((g) => [g.id as string, g.name as string]));
  const hostsOf = (g: string) => (hosts.data ?? []).filter((h) => h.group_id === g).map((h) => h.reporter_key as string);
  const rowOf = new Map(((sightings.data ?? []) as SightingRow[]).map((r) => [r.id, r]));

  let reminded = 0;
  let asked = 0;
  for (const { f, kind } of due) {
    if (kind === "before") {
      const keys = new Set([...hostsOf(f.group_id), ...(rsvps.data ?? []).filter((r) => r.fixit_id === f.id).map((r) => r.reporter_key as string)]);
      const notice = {
        title: "Clean-up coming up",
        body: `${nameOf.get(f.group_id) ?? "A group"}: ${fixitWhen(f.starts_at)}, meet at ${f.meeting_point}. Bring gloves and a bag, and stay on the bank.`,
        url: "/for-citizens",
      };
      await Promise.all([...keys].map((k) => sendNotice(k, notice)));
      reminded += 1;
    } else {
      const row = rowOf.get(f.sighting_id);
      // Fixed or closed meanwhile: nothing to ask; marked all the same, so it is not looked at again.
      if (row?.review_status === "approved" && row.case_status && OPEN_STATUSES.has(row.case_status)) {
        const notice = {
          title: "How did the clean-up go?",
          body: "If the spot is clear now, open the report and tap It's gone to send a photo. It is checked before the report changes.",
          url: placeUrl(row)?.href ?? "/for-citizens",
        };
        await Promise.all(hostsOf(f.group_id).map((k) => sendNotice(k, notice)));
        asked += 1;
      }
    }
    const up = await admin.from("sighting_fixits").update({ reminded_at: now.toISOString() }).eq("id", f.id);
    if (up.error) logRouteError("cron/sightings-nudges", up.error);
  }
  return { reminded, asked };
}

/**
 * Daily: one notice per reporter whose published, open reports have had no update for two weeks.
 * Only reporters with notifications on are considered; the others' reports keep nudged_at empty,
 * so turning notifications on later brings the reminder. Then the clean-up reminders (remindFixits). Returns counts only.
 */
export async function POST(request: NextRequest) {
  const denied = cronAuth(request);
  if (denied) return denied;
  if (!reportsEnabled() || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ data: { enabled: false } });
  }
  try {
    const admin = adminClient();
    const now = new Date();
    const cutoff = new Date(now.getTime() - NUDGE_DAYS * 86_400_000).toISOString();

    const subs = await all<{ reporter_key: string }>((from, to) =>
      admin.from("sighting_push_subscriptions").select("reporter_key").order("endpoint").range(from, to),
    );
    const keys = [...new Set(subs.map((s) => s.reporter_key))];

    const rows: NudgeRow[] = [];
    for (const part of chunks(keys, CHUNK)) {
      rows.push(
        ...(await all<NudgeRow>((from, to) =>
          admin
            .from("sightings")
            .select("id, reporter_key, review_status, case_status, created_at, nudged_at")
            .in("reporter_key", part)
            .eq("review_status", "approved")
            .in("case_status", [...OPEN_STATUSES])
            .lt("created_at", cutoff)
            .or(`nudged_at.is.null,nudged_at.lt."${cutoff}"`)
            .order("id")
            .range(from, to),
        )),
      );
    }

    // Only events inside the window matter: any one of them means the report had an update.
    const lastEvent = new Map<string, string>();
    for (const part of chunks(rows.map((r) => r.id), CHUNK)) {
      const events = await all<{ sighting_id: string; created_at: string }>((from, to) =>
        admin.from("sighting_events").select("sighting_id, created_at").in("sighting_id", part).gte("created_at", cutoff).order("id").range(from, to),
      );
      for (const e of events) {
        const prev = lastEvent.get(e.sighting_id);
        if (!prev || Date.parse(e.created_at) > Date.parse(prev)) lastEvent.set(e.sighting_id, e.created_at);
      }
    }

    const due = [...dueByReporter(rows, lastEvent, now)];
    let notified = 0;
    let reports = 0;
    for (const batch of chunks(due, BATCH)) {
      await Promise.all(
        batch.map(async ([key, ids]) => {
          // A reporter none of whose browsers took the notice is tried again tomorrow.
          if ((await sendNotice(key, nudgeNotice(ids.length))) === 0) return;
          notified += 1;
          reports += ids.length;
          for (const part of chunks(ids, CHUNK)) {
            const up = await admin.from("sightings").update({ nudged_at: now.toISOString() }).in("id", part);
            if (up.error) logRouteError("cron/sightings-nudges", up.error);
          }
        }),
      );
    }
    // A failure here must not lose the nudge counts above.
    const cleanups = CLEANUPS_ON
      ? await remindFixits(admin, now).catch((err) => {
          logRouteError("cron/sightings-nudges fixits", err);
          return null;
        })
      : null;
    return NextResponse.json({ data: { due: due.length, notified, reports, cleanups } });
  } catch (err) {
    logRouteError("cron/sightings-nudges", err);
    return internalServerError();
  }
}

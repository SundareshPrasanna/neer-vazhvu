import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { internalServerError, logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import { sendNotice } from "@/lib/sightings/notify";
import { NUDGE_DAYS, dueByReporter, nudgeNotice, type NudgeRow } from "@/lib/sightings/push";
import { OPEN_STATUSES } from "@/lib/sightings/status";

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

/** The same Bearer CRON_SECRET check the scheduled jobs use. */
function cronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured: CRON_SECRET is missing" }, { status: 500 });
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Daily: one notice per reporter whose published, open reports have had no update for two weeks.
 * Only reporters with notifications on are considered; the others' reports keep nudged_at empty,
 * so turning notifications on later brings the reminder. Returns counts only.
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
    return NextResponse.json({ data: { due: due.length, notified, reports } });
  } catch (err) {
    logRouteError("cron/sightings-nudges", err);
    return internalServerError();
  }
}

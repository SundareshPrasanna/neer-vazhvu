/** Browser notifications: the checks and rules the push route and the nudge job share, kept free of server code so they test directly. */
import type { Notice } from "./notify";
import { OPEN_STATUSES, type CaseStatus } from "./status";

/** Browsers kept per reporter; saving one more drops the oldest. */
export const MAX_SUBSCRIPTIONS = 5;
/** An open report with no update for this long gets a reminder, and then not again for as long. */
export const NUDGE_DAYS = 14;

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Only the browsers' own push services, so the server never posts to an address a client made up.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

const text = (v: unknown, min: number, max: number) => typeof v === "string" && v.length >= min && v.length <= max;

/** A browser's PushSubscription JSON, checked against the table's limits; null if it is not one. */
export function parseSubscription(body: unknown): PushKeys | null {
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = b?.endpoint;
  const p256dh = b?.keys?.p256dh;
  const auth = b?.keys?.auth;
  if (!text(endpoint, 20, 1000) || !text(p256dh, 80, 200) || !text(auth, 16, 100)) return null;
  if (!B64URL.test(p256dh as string) || !B64URL.test(auth as string)) return null;
  let url: URL;
  try {
    url = new URL(endpoint as string);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !PUSH_HOSTS.some((h) => h.test(url.hostname))) return null;
  return { endpoint: endpoint as string, p256dh: p256dh as string, auth: auth as string };
}

export interface NudgeRow {
  id: string;
  reporter_key: string;
  review_status: string;
  case_status: CaseStatus | null;
  created_at: string;
  nudged_at: string | null;
}

/**
 * Published, still-open reports with no update and no reminder for NUDGE_DAYS, grouped by reporter.
 * `lastEvent` maps a report id to its latest event time; a report with none counts from when it was sent.
 */
export function dueByReporter(rows: NudgeRow[], lastEvent: ReadonlyMap<string, string>, now: Date): Map<string, string[]> {
  const cutoff = now.getTime() - NUDGE_DAYS * 86_400_000;
  const before = (iso: string) => new Date(iso).getTime() < cutoff;
  const due = new Map<string, string[]>();
  for (const r of rows) {
    if (r.review_status !== "approved" || !r.case_status || !OPEN_STATUSES.has(r.case_status) || r.reporter_key === "deleted") continue;
    if (!before(r.created_at) || !before(lastEvent.get(r.id) ?? r.created_at)) continue;
    if (r.nudged_at && !before(r.nudged_at)) continue;
    due.set(r.reporter_key, [...(due.get(r.reporter_key) ?? []), r.id]);
  }
  return due;
}

/** The two-week reminder: a count only, nothing about any report or place. */
export function nudgeNotice(n: number): Notice {
  return {
    title: "Check your reports",
    body:
      n === 1
        ? "You have one report with no update for two weeks. Is it still there, or fixed?"
        : `You have ${n} reports with no update for two weeks. Are they still there, or fixed?`,
    url: "/mitra",
  };
}

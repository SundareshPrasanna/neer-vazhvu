/**
 * Groups (colleges, schools, residents' associations, lake groups, NGOs) and their fix-it days (clean-ups):
 * the rules shared by the API, the UI and the daily reminders. Members stay anonymous: a group is a name, and
 * its members are tags. No `server-only` import, so the rules run under node:test; the one database loader
 * takes the client as an argument.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { listPublishedAtlasDistricts } from "@/lib/atlas/registry";
import { listEnabledPlaces } from "@/lib/cities";
import { CASE_LABELS, OPEN_STATUSES, type CaseStatus, type ReviewStatus } from "./status";
import { FIXIT_TYPES, REPORT_GROUPS, isCommunityReport } from "./taxonomy";

export const GROUP_KINDS = [
  { key: "college", label: "College" },
  { key: "school", label: "School" },
  { key: "residents", label: "Residents' association" },
  { key: "lake_group", label: "Lake group" },
  { key: "ngo", label: "NGO" },
  { key: "other", label: "Other group" },
] as const;

export type GroupKind = (typeof GROUP_KINDS)[number]["key"];
export type GroupStatus = "pending" | "approved" | "rejected";
export type GroupRole = "host" | "member";

export const isGroupKind = (v: unknown): v is GroupKind => GROUP_KINDS.some((k) => k.key === v);
export const kindLabel = (k: string) => GROUP_KINDS.find((x) => x.key === k)?.label ?? "Group";

export const GROUP_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  /** Groups one person may start, ever (rejected ones count). */
  createdPerPerson: 3,
  /** Groups one person may belong to at once. */
  joinedPerPerson: 10,
  meetMin: 3,
  meetMax: 160,
  noteMax: 280,
  /** A clean-up is planned at least this far ahead, so people can see it in time. */
  leadHours: 2,
  aheadDays: 60,
  /** Upcoming clean-ups one group may have planned at once. */
  plannedPerGroup: 10,
  /**
   * Reports one group may send in a rolling day, so one college drive cannot use up the site-wide allowance for new
   * accounts (LIMITS.newSiteDaily). Checked before sending, outside create_sighting's lock: parallel sends can pass it by a few.
   */
  reportsDaily: 100,
} as const;

export const GROUP_DAILY_MESSAGE = `Your group has sent ${GROUP_LIMITS.reportsDaily} reports in the last day, the most one group can send. Please send the rest tomorrow.`;

/** Clean-ups stay off until a partner organisation runs the first one: they are the one feature with physical risk. */
export const CLEANUPS_ON = process.env.NEXT_PUBLIC_CITIZEN_CLEANUPS === "on";

/** Reports sent with a group in the last day, leaving out `except`: the count GROUP_LIMITS.reportsDaily caps. */
export async function groupSentToday(admin: SupabaseClient, groupId: string, except?: string): Promise<number> {
  let q = admin.from("sightings").select("id", { count: "exact", head: true }).eq("group_id", groupId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (except) q = q.neq("id", except);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** How long a clean-up is taken to last; after this it is over (extras.ts stops showing it as next). */
export const FIXIT_HOURS = 3;
/** Hosts are asked for an "It's gone" photo once a clean-up has been over this long. */
export const AFTER_ASK_HOURS = 6;
/** The daily run reminds people of clean-ups starting within this many hours. */
export const REMIND_AHEAD_HOURS = 24;
/** Older clean-ups are never asked about, so a first run does not reach back for months. */
const AFTER_ASK_MAX_DAYS = 7;

export const SAFETY_LINE = "Bring gloves and a bag. Stay on the bank; do not enter the water. Leave sharp, medical or chemical waste for the authorities.";

/** The labels of the report types a clean-up may be planned for, in taxonomy order. */
export const FIXIT_LABELS: string[] = REPORT_GROUPS.flatMap((g) => g.types.filter((t) => FIXIT_TYPES.has(t.key)).map((t) => t.label));

/* Join codes: 12 characters from 32 that cannot be misread (no I, O, 0 or 1), shown as XXXX-XXXX-XXXX. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/** A join code from 12 random bytes (crypto.randomBytes on the server); 60 bits, too many to guess. */
export function newJoinCode(random: Uint8Array): string {
  if (random.length < 12) throw new Error("12 random bytes needed");
  const s = Array.from(random.subarray(0, 12), (b) => ALPHABET[b & 31]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** A typed or pasted code in its stored form (any case, spaces or dashes), or null when it cannot be one. */
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 40) return null;
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== 12 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export const joinPath = (code: string) => `/for-citizens?join=${code}`;

/** Spaces collapsed; null unless 3 to 80 characters with at least one letter. */
export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/\s+/g, " ");
  return s.length >= GROUP_LIMITS.nameMin && s.length <= GROUP_LIMITS.nameMax && /\p{L}/u.test(s) ? s : null;
}

/** A meeting point or note: spaces collapsed, within its limits; "" for an empty optional note. Null when invalid. */
export function cleanText(input: unknown, min: number, max: number): string | null {
  if (input == null) return min === 0 ? "" : null;
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/\s+/g, " ");
  return s.length >= min && s.length <= max ? s : null;
}

/* Who may plan a clean-up, and where. */

export type FixitTarget = { review_status: ReviewStatus; category: string; subcategory: string | null; case_status: CaseStatus | null };

/** A published community report of a safe type (litter, floating trash, plastic, ritual waste) that is still open. */
export function fixitAllowed(r: FixitTarget): boolean {
  return (
    r.review_status === "approved" &&
    isCommunityReport(r.category) &&
    !!r.subcategory &&
    FIXIT_TYPES.has(r.subcategory) &&
    !!r.case_status &&
    OPEN_STATUSES.has(r.case_status)
  );
}

/** Only a host of a reviewed group plans clean-ups; a waiting or rejected group cannot. */
export function canHost(m: { role: GroupRole; status: GroupStatus } | null | undefined): boolean {
  return m?.role === "host" && m.status === "approved";
}

export const canPlan = (m: { role: GroupRole; status: GroupStatus } | null | undefined, r: FixitTarget) => canHost(m) && fixitAllowed(r);

/** Why a start time cannot be used, or null: between 2 hours and 60 days from now. */
export function startsAtProblem(startsAt: Date, now: number): string | null {
  const t = startsAt.getTime();
  if (!Number.isFinite(t)) return "Choose a date and time.";
  if (t < now + GROUP_LIMITS.leadHours * 3_600_000) return `Choose a time at least ${GROUP_LIMITS.leadHours} hours from now.`;
  if (t > now + GROUP_LIMITS.aheadDays * 86_400_000) return `Choose a date within the next ${GROUP_LIMITS.aheadDays} days.`;
  return null;
}

/** A clean-up is over this long after it starts. */
export const isFixitOver = (startsAt: string, now: number) => Date.parse(startsAt) + FIXIT_HOURS * 3_600_000 <= now;

/* India time: clean-ups are planned and shown in IST whatever the device's own zone. */

const IST_MS = 5.5 * 3_600_000;

/** A date-time field's value ("2026-10-25T07:00"), read as India time, as an ISO instant; null when malformed. */
export function istInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - IST_MS;
  const back = new Date(utc + IST_MS);
  // Rejects 31 February and the like, which Date.UTC would roll over.
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(utc).toISOString();
}

/** An instant as a date-time field's value in India time, for its min and max. */
export function isoToIstInput(ms: number): string {
  return new Date(ms + IST_MS).toISOString().slice(0, 16);
}

const parts = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", ...opts }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));

/** "Saturday 25 October", in India time. */
export function fixitDay(iso: string): string {
  const p = parts(iso, { weekday: "long", day: "numeric", month: "long" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "7:00 am", in India time. */
export function fixitTime(iso: string): string {
  const p = parts(iso, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`.trim();
}

/** "Saturday 25 October, 7:00 am", in India time. */
export const fixitWhen = (iso: string) => `${fixitDay(iso)}, ${fixitTime(iso)}`;

/* The daily reminders. One column, reminded_at, marks both: set before the start for the reminder, after it for the ask. */

export type ReminderRow = { status: "planned" | "done" | "cancelled"; starts_at: string; reminded_at: string | null };

/** "before": remind those coming (and the hosts) of a clean-up within a day; "after": ask hosts for an "It's gone" photo. */
export function reminderDue(f: ReminderRow, now: number): "before" | "after" | null {
  const start = Date.parse(f.starts_at);
  const reminded = f.reminded_at ? Date.parse(f.reminded_at) : null;
  if (f.status === "planned" && start > now && start <= now + REMIND_AHEAD_HOURS * 3_600_000 && reminded == null) return "before";
  const askFrom = start + (FIXIT_HOURS + AFTER_ASK_HOURS) * 3_600_000;
  const asked = reminded != null && reminded >= start;
  if (f.status !== "cancelled" && now >= askFrom && now - askFrom <= AFTER_ASK_MAX_DAYS * 86_400_000 && !asked) return "after";
  return null;
}

/* Places a group can name: the cities and districts reports are placed in (src/lib/sightings/locate-server.ts). */

export function groupPlaces(): { id: string; name: string }[] {
  return [
    ...listEnabledPlaces().map((c) => ({ id: c.cityId as string, name: c.displayName })),
    ...listPublishedAtlasDistricts().map((d) => ({ id: d.scopeId, name: d.name })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export const placeNameOf = (id: string | null) => (id ? (groupPlaces().find((p) => p.id === id)?.name ?? null) : null);

/** A reviewed group as anyone sees it: its name and what it has done together. Never its members. */
export interface PublicGroup {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  placeName: string | null;
  /** Published reports sent with the group, how many of those are fixed, and clean-ups it held. */
  reports: number;
  fixed: number;
  cleanups: number;
}

const CHUNK = 150;

/** Every reviewed group with its counts, most active first. Used by GET /api/sightings/groups and the For citizens page. */
export async function loadPublicGroups(admin: SupabaseClient): Promise<PublicGroup[]> {
  const { data, error } = await admin.from("sighting_groups").select("id, name, kind, place_id").eq("status", "approved").limit(500);
  if (error) throw error;
  const groups = (data ?? []) as { id: string; name: string; kind: string; place_id: string | null }[];
  const ids = groups.map((g) => g.id);
  const reports: { group_id: string; case_status: string | null }[] = [];
  const cleanups: { group_id: string }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const [r, f] = await Promise.all([
      admin.from("sightings").select("group_id, case_status").in("group_id", part).eq("review_status", "approved").limit(10_000),
      admin.from("sighting_fixits").select("group_id").in("group_id", part).eq("status", "done").limit(10_000),
    ]);
    if (r.error) throw r.error;
    if (f.error) throw f.error;
    reports.push(...((r.data ?? []) as typeof reports));
    cleanups.push(...((f.data ?? []) as typeof cleanups));
  }
  const places = new Map(groupPlaces().map((p) => [p.id, p.name]));
  return groups
    .map((g) => {
      const mine = reports.filter((r) => r.group_id === g.id);
      return {
        id: g.id,
        name: g.name,
        kind: g.kind,
        kindLabel: kindLabel(g.kind),
        placeName: g.place_id ? (places.get(g.place_id) ?? null) : null,
        reports: mine.length,
        fixed: mine.filter((r) => r.case_status === "fixed").length,
        cleanups: cleanups.filter((c) => c.group_id === g.id).length,
      };
    })
    .sort((a, b) => b.reports + b.cleanups - (a.reports + a.cleanups) || a.name.localeCompare(b.name));
}

/* What the signed-in person sees of their own groups (GET /api/sightings/groups?scope=mine). */

/** After someone leaves: an empty group never reviewed goes; a group left without a host gets its longest-standing member. */
export async function settleGroup(admin: SupabaseClient, groupId: string): Promise<void> {
  const { data } = await admin.from("sighting_group_members").select("reporter_key, role, created_at").eq("group_id", groupId).order("created_at").limit(1000);
  const left = data ?? [];
  // A reviewed group stays even when empty, so its reports keep their name.
  if (left.length === 0) await admin.from("sighting_groups").delete().eq("id", groupId).eq("status", "pending");
  else if (!left.some((m) => m.role === "host")) await admin.from("sighting_group_members").update({ role: "host" }).eq("group_id", groupId).eq("reporter_key", left[0].reporter_key);
}

export interface MyGroup {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  placeName: string | null;
  status: GroupStatus;
  role: GroupRole;
  members: number;
  /** Hosts only: the invite link's path. */
  joinPath: string | null;
}

export interface MyGroups {
  groups: MyGroup[];
  /** Planned, not yet over clean-ups this person said they will come to. */
  going: string[];
  /** Planned, not yet over clean-ups of groups this person hosts. */
  hosting: string[];
  /** Cities and districts a new group can name. */
  places: { id: string; name: string }[];
}

/* Adding one's own report to a group afterwards (POST /api/sightings/[id]/group). */

export type TagTarget = { reporter_key: string; category: string; review_status: ReviewStatus };

/**
 * Why this person cannot set or clear the group of this report, or null. `group` is their place in the group to set
 * (null when they are not in it), or "clear". Home reports never carry a group: its name could point to who sent them.
 */
export function tagProblem(r: TagTarget, key: string, group: { status: GroupStatus } | null | "clear"): { status: number; error: string } | null {
  if (r.reporter_key !== key) return { status: 403, error: "Only the person who sent this report can change its group." };
  if (!isCommunityReport(r.category)) return { status: 409, error: "Only reports about a shared place can carry a group's name." };
  if (r.review_status === "rejected") return { status: 409, error: "This report was not published." };
  if (group !== "clear" && group?.status !== "approved") return { status: 403, error: "Choose an active group you belong to." };
  return null;
}

/* The evidence pack: what a group did together over a period, for its own records (NSS, NAAC, a letter). Counts, never who. */

export const PACK_LIMITS = { defaultMonths: 3, maxYears: 2 } as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A YYYY-MM-DD date's year, month and day, or null when it is not a real date. */
function ymd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? [y, mo, d] : null;
}

/** An instant's date in India, YYYY-MM-DD. */
export const istDate = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/** A date moved by days, months or years; a day the month lacks becomes its last (31 May less 3 months is 28 or 29 February). */
export function shiftDate(date: string, { days = 0, months = 0, years = 0 }: { days?: number; months?: number; years?: number }): string {
  const [y, m, d] = ymd(date)!;
  const total = (y + years) * 12 + m - 1 + months;
  const [ty, tm] = [Math.floor(total / 12), ((total % 12) + 12) % 12];
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, last)) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "18 October 2026". */
export function packDate(date: string): string {
  const [y, m, d] = ymd(date)!;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The academic year's start: the most recent 1 June, today included. */
export const academicYearStart = (today: string) => `${Number(today.slice(0, 4)) - (today.slice(5) >= "06-01" ? 0 : 1)}-06-01`;

export type PackPreset = "30d" | "3m" | "year" | "all";
export const PACK_PRESETS: { key: PackPreset; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "year", label: "Since 1 June" },
  { key: "all", label: "All time" },
];

/** A preset's dates, ending today. "All time" is the longest period a pack covers. */
export function presetPeriod(key: PackPreset, today: string): { from: string; to: string } {
  const from =
    key === "30d"
      ? shiftDate(today, { days: -29 })
      : key === "3m"
        ? shiftDate(today, { months: -PACK_LIMITS.defaultMonths })
        : key === "year"
          ? academicYearStart(today)
          : shiftDate(today, { years: -PACK_LIMITS.maxYears });
  return { from, to: today };
}

/** India dates, both included, and the instants that bound them (`end` excluded). */
export interface PackPeriod {
  from: string;
  to: string;
  start: string;
  end: string;
}

const istMidnight = (date: string) => {
  const [y, m, d] = ymd(date)!;
  return new Date(Date.UTC(y, m - 1, d) - IST_MS).toISOString();
};

/**
 * `from` and `to` as given (YYYY-MM-DD, India), either may be missing: `to` defaults to today and is never later; `from`
 * defaults to 3 months before `to`. At most 2 years.
 */
export function parsePackPeriod(from: string | null, to: string | null, now: number): { ok: true; value: PackPeriod } | { ok: false; error: string } {
  if ((from && !ymd(from)) || (to && !ymd(to))) return { ok: false, error: "Choose the dates again." };
  const today = istDate(now);
  const last = !to || to > today ? today : to;
  const first = from || shiftDate(last, { months: -PACK_LIMITS.defaultMonths });
  if (first > last) return { ok: false, error: "The start date is after the end date." };
  if (first < shiftDate(last, { years: -PACK_LIMITS.maxYears })) return { ok: false, error: `Choose a period of at most ${PACK_LIMITS.maxYears} years.` };
  return { ok: true, value: { from: first, to: last, start: istMidnight(first), end: istMidnight(shiftDate(last, { days: 1 })) } };
}

/** One report as the pack route loads it. `reporterKey` is used only to count members who sent one; it never leaves. */
export interface PackReportSource {
  reviewStatus: ReviewStatus;
  reporterKey: string;
  category: string;
  /** When it was published (reviewed_at). */
  publishedAt: string;
  type: string;
  caseStatus: CaseStatus | null;
  /** Water body and ward or panchayat, with the city, district or basin. */
  place: string;
  /** The most specific place key (follows.ts), for counting distinct places. */
  placeKey: string;
  href: string | null;
  photo: string | null;
  fixedPhoto: string | null;
  seen: number;
  thanks: number;
}

export interface PackCleanupSource {
  status: "planned" | "done" | "cancelled";
  startsAt: string;
  /** Tags of those who said they would come; counted only. */
  coming: string[];
  report: PackReportSource;
}

export interface PackReport {
  /** India date it was published. */
  date: string;
  type: string;
  place: string;
  caseStatus: CaseStatus | null;
  status: string;
  href: string | null;
  photo: string | null;
}

export interface PackCleanup {
  /** India date it was held. */
  date: string;
  place: string;
  type: string;
  coming: number;
  /** The report's status now. */
  caseStatus: CaseStatus | null;
  status: string;
  photo: string | null;
  fixedPhoto: string | null;
  href: string | null;
}

export interface GroupPack {
  group: { name: string; kindLabel: string; placeName: string | null };
  period: { from: string; to: string };
  prepared: string;
  totals: {
    reports: number;
    places: number;
    byStatus: { status: CaseStatus; label: string; count: number }[];
    byType: { label: string; count: number }[];
    /** Members who sent at least one of these reports. */
    senders: number;
    seen: number;
    thanks: number;
    cleanups: number;
    /** Different people who said they would come to those clean-ups. */
    coming: number;
    members: number;
  };
  cleanups: PackCleanup[];
  reports: PackReport[];
}

const STATUS_ORDER: CaseStatus[] = ["open", "reported", "authority_done", "fixed", "closed"];

/**
 * The pack from what the route loaded: only published community reports in the period, and clean-ups held (marked done)
 * in it at published reports. Counts only; no reporter tags, points, notes or times of day.
 */
export function shapePack(input: {
  group: GroupPack["group"];
  period: PackPeriod;
  now: number;
  members: number;
  reports: PackReportSource[];
  cleanups: PackCleanupSource[];
}): GroupPack {
  const [start, end] = [Date.parse(input.period.start), Date.parse(input.period.end)];
  const within = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) < end;
  const shown = (r: PackReportSource) => r.reviewStatus === "approved" && isCommunityReport(r.category);
  const at = (iso: string) => istDate(Date.parse(iso));
  const statusLabel = (s: CaseStatus | null) => (s ? CASE_LABELS[s] : "");
  const reports = input.reports.filter((r) => shown(r) && within(r.publishedAt)).sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const cleanups = input.cleanups
    .filter((c) => c.status === "done" && shown(c.report) && within(c.startsAt))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const types = new Map<string, number>();
  for (const r of reports) types.set(r.type, (types.get(r.type) ?? 0) + 1);
  const sum = (f: (r: PackReportSource) => number) => reports.reduce((n, r) => n + f(r), 0);
  return {
    group: input.group,
    period: { from: input.period.from, to: input.period.to },
    prepared: istDate(input.now),
    totals: {
      reports: reports.length,
      places: new Set(reports.map((r) => r.placeKey)).size,
      byStatus: STATUS_ORDER.map((status) => ({ status, label: CASE_LABELS[status], count: reports.filter((r) => r.caseStatus === status).length })),
      byType: [...types].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      senders: new Set(reports.map((r) => r.reporterKey).filter((k) => k !== "deleted")).size,
      seen: sum((r) => r.seen),
      thanks: sum((r) => r.thanks),
      cleanups: cleanups.length,
      coming: new Set(cleanups.flatMap((c) => c.coming)).size,
      members: input.members,
    },
    cleanups: cleanups.map((c) => ({
      date: at(c.startsAt),
      place: c.report.place,
      type: c.report.type,
      coming: new Set(c.coming).size,
      caseStatus: c.report.caseStatus,
      status: statusLabel(c.report.caseStatus),
      photo: c.report.photo,
      fixedPhoto: c.report.fixedPhoto,
      href: c.report.href,
    })),
    reports: reports.map((r) => ({
      date: at(r.publishedAt),
      type: r.type,
      place: r.place,
      caseStatus: r.caseStatus,
      status: statusLabel(r.caseStatus),
      href: r.href,
      photo: r.photo,
    })),
  };
}

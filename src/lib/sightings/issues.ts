/**
 * Issues at a place: published reports of one thing at one spot, counted together, so a place reads as a few standing
 * issues with dates and counts rather than a run of single complaints. Pure: the route passes in what it loaded. Exact
 * points and people's tags come in; only counts, India dates and the rounded point go out.
 */
import { CASE_LABELS, OPEN_STATUSES, type CaseStatus } from "./status";
import { OTHER_KEY, isCommunityReport } from "./taxonomy";
import type { EventRow, PublicIssue, PublicReport, SightingRow } from "./types";

/** A report of the same type this close (metres) to any report in an open issue joins it. */
export const ISSUE_RADIUS_M = 150;
/** Tap water and water tests count together over this many days. */
export const HOME_WINDOW_DAYS = 30;
/** A fixed or closed issue stays listed this many days. */
export const FIXED_LATELY_DAYS = 60;
/** Report cards an issue opens to, newest first. */
export const CARDS_PER_ISSUE = 10;

type IssueRow = Pick<
  SightingRow,
  "id" | "created_at" | "updated_at" | "reporter_key" | "place_id" | "ward_id" | "panchayat_code" | "water_body_id" | "category" | "subcategory" | "case_status" | "lat" | "lng"
>;

/** An event as loaded with `select("*")`: it carries the actor's tag, which EventRow leaves out. */
export type IssueEvent = Pick<EventRow, "event" | "created_at" | "actor_role"> & { actor_key?: string | null };

/** One published report as the grouping needs it. Server side only: the row has the exact point and the reporter's tag. */
export interface IssueSource {
  row: IssueRow;
  /** The report as served: label, place text, rounded point, page link, group and clean-up. */
  report: PublicReport;
  events: IssueEvent[];
  /** The first published photo of each kind, as a public URL. */
  reportPhoto: string | null;
  fixedPhoto: string | null;
}

/**
 * The spot an issue is kept under: the water body, else the panchayat, else the ward, else the place. The same key as
 * followTargets(row).at(-1) in follows.ts, which is server only. A home's report never keys on a water body.
 */
export function issuePlaceKey(p: Pick<IssueRow, "place_id" | "ward_id" | "panchayat_code" | "water_body_id">, home = false): string {
  if (p.water_body_id && !home) return `body:${p.water_body_id}`;
  if (p.panchayat_code) return `${p.place_id}:gp:${p.panchayat_code}`;
  if (p.ward_id) return `${p.place_id}:ward:${p.ward_id}`;
  return p.place_id;
}

function metres(a: IssueRow, b: IssueRow): number {
  const rad = Math.PI / 180;
  const [lat1, lat2] = [Number(a.lat) * rad, Number(b.lat) * rad];
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(((Number(b.lng) - Number(a.lng)) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** YYYY-MM-DD in India time. */
const istDate = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const at = (s: IssueSource) => Date.parse(s.row.created_at);
const byAge = (a: IssueSource, b: IssueSource) => at(a) - at(b);

const RESOLVED: ReadonlySet<CaseStatus> = new Set(["fixed", "closed"]);
const OPEN_RANK: Partial<Record<CaseStatus, number>> = { open: 0, reported: 1, authority_done: 2 };
const isOpen = (s: IssueSource) => !!s.row.case_status && OPEN_STATUSES.has(s.row.case_status);

/** When a fixed or closed report became so (its last fixed or closed event); null while it is not. */
function resolvedAt(s: IssueSource): number | null {
  if (!s.row.case_status || !RESOLVED.has(s.row.case_status)) return null;
  const times = s.events.filter((e) => e.event === "fixed" || e.event === "closed").map((e) => Date.parse(e.created_at));
  return times.length ? Math.max(...times) : Date.parse(s.row.updated_at);
}

/** Every report in it fixed or closed: when the last of them was. Null while any is open or has no status. */
function issueResolvedAt(members: IssueSource[]): number | null {
  const times = members.map(resolvedAt);
  return times.every((t) => t !== null) ? Math.max(...(times as number[])) : null;
}

/** Still open at time t: some report in it was not yet fixed or closed. */
const openAt = (members: IssueSource[], t: number) => members.some((m) => (resolvedAt(m) ?? Infinity) > t);

const near = (a: IssueSource[], b: IssueSource[]) => a.some((x) => b.some((y) => metres(x.row, y.row) <= ISSUE_RADIUS_M));

const SEEN = new Set(["still_there", "seen_too"]);

/**
 * People who reported it or said it is still there or seen it too, each once. A deleted account's tag is "deleted", so
 * each such report counts its own reporter, and a deleted neighbour counts by their "seen it too" (their "still there"
 * comes with it).
 */
function peopleOf(members: IssueSource[]): number {
  const keys = new Set<string>();
  for (const m of members) {
    keys.add(m.row.reporter_key === "deleted" ? `deleted:${m.row.id}` : m.row.reporter_key);
    m.events.forEach((e, i) => {
      if (!SEEN.has(e.event) || (e.actor_role !== "reporter" && e.actor_role !== "resident")) return;
      if (e.actor_key && e.actor_key !== "deleted") keys.add(e.actor_key);
      else if (e.actor_role === "resident" && e.event === "seen_too") keys.add(`deleted:${m.row.id}:${i}`);
    });
  }
  return keys.size;
}

function statusOf(members: IssueSource[]): CaseStatus | null {
  const open = members.filter(isOpen).map((m) => m.row.case_status!);
  if (open.length) return open.reduce((a, b) => ((OPEN_RANK[b] ?? 0) > (OPEN_RANK[a] ?? 0) ? b : a));
  if (!members.every((m) => m.row.case_status && RESOLVED.has(m.row.case_status))) return null;
  return members.some((m) => m.row.case_status === "fixed") ? "fixed" : "closed";
}

function toIssue(members: IssueSource[], home: boolean, earlierFixes: number, today: string): PublicIssue {
  const asc = [...members].sort(byAge);
  const [first, newest] = [asc[0], asc.at(-1)!];
  const status = statusOf(asc);
  const done = issueResolvedAt(asc);
  const seen = asc.flatMap((m) => [at(m), ...m.events.filter((e) => SEEN.has(e.event)).map((e) => Date.parse(e.created_at))]);
  const firstOn = istDate(at(first));
  const photo = (kind: "reportPhoto" | "fixedPhoto") => asc.findLast((m) => m[kind])?.[kind] ?? null;
  // A ward or panchayat by name; a home report keyed on the whole place is named by the place.
  const homeWhere = newest.row.ward_id || newest.row.panchayat_code ? newest.report.where : newest.report.placeName;
  return {
    id: first.row.id,
    category: first.row.category,
    subcategory: first.row.subcategory,
    label: first.report.label,
    where: home ? homeWhere : first.report.where,
    firstOn,
    lastSeenOn: istDate(Math.max(...seen)),
    daysOpen: status && OPEN_STATUSES.has(status) ? Math.max(0, daysBetween(firstOn, today)) : null,
    resolvedOn: done !== null ? istDate(done) : null,
    reports: asc.length,
    people: peopleOf(asc),
    status,
    photoUrl: home ? null : ((done !== null ? photo("fixedPhoto") : null) ?? photo("reportPhoto")),
    reportIds: asc.map((m) => m.row.id).reverse(),
    groups: [...new Set(asc.flatMap((m) => (m.report.groupName ? [m.report.groupName] : [])))],
    fixitPlanned: asc.some((m) => !!m.report.fixit),
    earlierFixes,
    point: home ? null : first.report.point,
    placeHref: first.report.placeHref,
  };
}

/**
 * The issues at a place, from its published reports.
 *
 * A report about a shared place with a status joins an earlier one's issue when it is the same type (an "other" report
 * never joins), under the same place key, within 150 m of any report already in it, and the issue was still open when
 * it was sent. Once every report in an issue is fixed or closed, a later report there starts a new one, which counts
 * the fixed issues before it at that spot and type. Good news and "other" have no status, so they are no issue.
 *
 * Tap water and water tests from the last 30 days count by ward or panchayat and type, in homes: no point, no photo.
 *
 * Open issues first, by people then the oldest first; then those fixed or closed in the last 60 days, the latest first.
 */
export function buildIssues(sources: IssueSource[], now = new Date()): PublicIssue[] {
  const today = istDate(now.getTime());
  const community = sources.filter((s) => s.row.case_status && isCommunityReport(s.row.category)).sort(byAge);
  const drafts: { key: string; members: IssueSource[] }[] = [];
  for (const s of community) {
    const key = `${issuePlaceKey(s.row)}|${s.row.category}|${s.row.subcategory}`;
    const into =
      s.row.category === OTHER_KEY ? undefined : drafts.find((d) => d.key === key && openAt(d.members, at(s)) && near(d.members, [s]));
    if (into) into.members.push(s);
    else drafts.push({ key, members: [s] });
  }
  const fixedAt = new Map(drafts.map((d) => [d, statusOf(d.members) === "fixed" ? issueResolvedAt(d.members) : null]));
  const issues = drafts.map((d) => {
    const start = at(d.members[0]);
    const earlier = drafts.filter((e) => e !== d && e.key === d.key && (fixedAt.get(e) ?? Infinity) <= start && near(e.members, d.members));
    return toIssue(d.members, false, earlier.length, today);
  });

  const since = now.getTime() - HOME_WINDOW_DAYS * 86_400_000;
  const homes = new Map<string, IssueSource[]>();
  for (const s of sources) {
    // A water test is a home's own measurement, not a problem; it stays under "More reports here".
    if (isCommunityReport(s.row.category) || s.row.subcategory === "water_test" || at(s) < since) continue;
    const key = `${issuePlaceKey(s.row, true)}|${s.row.category}|${s.row.subcategory}`;
    homes.set(key, [...(homes.get(key) ?? []), s]);
  }
  for (const members of homes.values()) issues.push(toIssue(members, true, 0, today));

  const open = issues.filter((i) => !i.resolvedOn).sort((a, b) => b.people - a.people || a.firstOn.localeCompare(b.firstOn) || a.id.localeCompare(b.id));
  const lately = issues
    .filter((i) => i.resolvedOn && daysBetween(i.resolvedOn, today) <= FIXED_LATELY_DAYS)
    .sort((a, b) => b.resolvedOn!.localeCompare(a.resolvedOn!) || a.id.localeCompare(b.id));
  return [...open, ...lately];
}

/** "1 person has reported it", "14 people have reported or seen it". */
export const peopleText = (n: number) => (n === 1 ? "1 person has reported it" : `${n} people have reported or seen it`);

/** "Open since today", "Open 1 day", "Open 47 days". */
export const openText = (days: number) => (days === 0 ? "Open since today" : `Open ${days} ${days === 1 ? "day" : "days"}`);

/** "5 homes in Ward 12 in the last 30 days". */
export const homesText = (n: number, where: string | null) =>
  `${n} ${n === 1 ? "home" : "homes"} ${where ? `in ${where}` : "here"} in the last ${HOME_WINDOW_DAYS} days`;

/**
 * The issue's plain line, dates written by `day`: "First reported 12 Mar 2026. Last seen 2 Oct 2026. 14 people have
 * reported or seen it. Open 47 days." A home issue: "5 homes in Ward 12 in the last 30 days."
 */
export function issueLine(i: PublicIssue, day: (ymd: string) => string): string {
  if (!isCommunityReport(i.category)) return `${homesText(i.people, i.where)}.`;
  const open = i.daysOpen !== null;
  const parts = [
    `First reported ${day(i.firstOn)}`,
    open && i.lastSeenOn !== i.firstOn && `Last seen ${day(i.lastSeenOn)}`,
    peopleText(i.people),
    // "Department says done" is the status beside it; a day count there would read as doubt.
    open && i.status !== "authority_done" && openText(i.daysOpen!),
  ];
  return `${parts.filter(Boolean).join(". ")}.`;
}

/** The status in words: "Not yet reported", "Reported", "Department says done", "Fixed 3 Oct 2026", "Closed 3 Oct 2026". */
export function issueStatusText(i: PublicIssue, day: (ymd: string) => string): string | null {
  if (!i.status) return null;
  return i.resolvedOn ? `${CASE_LABELS[i.status]} ${day(i.resolvedOn)}` : CASE_LABELS[i.status];
}

const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The quieter facts: "Fixed once before. Sent by Lake Friends. Clean-up planned." */
export function issueNotes(i: PublicIssue): string | null {
  const parts = [
    i.earlierFixes === 1 ? "Fixed once before" : i.earlierFixes > 1 && `Fixed ${i.earlierFixes} times before`,
    i.groups.length > 0 && `Sent by ${and(i.groups)}`,
    i.fixitPlanned && "Clean-up planned",
  ].filter(Boolean);
  return parts.length ? `${parts.join(". ")}.` : null;
}

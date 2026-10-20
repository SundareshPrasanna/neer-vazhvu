/**
 * Sharing an issue: the words and links a share carries, for the Share action on a place page and for the
 * /mitra/i/<id> page that carries the link preview. Pure and safe in the browser: counts, India dates and place names
 * only, never who.
 */
import { buildIssues, issueStatusText, openText, peopleText, type IssueSource } from "./issues";
import { isCommunityReport } from "./taxonomy";
import type { PublicIssue } from "./types";

type Day = (ymd: string) => string;

/** Issue ids are report ids. */
export const isIssueId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);

/** The link people share: a page that carries the preview and sends visitors on to the place. */
export const sharePath = (id: string) => `/mitra/i/${id}`;

/** The place page with this issue opened. */
export const issueHref = (placeHref: string, id: string) => `${placeHref}${placeHref.includes("?") ? "&" : "?"}issue=${encodeURIComponent(id)}`;

/** The issue a place page opens with, from its query string; null when absent or not an id. */
export function focusedIssue(search: string): string | null {
  const id = new URLSearchParams(search).get("issue");
  return isIssueId(id) ? id : null;
}

/** When each fixed or closed report became so, as issues.ts dates it (its last fixed or closed event): an issue ends at one of these. */
function endTimes(sources: IssueSource[]): number[] {
  const ends = sources.flatMap((s) => {
    if (s.row.case_status !== "fixed" && s.row.case_status !== "closed") return [];
    const at = s.events.filter((e) => e.event === "fixed" || e.event === "closed").map((e) => Date.parse(e.created_at));
    return [at.length ? Math.max(...at) : Date.parse(s.row.updated_at)];
  });
  return [...new Set(ends)].sort((a, b) => b - a);
}

/**
 * The issue holding this report, as its place page builds it. One fixed or closed over 60 days ago is no longer listed
 * there, but a link shared back then still opens with its counts: it is rebuilt as of the day it ended.
 */
export function findIssue(sources: IssueSource[], id: string, now = new Date()): PublicIssue | undefined {
  const find = (at: Date) => buildIssues(sources, at).find((i) => i.reportIds.includes(id));
  const found = find(now);
  if (found) return found;
  for (const t of endTimes(sources)) {
    const then = find(new Date(t));
    if (then) return then;
  }
}

/** Community issues with a page to send people to. A home's report is never shared with its point or photo. */
export const isShareable = (i: Pick<PublicIssue, "category" | "placeHref">) => isCommunityReport(i.category) && !!i.placeHref;

/** The place in full for the preview image: "Ambattur Lake, Ward 82, Chennai". */
export function placeLine(where: string | null, placeName: string | null): string | null {
  if (!where) return placeName;
  return placeName && !where.split(", ").includes(placeName) ? `${where}, ${placeName}` : where;
}

/**
 * "Garbage on the bank or in the water at Ambattur Lake": the water body alone; else the ward, panchayat or locality
 * with its city, district or basin ("at Ward 12, Chennai"); else the place.
 */
export function shareTitle(i: Pick<PublicIssue, "label" | "where">, placeName: string | null): string {
  const parts = i.where?.split(", ").filter(Boolean) ?? [];
  const spot = parts.length > 1 ? parts[0] : placeLine(parts[0] ?? null, placeName);
  return spot ? `${i.label} at ${spot}` : i.label;
}

const isOpen = (i: PublicIssue) => i.daysOpen !== null && !i.resolvedOn;

/** "Open 47 days" while open, "Department says done" once the department says so, "Fixed 3 Oct 2026" once it is. */
function statusLine(i: PublicIssue, day: Day): string | null {
  if (isOpen(i) && i.status !== "authority_done") return openText(i.daysOpen!);
  return issueStatusText(i, day);
}

/** "14 people have reported or seen it. Open 47 days." */
export function countsLine(i: PublicIssue, day: Day): string {
  return [peopleText(i.people), statusLine(i, day)].filter(Boolean).join(". ") + ".";
}

/** The preview's description: "14 people have reported or seen it. Open 47 days. On Neer Vazhvu." */
export const shareDescription = (i: PublicIssue, day: Day) => `${countsLine(i, day)} On Neer Vazhvu.`;

/** What the preview image and the share invite people to do: add to an open issue, or see a resolved one. */
export const shareAsk = (i: PublicIssue) => (isOpen(i) ? "Seen it too? Add to it on Neer Vazhvu." : "See the record on Neer Vazhvu.");

/**
 * The message sent with the link: "Garbage on the bank or in the water at Ambattur Lake: 14 people have reported or
 * seen it. Seen it too? Add to it on Neer Vazhvu."
 */
export function shareText(i: PublicIssue, placeName: string | null, day: Day): string {
  const status = isOpen(i) ? null : statusLine(i, day);
  return `${shareTitle(i, placeName)}: ${[peopleText(i.people), status].filter(Boolean).join(". ")}. ${shareAsk(i)}`;
}

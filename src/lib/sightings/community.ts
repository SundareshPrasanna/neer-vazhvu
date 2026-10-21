/**
 * Pure rules behind the community actions on a published report: which nod it takes now, which follow keys are well
 * formed, when a reporter hears that others have seen it, and the words for the counts. No names, likes or ranks.
 */
import { OPEN_STATUSES, type CaseStatus, type NodEvent } from "./status";
import { isCommunityReport } from "./taxonomy";

/** "I've seen it too" while a community report is open, "Thank you" once it is fixed; nothing on a home's report or other statuses. */
export function nodFor(r: { caseStatus: CaseStatus | null; category: string }): NodEvent | null {
  if (!r.caseStatus || !isCommunityReport(r.category)) return null;
  if (OPEN_STATUSES.has(r.caseStatus)) return "seen_too";
  return r.caseStatus === "fixed" ? "thanks" : null;
}

/** Places one person may follow. */
export const MAX_FOLLOWS = 50;
/** The table's CHECK says the same (migration 064). */
export const MAX_FOLLOW_CHARS = 120;

const PLACE = "[a-z0-9-]{2,40}";
/** Ward numbers, panchayat codes and water-body ids as the source data has them: printable ASCII, no edge spaces (some tank ids carry spaces). */
const ID = "[\\x21-\\x7e](?:[\\x20-\\x7e]{0,78}[\\x21-\\x7e])?";
const FOLLOW = new RegExp(`^(?:${PLACE}(?::(?:ward|gp):${ID})?|body:${ID})$`);

/** A place key as followTargets (follows.ts) builds it: `place`, `place:ward:N`, `place:gp:CODE` or `body:ID`. */
export function isFollowTarget(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_FOLLOW_CHARS && FOLLOW.test(v);
}

export type FollowKey = { kind: "place"; place: string } | { kind: "ward" | "gp"; place: string; id: string } | { kind: "body"; id: string };

export function parseFollowTarget(v: string): FollowKey | null {
  if (!isFollowTarget(v)) return null;
  if (v.startsWith("body:")) return { kind: "body", id: v.slice(5) };
  const m = /^([a-z0-9-]{2,40}):(ward|gp):(.+)$/.exec(v);
  return m ? { kind: m[2] as "ward" | "gp", place: m[1], id: m[3] } : { kind: "place", place: v };
}

/** A reporter hears when this many people have seen their report too, not on every tap. */
export const SEEN_MILESTONES: readonly number[] = [1, 3, 10, 25];

/** The notice for a reporter once `count` people have seen their report too; null between milestones. */
export function seenNotice(count: number): { title: string; body: string } | null {
  if (!SEEN_MILESTONES.includes(count)) return null;
  return count === 1
    ? { title: "Someone has seen your report too", body: "Someone nearby has seen your report too." }
    : { title: "Others have seen your report too", body: `${count} people nearby have seen your report too.` };
}

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
export const seenText = (n: number) => `Seen by ${people(n)}`;
export const thanksText = (n: number) => `Thanked by ${people(n)}`;

/** The reporter's own summary across their reports; null until anyone has nodded. */
export function impactLine(seen: number, thanks: number): string | null {
  const times = thanks === 1 ? "once" : `${thanks} times`;
  if (seen > 0 && thanks > 0) return `Your reports were seen by ${people(seen)} nearby and thanked ${times}.`;
  if (seen > 0) return `Your reports were seen by ${people(seen)} nearby.`;
  return thanks > 0 ? `Your reports were thanked ${times}.` : null;
}

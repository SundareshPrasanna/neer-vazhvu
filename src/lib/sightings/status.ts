/** A report's public life after approval, and who may move it. */

export type ReviewStatus = "received" | "needs_info" | "approved" | "rejected";
export type CaseStatus = "open" | "reported" | "authority_done" | "fixed" | "closed";
export type CaseEvent = "reported" | "authority_done" | "fixed" | "still_there" | "closed" | "reopened";

export const CASE_EVENTS: readonly CaseEvent[] = ["reported", "authority_done", "fixed", "still_there", "closed", "reopened"];

/** event -> (current status -> next status). Absent = not allowed from there. */
const NEXT: Record<CaseEvent, Partial<Record<CaseStatus, CaseStatus>>> = {
  reported: { open: "reported", reported: "reported" },
  authority_done: { open: "authority_done", reported: "authority_done" },
  fixed: { open: "fixed", reported: "fixed", authority_done: "fixed" },
  still_there: { open: "open", reported: "reported", authority_done: "reported" },
  closed: { open: "closed", reported: "closed", authority_done: "closed", fixed: "closed" },
  reopened: { fixed: "open", closed: "open" },
};

export const REVIEWER_ONLY: ReadonlySet<CaseEvent> = new Set(["closed", "reopened"]);

export function nextCaseStatus(event: CaseEvent, current: CaseStatus | null): CaseStatus | null {
  return current ? (NEXT[event][current] ?? null) : null;
}

export const CASE_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  reported: "Reported",
  authority_done: "Marked done by the body",
  fixed: "Fixed",
  closed: "Closed",
};

export const EVENT_LABELS: Record<string, string> = {
  submitted: "Report sent",
  approved: "Published",
  rejected: "Not published",
  reclassified: "Type corrected",
  reported: "Reported to the body",
  authority_done: "Body marked it done",
  fixed: "Confirmed fixed with a photo",
  still_there: "Checked: still there",
  closed: "Closed",
  reopened: "Reopened",
};

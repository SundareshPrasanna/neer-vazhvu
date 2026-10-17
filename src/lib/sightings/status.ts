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

/** Who wrote an event. Residents are signed-in people other than the reporter; departments act through their signed link. */
export type ActorRole = "reporter" | "reviewer" | "system" | "resident" | "department";

/** Events that record something without moving the status. */
export type RecordEvent = "fix_submitted" | "fix_rejected" | "not_ours";

/** What a department can say about one of its items, and where each moves the status. */
export type DepartmentEvent = "action_taken" | "not_ours" | "closed";
const DEPARTMENT_NEXT: Record<DepartmentEvent, Partial<Record<CaseStatus, CaseStatus>>> = {
  action_taken: { open: "authority_done", reported: "authority_done", authority_done: "authority_done" },
  not_ours: {},
  closed: { open: "closed", reported: "closed", authority_done: "closed" },
};
export const DEPARTMENT_EVENTS: readonly DepartmentEvent[] = ["action_taken", "not_ours", "closed"];
/** The status a department's event leads to; null when it records without moving it, or does not fit. */
export function departmentNext(event: DepartmentEvent, current: CaseStatus | null): CaseStatus | null {
  return current ? (DEPARTMENT_NEXT[event][current] ?? null) : null;
}

/** Statuses on which anyone nearby may say "still there" or send a fixed photo. */
export const OPEN_STATUSES: ReadonlySet<CaseStatus> = new Set(["open", "reported", "authority_done"]);

export function nextCaseStatus(event: CaseEvent, current: CaseStatus | null): CaseStatus | null {
  return current ? (NEXT[event][current] ?? null) : null;
}

/** Public wording names no body: the reporter records these, and a body's name beside "not yet reported" would read as blame. */
export const CASE_LABELS: Record<CaseStatus, string> = {
  open: "Not yet reported",
  reported: "Reported",
  authority_done: "Department says done",
  fixed: "Fixed",
  closed: "Closed",
};

export const EVENT_LABELS: Record<string, string> = {
  submitted: "Report sent",
  fix_submitted: "Fixed photo sent for checking",
  fix_rejected: "Fixed photo not accepted",
  action_taken: "Action taken",
  not_ours: "Not theirs to handle",
  approved: "Published",
  rejected: "Not published",
  reclassified: "Type corrected",
  reported: "Reported to the department",
  authority_done: "Department said done",
  fixed: "Fixed, confirmed with a checked photo",
  still_there: "Checked: still there",
  closed: "Closed",
  reopened: "Reopened",
};

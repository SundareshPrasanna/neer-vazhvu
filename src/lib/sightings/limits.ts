/** Abuse caps. Enforced atomically by create_sighting (migration 062). */
export const LIMITS = {
  /** Reports per rolling day, before and after a reporter's first approval. */
  dailyNew: 5,
  dailyTrusted: 20,
  /** Reports waiting for review per reporter. */
  pendingNew: 10,
  pendingTrusted: 30,
  /** Site-wide reports per rolling day; above it intake pauses for everyone. */
  siteDaily: 500,
  photosPerReport: 3,
  /** Status updates per report per reporter per rolling day. */
  updatesPerReportDaily: 5,
  /** Per photo as uploaded; the browser resizes to ~0.5 MB first. 3 x 1.4 MB
   *  stays under Vercel's 4.5 MB request body limit. */
  photoBytes: 1.4 * 1024 * 1024,
  noteChars: 280,
} as const;

export type CapReason = "suspended" | "site_paused" | "daily_cap" | "pending_cap";

export const CAP_MESSAGES: Record<CapReason, string> = {
  suspended: "This account can no longer send reports.",
  site_paused: "Reporting is paused for today. Please try again tomorrow.",
  daily_cap: "You have reached today's limit. Please try again tomorrow.",
  pending_cap: "You have several reports waiting for review. Please wait until they are reviewed.",
};

/** Abuse caps. Enforced atomically by create_request (migration 072). */
export const LIMITS = {
  /** Requests per account per rolling day. */
  daily: 3,
  /** Requests per account not yet done or declined. */
  open: 10,
  /** All requests per rolling day, site-wide: the backstop. */
  siteDaily: 500,
  subjectChars: 120,
  nameChars: 120,
  messageChars: 1000,
} as const;

export type CapReason = "suspended" | "site_paused" | "duplicate" | "daily_cap" | "open_cap";

export const CAP_MESSAGES: Record<CapReason, string> = {
  suspended: "This account can no longer send requests.",
  site_paused: "Requests are paused for today. Please try again tomorrow.",
  duplicate: "You have already asked for this. We have it.",
  daily_cap: "You have reached today's limit. Please try again tomorrow.",
  open_cap: "You have several requests open. Please wait until some are answered.",
};

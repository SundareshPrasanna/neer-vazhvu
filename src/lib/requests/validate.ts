/** Hand-written body parsing (the repo's no-zod convention). */
import { LIMITS } from "./limits";

export const REQUEST_KINDS = ["city", "district", "data", "feature"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ["new", "triaged", "planned", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

export interface RequestInput {
  kind: RequestKind;
  subject: string;
  name: string;
  message: string | null;
  /** The account's own email is stored only when this is true. */
  contactOk: boolean;
  sourcePath: string | null;
}

export function parseRequest(body: unknown): Parsed<RequestInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind as RequestKind;
  if (!REQUEST_KINDS.includes(kind)) return { ok: false, error: "Choose what you are asking for." };
  const subject = str(b.subject, LIMITS.subjectChars);
  if (!subject || subject.length < 2) return { ok: false, error: "Name the place or the thing you need." };
  const name = str(b.name, LIMITS.nameChars);
  if (!name) return { ok: false, error: "Add your name." };
  // A message keeps its line breaks; only its ends are trimmed.
  const message = typeof b.message === "string" && b.message.trim() ? b.message.trim().slice(0, LIMITS.messageChars) : null;
  const path = typeof b.sourcePath === "string" && /^\/[^\s]{0,199}$/.test(b.sourcePath) ? b.sourcePath : null;
  return { ok: true, value: { kind, subject, name, message, contactOk: b.contactOk === true, sourcePath: path } };
}


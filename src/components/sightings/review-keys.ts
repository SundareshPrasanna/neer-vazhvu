/** The review queue's keys: one letter each, never while typing in a field. Pure, so the map is tested. */

export type ReviewCommand = "next" | "previous" | "approve" | "reject" | "publish" | "discard" | "same" | "cancel";

/** In the order the "Keys" line lists them. */
export const REVIEW_KEYS: readonly { key: string; command: ReviewCommand; label: string }[] = [
  { key: "J", command: "next", label: "next" },
  { key: "K", command: "previous", label: "previous" },
  { key: "A", command: "approve", label: "approve" },
  { key: "R", command: "reject", label: "reject" },
  { key: "P", command: "publish", label: "publish photo" },
  { key: "D", command: "discard", label: "discard photo" },
  { key: "M", command: "same", label: "same as an existing report" },
];

const BY_KEY = new Map(REVIEW_KEYS.map((k) => [k.key, k.command]));
const FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | EventTarget | null;
}

/** A text field, list or editable area has the keys. */
export function isTyping(target: KeyLike["target"]): boolean {
  const t = target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  return !!t && (FIELDS.has((t.tagName ?? "").toUpperCase()) || t.isContentEditable === true);
}

/** The command a key press means, or null. Escape cancels an open confirmation even from a field. */
export function reviewCommand(e: KeyLike): ReviewCommand | null {
  if (e.key === "Escape") return "cancel";
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return null;
  return BY_KEY.get(e.key.toUpperCase()) ?? null;
}

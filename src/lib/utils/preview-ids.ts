/** Ids listed in a NEXT_PUBLIC_PREVIEW_* variable (comma separated, trimmed). Callers pass
 *  process.env.X literally so Next inlines it, and lower-case it first when their gate ignores case. */
export function previewIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

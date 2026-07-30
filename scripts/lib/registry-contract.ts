/**
 * Shared contract constants for the Headwaters source registry.
 *
 * #220 review: two new registry entries shipped `type` values ("repo",
 * "pdf-feed") outside the SourceEntry union, and the runtime validation only
 * checked non-emptiness - the TS contract was bypassable from JSON. The
 * allowed set lives here so check-upstream-editions.ts (runtime validation,
 * `npm run data:check`) and the regression test pin the SAME list.
 *
 * Keep this union minimal: describe the FETCH SHAPE, not the upstream's
 * sociology - a GitHub repo folder is a "page", a single live PDF endpoint is
 * a "file"; whether it versions is detection.method's job.
 */
export const SOURCE_TYPES = ["pdf-listing", "page", "api", "file"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Return a validation problem string for an invalid type, else null. */
export function sourceTypeProblem(id: string, type: unknown): string | null {
  if (typeof type === "string" && (SOURCE_TYPES as readonly string[]).includes(type)) {
    return null;
  }
  return (
    `source ${id}: type ${JSON.stringify(type)} is not one of ` +
    `${SOURCE_TYPES.join(" | ")} (scripts/lib/registry-contract.ts)`
  );
}

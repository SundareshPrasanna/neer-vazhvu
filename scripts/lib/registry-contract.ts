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
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

/* ── Registered licences ──────────────────────────────────────────────────
 *
 * The TypeScript half of scripts/registry_license.py. Envelope generators used
 * to hardcode a licence literal beside each registry id; the copies drifted,
 * and PR #227 found 32 ids whose envelopes disagreed with the registry while
 * DATA-LICENSE.md pointed readers at the envelope as the authoritative record.
 *
 * Contract, enforced by scripts/validate_nvdm.py: a provenance source with an
 * `id` takes its licence from the registry (mirrored into the envelope so an
 * artifact still reads standalone); a source with no id owns its inline string.
 */

let licenceCache: Map<string, string> | null = null;

function loadRegistryLicenses(): Map<string, string> {
  if (licenceCache) return licenceCache;
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../source-registry");
  const map = new Map<string, string>();
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf-8")) as {
      sources?: { id?: string; license?: string }[];
    };
    for (const s of doc.sources ?? []) {
      if (s.id && typeof s.license === "string") map.set(s.id, s.license);
    }
  }
  licenceCache = map;
  return map;
}

/** The registered licence for `sourceId`. Throws if unregistered. */
export function registryLicense(sourceId: string): string {
  const lic = loadRegistryLicenses().get(sourceId);
  if (lic === undefined) {
    throw new Error(
      `source id "${sourceId}" is not in scripts/source-registry/, or has no ` +
        `licence recorded - register it before writing an envelope that cites it`,
    );
  }
  return lic;
}

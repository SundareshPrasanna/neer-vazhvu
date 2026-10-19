/**
 * The central exemption register.
 *
 * A platform whose selling point is that gaps are first-class has to be able to
 * answer "what are we NOT showing, and why?" in one place. Before this module
 * that answer was spread across four unrelated files plus a per-city markdown
 * scorecard, in four different shapes, and nothing checked that a deliberate
 * omission had a reason recorded at all.
 *
 * Two things live here:
 *
 *  1. FRESHNESS_EXEMPTIONS is OWNED here. check-data-freshness.ts imports it
 *     rather than declaring its own, so the one register that actually
 *     suppresses a CI failure cannot be edited without touching this file.
 *
 *  2. collectExemptions() gathers the registers that are better off owned by
 *     the code they govern - route availability, per-city gap notes, the
 *     Headwaters coverage allowlist - into one typed list, which
 *     scripts/build-exemptions-register.ts renders to
 *     docs/architecture/exemptions.md.
 *
 * The distinction matters: an exemption that SUPPRESSES A CHECK is moved here,
 * because that is the dangerous kind. An exemption that is simply a declared
 * absence stays where it is read from and is REPORTED here, because moving it
 * away from its consumer would make the code worse to read.
 */

import { listAllPlaces } from "../../src/lib/cities";
import { FEATURE_AVAILABILITY } from "../../src/lib/cities/routing";
import { UNWATCHED } from "./headwaters-coverage";
import { UNRECORDED } from "../../src/content/routes-off";
import { ROUTES_OFF_BY_CITY } from "../../src/cities/generated/routes-off";
import type { RouteKey } from "../../src/lib/cities/ids";

export { UNRECORDED };

/* ── 1. Owned: exemptions that suppress a check ─────────────────────────── */

/**
 * Cities allowed to skip a derived freshness check, with the reason on record.
 * Key is "<cityId>:<feedId>".
 *
 * EMPTY IS THE CORRECT STEADY STATE. Add an entry only when a feed genuinely
 * cannot exist for that city, and write the removal condition into the reason
 * so a future reader knows what would retire it.
 *
 * Kolkata's `kolkata:rainfall-recent` exemption was REMOVED 2026-07-26 when the
 * IMD gridded backbone landed (56 years, 1970-2025, long-term mean 1,659.3 mm)
 * and the provisional Open-Meteo fill started running. It was always marked
 * temporary with a removal condition; that condition was met. It is recorded
 * here rather than deleted silently because "an exemption we retired" is the
 * evidence that the removal conditions are real.
 *
 * Gurugram's `gurugram:rainfall-recent` exemption was REMOVED 2026-08-20 on the
 * same terms, and it was the last entry in this map - which is now EMPTY, the
 * steady state this comment asks for. Its removal condition named three things:
 * generate the IMD base, add the city to CITIES in fetch_recent_rainfall.py,
 * and delete the entry in the same change. All three are in that change.
 * The base is 56 years at grid point (28.50, 77.00), long-term mean 715.0 mm.
 * Read generate_imd_rainfall.py's CITY_DEFAULTS note before trusting that
 * number to a decimal: the cell is a local maximum, its neighbours return
 * 512.5 and 534.9 mm, and unlike Pune there is no published IMD observatory
 * normal for Gurgaon to validate it against.
 */
export const FRESHNESS_EXEMPTIONS: Record<string, string> = {};

/* ── 2. Reported: declared absences owned by their consumers ────────────── */

export type ExemptionKind =
  | "freshness-check"
  | "unwatched-artifact"
  | "route-off"
  | "declared-absence";


export interface Exemption {
  kind: ExemptionKind;
  /** cityId, or "platform" for a non-city-scoped entry. */
  scope: string;
  /** What is exempted or absent. */
  subject: string;
  /** Why. Never empty - an exemption without a reason is the thing this
   *  register exists to make impossible. */
  reason: string;
}

/** Every route any city ships, so a city's omissions can be derived rather
 *  than hand-listed. "" is the dashboard and is never an omission. */
function allRoutes(): string[] {
  const set = new Set<string>();
  for (const routes of Object.values(FEATURE_AVAILABILITY)) {
    for (const r of routes) if (r) set.add(r);
  }
  return [...set].sort();
}

/** Assemble the whole register. */
export function collectExemptions(): Exemption[] {
  const out: Exemption[] = [];

  for (const [key, reason] of Object.entries(FRESHNESS_EXEMPTIONS)) {
    const [scope, feed] = key.split(":");
    out.push({ kind: "freshness-check", scope, subject: feed, reason });
  }

  for (const [path, reason] of Object.entries(UNWATCHED)) {
    out.push({
      kind: "unwatched-artifact",
      scope: cityFromPath(path),
      subject: path,
      reason,
    });
  }

  const routes = allRoutes();
  for (const place of listAllPlaces()) {
    const has = new Set<string>(place.routes);
    for (const route of routes) {
      if (has.has(route)) continue;
      out.push({
        kind: "route-off",
        scope: place.cityId,
        subject: route,
        reason: ROUTES_OFF_BY_CITY[place.cityId]?.[route as RouteKey] ?? "",
      });
    }

    // Declared absences the UI itself renders.
    if (place.catchmentsGapNote) {
      out.push({
        kind: "declared-absence",
        scope: place.cityId,
        subject: "water-bodies catchment atlas",
        reason: place.catchmentsGapNote,
      });
    }
    if (place.reservoirHistoryAbsentNote) {
      out.push({
        kind: "declared-absence",
        scope: place.cityId,
        subject: "storage history chart",
        reason: place.reservoirHistoryAbsentNote,
      });
    }
    for (const lang of place.upcomingLanguages ?? []) {
      out.push({
        kind: "declared-absence",
        scope: place.cityId,
        subject: `UI language: ${lang}`,
        reason:
          `Advertised as coming soon and rendered as a disabled chip. The ${lang} dictionary is ` +
          `not populated, and must be translated by a native speaker rather than machine-generated, ` +
          `so the UI falls back to English by contract until it is.`,
      });
    }
    for (const src of place.waterSources ?? []) {
      if (src.hasPublicFeed === false && src.noFeedNote) {
        out.push({
          kind: "declared-absence",
          scope: place.cityId,
          subject: `water source: ${src.displayName}`,
          reason: src.noFeedNote,
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.scope.localeCompare(b.scope) ||
      a.subject.localeCompare(b.subject),
  );
}

/** Best-effort city attribution for an artifact path, for grouping only. */
function cityFromPath(path: string): string {
  const known = listAllPlaces().map((p) => p.cityId);
  const hit = known.find((c) => path.includes(c));
  return hit ?? "platform";
}

/** Entries with no reason at all. The register check FAILS on these. */
export function unexplained(list: Exemption[]): Exemption[] {
  return list.filter((e) => !e.reason.trim());
}

/**
 * Entries whose rationale was never recorded, marked honestly rather than
 * back-filled with a guess. Reported prominently, but does not fail the build:
 * these are pre-existing decisions, and blocking CI on archaeology would just
 * push someone to write filler.
 */
export function unrecorded(list: Exemption[]): Exemption[] {
  return list.filter((e) => e.reason.trim().startsWith(UNRECORDED));
}

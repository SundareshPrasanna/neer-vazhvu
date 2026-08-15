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
 */
export const FRESHNESS_EXEMPTIONS: Record<string, string> = {
  // TEMPORARY, and the same exemption Kolkata carried for the same reason
  // (see the note above, which records its retirement). rainfall-recent is a
  // PROVISIONAL fill layered on top of an IMD authoritative base, so it cannot
  // exist before imd-rainfall-monthly-gurugram.json does, and generating that
  // base is a multi-decade gridded download that belongs in its own change
  // rather than bolted onto the city scaffold.
  //
  // Gurugram is deliberately absent from CITIES in fetch_recent_rainfall.py
  // meanwhile: the daily workflow runs `--all`, which exits non-zero if any
  // one city fails, so adding the grid point early would turn the whole job
  // red every day for every city.
  //
  // REMOVAL CONDITION: run generate_imd_rainfall.py for the Gurugram grid
  // point (28.4360, 77.0560), add "gurugram" to CITIES in
  // fetch_recent_rainfall.py, and delete this entry in the same change.
  "gurugram:rainfall-recent":
    "No IMD gridded base series exists for Gurugram yet, and rainfall-recent is the provisional fill on top of one. Retire this by generating imd-rainfall-monthly-gurugram.json and wiring the city into fetch_recent_rainfall.py.",
};

/* ── 2. Reported: declared absences owned by their consumers ────────────── */

export type ExemptionKind =
  | "freshness-check"
  | "unwatched-artifact"
  | "route-off"
  | "declared-absence";

/**
 * Prefix for an omission that is real and deliberate but whose ORIGINAL
 * rationale was never written down.
 *
 * This exists so the register cannot be silenced with filler. The check below
 * fails on an EMPTY reason, and the obvious way to make that failure go away is
 * to invent a plausible-sounding justification for a decision someone else made
 * years ago - which would be worse than the empty string, because it reads as
 * authoritative. Marking it instead keeps the gap visible, counts it separately
 * in the generated register, and says what would resolve it.
 *
 * An entry marked this way is a TODO with a name on it, not a resolved item.
 */
export const UNRECORDED = "UNRECORDED:";

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

/**
 * Why each city omits each route. Derived omissions are only honest if the
 * reason is recorded; a route missing from FEATURE_AVAILABILITY with no entry
 * here is reported as UNEXPLAINED and fails the register check, which is the
 * point - it is how a silently dropped page gets caught.
 *
 * Keyed "<cityId>:<route>". Cities predating this register carry a shared
 * "not built for this city" reason where the omission is simply unbuilt rather
 * than deliberate; those are honest too, just less interesting.
 */
const ROUTE_OFF_REASONS: Record<string, string> = {
  // Kolkata - every omission is a decision, and each has a reason on the page.
  "kolkata:my-ward":
    "Ward-keyed surfaces are off until KMC wards 142-144 exist as geometry. 141 of 144 are mapped; the missing three are 18.93 km2, 9.2% of the city. KMC publishes no ward geometry through either its own portal or the newer DIGIT one, and OSM has no Kolkata ward relations at any admin_level, so this closes when someone digitises the 2012 delimitation, not by a better endpoint.",
  "kolkata:cascades":
    "Not a cascade geography. Tank cascades are a peninsular-India form; the Gangetic delta drains rather than cascading.",
  "kolkata:shoreline":
    "Not a coastal city. Kolkata is a tidal river port roughly 130 km upstream of the Bay of Bengal; the riverbank/estuary variant of this surface is a different product and is unbuilt.",
  "kolkata:tanker":
    "KMC runs a municipal tanker service and publishes per-trip rates, but no volumes, trips or coverage - so there is nothing to chart that would not be invented.",
  "kolkata:climate-risk":
    "Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. It is genuinely buildable and simply not built yet, so this is a backlog item rather than a refusal.",

  // Gurugram - preview-gated, city nine. The set is deliberately small: only
  // the surfaces with data behind them are on, and the two most conspicuous
  // absences are properties of the city rather than backlog.
  "gurugram:rivers":
    "Gurugram has no river. Its NWMP monitoring stations are all lakes and borewells, and its surface water leaves the city as drain flow into the Najafgarh jheel and then Delhi's Najafgarh drain. There is nothing to put on a rivers page that would not be an invention.",
  "gurugram:groundwater":
    "The signature issue is the thinnest data, which is why this is off rather than empty. Gurugram has been a CGWA dark zone since 2008, but the India-WRIS level record is 37 stations that stop in June 2020 and the Haryana telemetry network does not cover this district at all - 95 MB of the state export contains zero Gurugram rows. 37 stations across 36 wards would not carry honest per-ward interpolation even if they were current. Closes on IN-GRES block assessment plus the HSPCB 2016-2024 quality series, both identified and neither wired up.",
  "gurugram:flood-risk":
    "Gurugram floods by waterlogging on a paved catchment, not by river. The inputs exist on GMDA OneMap (117 GMUC waterlogging sites, the master storm-water network, natural flow direction) and only the drain legs are harvested so far, so this is a backlog item with a known path rather than a refusal.",
  "gurugram:shoreline": "Landlocked.",
  "gurugram:lake-restoration":
    "Needs a restoration-priority-gurugram.json, which needs a scorer. The water-body register is harvested and carries ownership, area and GMDA's own cross-survey flags, so the inputs are present and the ranking is simply not built.",
  "gurugram:origins":
    "Not built for this city yet. The spine is identified - GMDA OneMap publishes the MCG limit at 1985, 1996, 2008, 2010, 2015 and 2020, which is the city eating its own catchment in six dated steps - but the narrative is unwritten.",
  "gurugram:cascades":
    "Not a cascade geography. Aravalli johads and village ponds are a real water heritage, but no chained-surplus system was engineered here the way it was in the Tamil kanmoi districts or the Bengaluru kere chains, so the cascade story must not be told about this city. Catchment delineation itself is buildable - GMDA publishes a 10-polygon watershed layer and a natural-flow-direction layer - and is a separate question from the cascade narrative.",
  "gurugram:allocations":
    "No published entitlement instrument has been located. Gurugram's canal share of Yamuna water is governed by inter-state arrangements that GMDA does not publish, and the ledger's primitive is entitled-vs-received against a named instrument - without the paper there is no row to write.",
  "gurugram:commitments":
    "Buildable and not built. The dated commitments exist and are citable (the NGT's February 2026 orders on illegal extraction and rainwater harvesting, GMDA's Chandu Budhera fifth-unit target), but each needs primary-source verification before it goes in the register, and none has had it yet.",
  "gurugram:facts":
    "Needs a facts-gurugram.json, which needs the supply and demand numbers that are the very ones still unverified - every figure in circulation for this city is press-sourced, and GMDA's own GIS already contradicts two of them. Ships when the numbers do.",
  "gurugram:climate-risk":
    "Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. Genuinely buildable and simply not built, so this is backlog rather than refusal.",

  // Hyderabad
  "hyderabad:my-ward":
    "The 300-ward delimitation gazetted 25 Dec 2025 has no public geometry, and with the corporations under a Special Officer there are no sitting councillors to attach to a ward either. Returns with the ward build, following the Mumbai precedent.",
  "hyderabad:shoreline": "Landlocked.",
  "hyderabad:climate-risk": "Not built for this city.",

  // Delhi
  "delhi:cascades": "Not a cascade geography.",
  "delhi:shoreline": "Landlocked.",
  "delhi:climate-risk": "Not built for this city.",
  "delhi:tanker": "Not built for this city.",

  // Mumbai
  // Deliberately describes the artifacts rather than naming their paths: the
  // dataset catalogue scans scripts/ for artifact paths to infer which script
  // PRODUCES a file, so a literal path in this prose made the catalogue credit
  // this register as the producer of Mumbai's ward geometry. It produces nothing.
  "mumbai:my-ward": `${UNRECORDED} Mumbai holds both a 2023 ward-boundary layer and ward-keyed data (a ward risk composite and the Praja per-ward water series), so this is a product decision rather than a data gap - but no rationale for it was ever recorded in the repo, and none is invented here. Resolve by writing down the real reason or by shipping the route.`,
  "mumbai:cascades": "Not a cascade geography.",
  "mumbai:climate-risk": "Not built for this city.",
  "mumbai:tanker": "Not built for this city.",

  // Bengaluru
  "bangalore:shoreline": "Landlocked.",
  "bangalore:climate-risk": "Not built for this city.",

  // Madurai
  "madurai:shoreline": "Landlocked.",
  "madurai:climate-risk": "Not built for this city.",
  "madurai:tanker": "Not built for this city.",
  "madurai:commitments": "Not built for this city.",
  "madurai:allocations": "Not built for this city.",

  // Chennai - the origin city ships nearly everything.
  "chennai:cascades":
    "Chennai's cascade surface is served through the basin atlas rather than a city route.",
  "chennai:tanker": "Not built for this city.",
  "chennai:commitments": "Not built for this city.",
  "chennai:allocations": "Not built for this city.",
};

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
    const has = FEATURE_AVAILABILITY[place.cityId];
    if (!has) continue;
    for (const route of routes) {
      if (has.has(route)) continue;
      out.push({
        kind: "route-off",
        scope: place.cityId,
        subject: route,
        reason: ROUTE_OFF_REASONS[`${place.cityId}:${route}`] ?? "",
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

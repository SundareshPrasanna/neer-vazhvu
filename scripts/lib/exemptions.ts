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
  // RETIRED 2026-08-15. The removal condition written into this entry was
  // "closes on IN-GRES block assessment", and that is exactly what closed it:
  // four assessment years to 2024-25, district and block level, all five
  // Gurugram blocks over-exploited and GURGAON_URBAN at 326.26% of recharge.
  // Kept as a comment rather than deleted because a retired exemption is the
  // evidence that these removal conditions are real, which is how Kolkata's
  // rainfall entry was handled above.
  "gurugram:flood-risk":
    "Gurugram floods by waterlogging on a paved catchment, not by river. The inputs exist on GMDA OneMap (117 GMUC waterlogging sites, the master storm-water network, natural flow direction) and only the drain legs are harvested so far, so this is a backlog item with a known path rather than a refusal.",
  "gurugram:shoreline": "Landlocked.",
  "gurugram:lake-restoration":
    "Needs a restoration-priority-gurugram.json, which needs a scorer. The water-body register is harvested and carries ownership, area and GMDA's own cross-survey flags, so the inputs are present and the ranking is simply not built.",
  // RETIRED 2026-08-15: written, on exactly the spine this entry named - the
  // MCG limit at 1985/1996/2008/2010/2015/2020, paired with the 2008 dark-zone
  // notification. Kept as a comment because a retired exemption is the evidence
  // that these removal conditions are real.
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

  // Pune - preview-gated, city ten. The set is small on purpose: only the
  // surfaces with real artifacts behind them are on. Two of the absences
  // below are properties of what Maharashtra publishes rather than backlog.
  // RETIRED 2026-08-17. The recorded reason was that Maharashtra WRD
  // publishes Pune's statutory red and blue flood lines as 518 SCANNED PDF map
  // sheets with no vector form, so the hazard layer does not exist
  // machine-readable. That is still true and now ships as the first data gap
  // ON the page - but it was an argument about the INTERACTIVE variant, and
  // the route was being withheld on it. Pune now renders the NARRATIVE variant,
  // which needs no hazard polygons: the event register (1961 Panshet with no
  // official death toll by the state's own admission, the 2019 Ambil Odha
  // cloudburst, 25 Jul and 4 Aug 2024, 21 Aug 2025) plus PMC's own nalla
  // network, 3,075 open storm-water channels carrying 1,014 km, which was in
  // the repo's reach and rendering nowhere.
  // NARROWED 2026-08-17. The DATA now ships: public/data/pune-tankers.json,
  // 57,370 delivery rows across 411 published registers, 7 filling points,
  // 1,956 distinct vehicles, 84,886 trips. What is still missing is a
  // RENDERER, and that is a deliberate hold rather than laziness.
  //
  // src/lib/cities/types.ts states the rule: "Adding a fourth kind is cheaper
  // than bending one of these: forcing a city through the wrong panel means
  // making its required fields optional and gutting its copy, which damages
  // the city the panel was written for." Pune is exactly that case. The
  // `utility-ledger` panel is HMWSSB-shaped - it renders bookings against
  // deliveries, a fulfilment rate, and divisions and sections. Pune's register
  // has none of those: every row IS a delivery so there is nothing to fulfil,
  // and its units are filling point, prabhag and vehicle. Routing Pune through
  // that panel would mean making bookings/delivered/fulfilment optional and
  // rewriting Hyderabad's copy, which damages Hyderabad.
  //
  // So this needs a FIFTH kind, `utility-delivery-register`, with its own
  // panel. Retire this entry when that lands.
  // RETIRED 2026-08-17. It read "the data ships and the renderer does not ...
  // retire this when that panel lands", and the panel landed:
  // src/components/dashboard/tanker-delivery-register-panel.tsx behind the
  // fourth tankerDataKind, `delivery-register`. Added rather than bending
  // Hyderabad's utility-ledger panel, whose bookings-against-deliveries
  // copy and fulfilment rate would have had to be deleted for a city whose
  // register contains no bookings at all. The panel refuses three things on
  // purpose: no daily series as the headline (two thirds of rows cannot be
  // dated), no prabhag ranking (the ward column is filled on 52.8% of rows,
  // so ordering it would read recording practice as need), and no
  // recipients at all.
  "pune:allocations":
    "The instrument chain exists and is unusually well documented - MWRRA Orders 19/2018 and 01/2025, the 1 March 2013 PMC-WRD agreement, the 2 July 2021 Superintending Engineer letter for the merged villages - but the ledger's primitive is entitled-vs-RECEIVED, and no measured annual draw has been published since 2017-18. For that year the utility and the regulator disagree by 4.15 TMC (PMC's affidavit 14.56 TMC against WRD's 18.71). A ledger whose received column is eight years old and contested is worse than no ledger.",
  "pune:commitments":
    "Buildable and not built. The dated commitments are citable and sharp: JICA loan ID-P243 signed 13 January 2016 for a May 2023 completion now targeted August 2026, and the equitable-supply project's own slippage from December 2024 to December 2025 to May 2026 to 'twelve to fourteen months' as of the August 2026 ESR. Each needs primary-source verification of the attribution before it enters the register.",
  // RETIRED 2026-08-17, same day it was written. It read "needs a
  // facts-pune.json; the compilation is the work", and the compilation
  // happened. public/data/facts-pune.json ships 22 facts across all four
  // tiers, built by neer-vazhvu-api/scripts/build_pune_facts.py, which READS
  // every figure out of the already-shipped artifacts rather than transcribing
  // them a second time - so a quoted card cannot drift from the dashboard it
  // came from. Two numbers a reader would expect are deliberately absent and
  // ship as gap facts instead: litres-per-capita (PMC's own accounts exclude
  // groundwater and tankers, so the denominator does not support the claim)
  // and any measured annual draw (none published since 2017-18, and the two
  // published figures for that year differ by 4.15 TMC).
  //
  // RETIRED 2026-08-17, same day it was written. The removal condition was
  // "Origins is narrative work and gets its own pass", and the pass happened
  // in the same PR rather than a later one. Kept as a comment rather than
  // deleted because a retired exemption is the record that the gap closed
  // rather than being quietly dropped. src/content/story-pune-en.tsx ships
  // ten chapters on the sources listed in its header, with a CC0 Rijksmuseum
  // hero and a 1911 survey plate; the 1961 Panshet death toll is stated as
  // having no official figure, per the state's own current disaster plan,
  // rather than substituting the number that circulates.
  "pune:my-ward":
    "The 41 prabhags of the 2025 delimitation ship as named geometry (public/geojson/pune-wards-2025.geojson, all 41 joined to PMC's own election results), but no ward rows exist in the database: /api/wards?city=pune and /api/localities?city=pune both 404, so the page renders a heading, a subtitle and nothing else. Turned OFF at cutover rather than shipped empty - a live page with no content is exactly issue #279, which this same onboarding filed against Gurugram's water-bodies page. Kolkata carries this exemption for the same reason. Retire it when ward + locality rows are seeded, which needs a producer that does not exist yet; the geometry is not the blocker.",
  "pune:lake-restoration":
    "No restoration-project register exists for Pune. There is also no official register of the city's LOST or encroached water bodies, which is the layer this surface leans on elsewhere.",
  "pune:cascades":
    "The cascade pipeline has not been run for Pune district. Backlog, not refusal.",
  "pune:climate-risk": "Not built for this city.",
  "pune:shoreline": "Landlocked.",

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

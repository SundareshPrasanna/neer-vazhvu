/**
 * The two flagship-pulled hazard families the district ledger surfaced
 * (plan 3.7): scarcity as the WSSD weekly tanker register, flood as the
 * state disaster plan's own classification. Both are state-scoped artifacts;
 * this module is the pure read - it turns an envelope plus a district name
 * into the sentences the pages print, and the pages gate on the data being
 * present, never on configuration.
 *
 * The flood family serves a classification, not a model: Maharashtra's plan
 * names the districts that are NOT flood-prone, Tamil Nadu's names fourteen
 * coastal districts and classifies nothing inland, and the sentences keep
 * that asymmetry explicit - absence from the Tamil Nadu list is never read
 * as safety.
 */
import type { AtlasEnvelope } from "./artifacts";

/** The district envelope with the scope widened to the state tier the
 *  hazard families are served at. */
export interface StateEnvelope extends Omit<AtlasEnvelope, "scope"> {
  scope: { kind: "state"; id: string };
}
import type { VintageRow } from "./district-reading";

/* ── artifact shapes ───────────────────────────────────────────────────── */

export interface ScarcityDistrictRow {
  district: string;
  division: string;
  villages: number;
  wadis: number;
  tankersGovernment: number;
  tankersPrivate: number;
  tankersTotal: number;
}

export interface ScarcityEdition {
  schemaVersion: number;
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  source: { listingUrl: string; pdfUrl: string; pdfSha256: string; title: string };
  districts: ScarcityDistrictRow[];
  stateTotals: { villages: number; wadis: number; tankersGovernment: number; tankersPrivate: number; tankersTotal: number };
  statedDistrictsWithTankers: number;
  worstDistrict: { name: string; tankersTotal: number };
  worstDivision: { name: string; tankersTotal: number };
  review: { status: string; transcribedAt: string; transcribedBy: string; verifiedAt: string | null; verifiedBy: string | null };
}

export interface ScarcityTankersArtifact extends StateEnvelope {
  dataset: "atlas/scarcity-tankers";
  state: string;
  districtCount: number;
  latestReportDate: string;
  editions: ScarcityEdition[];
}

export interface FloodNamedDistrict {
  sdmpName: string;
  currentName: string;
  registrySlug?: string;
}

export interface FloodClassificationArtifact extends StateEnvelope {
  dataset: "atlas/flood-classification";
  state: string;
  source: { title: string; publisher: string; url: string; documentDate: string; retrievedAt: string; pages: number };
  classification: {
    kind: "flood-prone-except" | "coastal-high-vulnerability";
    statement: string;
    exceptions?: FloodNamedDistrict[];
    districts?: FloodNamedDistrict[];
    quote: string;
    section: string;
    pdfPage: number;
    printedPage: number | null;
  };
  review: { status: string };
}

/* ── scarcity reads ────────────────────────────────────────────────────── */

const num = (value: number): string => Math.round(value).toLocaleString("en-IN");

export interface ScarcityWeek {
  reportDate: string;
  weekStart: string;
  weekEnd: string;
  listingUrl: string;
  /** Districts with at least one tanker, worst first. */
  active: ScarcityDistrictRow[];
  /** Districts the report carries at zero. */
  zeroCount: number;
  totals: ScarcityEdition["stateTotals"];
  worstDistrict: ScarcityEdition["worstDistrict"];
  worstDivision: ScarcityEdition["worstDivision"];
}

/** The latest week of the register, worst district first. */
export function latestScarcityWeek(artifact: ScarcityTankersArtifact): ScarcityWeek | null {
  const edition = [...artifact.editions].sort((a, b) => a.reportDate.localeCompare(b.reportDate)).at(-1);
  if (!edition) return null;
  const active = edition.districts
    .filter((row) => row.tankersTotal > 0)
    .sort((a, b) => b.tankersTotal - a.tankersTotal || a.district.localeCompare(b.district));
  return {
    reportDate: edition.reportDate,
    weekStart: edition.weekStart,
    weekEnd: edition.weekEnd,
    listingUrl: edition.source.listingUrl,
    active,
    zeroCount: edition.districts.length - active.length,
    totals: edition.stateTotals,
    worstDistrict: edition.worstDistrict,
    worstDivision: edition.worstDivision,
  };
}

export interface DistrictScarcityReading {
  week: ScarcityWeek;
  row: ScarcityDistrictRow;
  /** This district holds the state's worst tanker count this week. */
  isWorstDistrict: boolean;
  /** The one-paragraph read the district page prints under the tiles. */
  sentence: string;
}

/** The district's row in the latest week, with the state around it.
 *  Returns null when the register does not carry this district (a district
 *  outside the artifact's state), never for a zero row: a week without
 *  tankers is a reading, not a gap. */
export function districtScarcityReading(
  artifact: ScarcityTankersArtifact,
  districtName: string,
): DistrictScarcityReading | null {
  const edition = [...artifact.editions].sort((a, b) => a.reportDate.localeCompare(b.reportDate)).at(-1);
  const week = latestScarcityWeek(artifact);
  if (!edition || !week) return null;
  const wanted = districtName.toLowerCase();
  const row = edition.districts.find((r) => r.district.toLowerCase() === wanted);
  if (!row) return null;
  const isWorstDistrict = week.worstDistrict.name.toLowerCase() === wanted;
  const statewide =
    `Statewide the week's report has ${num(week.totals.villages)} villages and ${num(week.totals.wadis)} ` +
    `wadis on ${num(week.totals.tankersTotal)} tankers` +
    ` (${num(week.totals.tankersGovernment)} government, ${num(week.totals.tankersPrivate)} private), ` +
    `worst in ${week.worstDistrict.name} (${num(week.worstDistrict.tankersTotal)}).`;
  const sentence =
    row.tankersTotal === 0
      ? `No village or wadi in the district was on tanker supply in the week to ${week.weekEnd}. ${statewide}`
      : isWorstDistrict
        ? `${row.district} ran more tankers than any other district in the week to ${week.weekEnd}: ` +
          `${num(row.tankersTotal)} (${num(row.tankersGovernment)} government, ${num(row.tankersPrivate)} private), ` +
          `supplying ${num(row.villages)} villages and ${num(row.wadis)} wadis. ${statewide}`
        : `${num(row.villages)} villages and ${num(row.wadis)} wadis in the district drew water from ` +
          `${num(row.tankersTotal)} tankers in the week to ${week.weekEnd}. ${statewide}`;
  return { week, row, isWorstDistrict, sentence };
}

/* ── flood reads ───────────────────────────────────────────────────────── */

export interface DistrictFloodReading {
  /** The plan's classification for this district, as one sentence. */
  sentence: string;
  /** The plan's own line, quotable beside the sentence. */
  quote: string;
  citation: string;
  /** True when the plan places the district in its exposed class; null when
   *  the plan does not classify this district either way. */
  exposed: boolean | null;
}

function citationOf(artifact: FloodClassificationArtifact): string {
  const page =
    artifact.classification.printedPage !== null
      ? `printed page ${artifact.classification.printedPage}`
      : `PDF page ${artifact.classification.pdfPage}`;
  return `${artifact.source.title}, ${artifact.classification.section}, ${page}`;
}

/** The classification at the state tier: the plan's own statement, quoted. */
export function stateFloodReading(artifact: FloodClassificationArtifact): DistrictFloodReading {
  return {
    sentence: artifact.classification.statement,
    quote: artifact.classification.quote,
    citation: citationOf(artifact),
    exposed: null,
  };
}

/** What the state disaster plan says about this district, and only that. */
export function districtFloodReading(
  artifact: FloodClassificationArtifact,
  district: { name: string; slug: string },
): DistrictFloodReading {
  const c = artifact.classification;
  const quote = c.quote;
  const citation = citationOf(artifact);
  const wanted = district.name.toLowerCase();
  if (c.kind === "flood-prone-except") {
    const excepted = (c.exceptions ?? []).some(
      (d) => d.registrySlug === district.slug || d.currentName.toLowerCase() === wanted,
    );
    return excepted
      ? {
          sentence:
            `${district.name} is one of the eight districts the state disaster ` +
            `plan names as not flood-prone; every other district in the state is.`,
          quote,
          citation,
          exposed: false,
        }
      : {
          sentence: `The state disaster plan classes ${district.name}, like most of the state, as flood-prone.`,
          quote,
          citation,
          exposed: true,
        };
  }
  const named = (c.districts ?? []).some(
    (d) => d.registrySlug === district.slug || d.currentName.toLowerCase() === wanted,
  );
  return named
    ? {
        sentence:
          `${district.name} is one of the fourteen coastal districts the state disaster plan ` +
          `rates highly vulnerable to floods and cyclones.`,
        quote,
        citation,
        exposed: true,
      }
    : {
        sentence:
          `${district.name} is not among the fourteen coastal districts the state disaster plan ` +
          `rates highly vulnerable; the plan does not classify inland flood exposure district by ` +
          `district, so that is the extent of what it states here, not a rating of safety.`,
        quote,
        citation,
        exposed: null,
      };
}

/* ── vintages ──────────────────────────────────────────────────────────── */

export function scarcityVintageRow(artifact: ScarcityTankersArtifact): VintageRow {
  const week = latestScarcityWeek(artifact);
  return {
    label: "Tankers deployed",
    describes: week ? `week to ${week.weekEnd}, report dated ${week.reportDate}` : "no edition",
    retrieved: artifact.provenance.sources[0]?.retrieved ?? "unstated",
    produced: artifact.provenance.produced_at,
    historical: false,
    note: "WSSD weekly tanker report (Government of Maharashtra), transcribed edition by edition from the scanned PDF; every edition must reproduce the report's own printed totals before it is accepted.",
  };
}

export function floodVintageRow(artifact: FloodClassificationArtifact): VintageRow {
  return {
    label: "Flood classification",
    describes: `${artifact.source.title}, ${artifact.source.documentDate}`,
    retrieved: artifact.source.retrievedAt,
    produced: artifact.provenance.produced_at,
    historical: false,
    note: "The plan's own flood classification, quoted with its page; the Atlas classifies nothing itself. A revised plan replaces this line wholesale.",
  };
}

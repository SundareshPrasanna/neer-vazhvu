/**
 * A district read as one place: the verdict, three dated facts, what the
 * district runs on, the taluk headroom, the block findings, the water-body
 * register, and the vintage of every figure.
 *
 * Every sentence here is a template over the roll-up in district-aggregate
 * and the served envelopes. Nothing is written per district: Tiruchirappalli
 * produces its own text from the same code that reads Thanjavur, and a third
 * district gets a reading the day its artifacts land. Dates are read from the
 * artifacts (assessedAt, as_of, retrieved, produced_at), never typed here.
 *
 * Tone follows the Gram Panchayat briefs' vocabulary (positive, warning,
 * neutral, blocked). The frame is alignment and next steps: nothing is
 * attributed to an officer or a department, and a gap is named as a gap.
 */
import type {
  AtlasEnvelope,
  BriefsShard,
  CensusShard,
  DistrictDirectoryArtifact,
  GroundwaterProjectionArtifact,
  GroundwaterTaluksArtifact,
  IrrigationCurrentArtifact,
  JjmServiceShard,
  RainfallArtifact,
  WaterBodiesShard,
  WaterBodiesUnassigned,
} from "./artifacts";
import { identityAdapterOf, identityMasterVintage, identityVintage } from "./artifacts";
import type { CuratedBriefsArtifact } from "./curated-briefs";
import { environmentPlanReading, type EnvironmentPlanArtifact, type EnvironmentPlanReading } from "./environment-plan";
import {
  loadBriefShards,
  loadEnvironmentPlan,
  loadCensusShards,
  loadDirectory,
  loadGroundwaterProjection,
  loadGroundwaterTaluks,
  loadIrrigationCurrent,
  loadJjmServiceShards,
  loadRainfall,
  loadWaterBodyShards,
  readDistrictArtifact,
} from "./data";
import {
  getDistrictAggregate,
  type BlockAggregate,
  type DistrictAggregate,
  type TalukGroundwater,
} from "./district-aggregate";
import { getDistrictBriefs } from "./district-directory";
import type { BriefTone, PlaceBrief } from "./place-brief";
import { findAtlasDistrict, type AtlasDistrict } from "./registry";
import { formatExtractionStage } from "./tn-groundwater-projection";

/* ── shapes ────────────────────────────────────────────────────────────── */

export type IrrigationSource = "canal" | "well" | "mixed";

export interface MixShare {
  key: string;
  label: string;
  /** Absolute quantity behind the share (hectares, or a source count). */
  value: number;
  percent: number;
}

export interface DistrictVerdict {
  sentence: string;
  tone: BriefTone;
  /** What would sharpen the reading, as named gaps. Alignment, not blame. */
  nextSteps: string[];
}

export interface HeadlineFact {
  value: string;
  label: string;
  /** The reference period or retrieval the figure describes. */
  asOf: string;
  note: string;
}

export interface MetturReading {
  canalPercent: number;
  sentence: string;
  /** The live storage feed is not wired; this names the gap instead of a number. */
  gap: string;
}

export interface TalukReading extends TalukGroundwater {
  /** IN-GRES total groundwater availability, the base the stage is measured against. */
  totalAvailabilityHam: number | null;
}

export interface GroundwaterReading {
  /** What the state calls the assessment unit: "taluk" (Tamil Nadu), "taluka" (Maharashtra). */
  unitLabel: string;
  assessmentYear: string | null;
  districtCategory: string | null;
  districtStagePercent: number | null;
  taluks: TalukReading[];
  /** Rainfall recharge, as IN-GRES reports it (rechargeData.rainfall.total). */
  rechargeHam: number;
  /** Total groundwater availability summed over the taluks. */
  availabilityHam: number;
  futureUseHam: number;
  /** Left for future use as a share of total availability. */
  headroomPercent: number | null;
  categories: Record<string, number>;
  finding: string;
  projection: {
    gramPanchayats: number;
    projected: number;
    deferred: number;
    method: string;
    limitations: string[];
  } | null;
}

export interface BlockReading extends BlockAggregate {
  /** The taluk category most of the block's Panchayats inherit by projection. */
  dominantCategory: string | null;
  projectedPlaces: number;
}

export interface BlockFindings {
  gradient: string;
  tapGap: string;
  /** Present when any block or the district reports exactly 100.0% taps. */
  artifact: string | null;
}

export interface WaterBodiesReading {
  count: number;
  areaHectares: number;
  places: number;
  placesWithout: number;
  layer: string;
  departments: string[];
  rightsStatus: string;
  termsQuote: string;
  licence: string;
  retrieved: string;
  /** Which register the family was read from: TNGIS (Tamil Nadu) or the
   *  First Census of Water Bodies (states with no open GIS register). */
  register: WaterBodyRegister["register"];
  label: string;
  /** "Registered by" (TNGIS source department) or "Owned by" (census ownership). */
  holderLabel: string;
  /** Computed from polygons (TNGIS), entered by an enumerator, or withheld
   *  because the return reads as a template. */
  areaBasis: "computed" | "stated" | "withheld";
  attributeNote: string | null;
  /** Census register: rows counted on the block shards but assigned to no
   *  Panchayat (shared, uncovered or unknown villages; towns). */
  unassigned: WaterBodiesUnassigned | null;
  byType: Array<{ type: string; count: number }>;
  pointsServed: number;
  pointsOutsideDistrict: number;
}

interface WaterBodyRegister {
  register: "tngis" | "water-bodies-census";
  label: string;
  holderLabel: string;
}

function waterBodyRegisterOf(shards: WaterBodiesShard[]): WaterBodyRegister {
  return shards[0]?.ext.atlas.register === "water-bodies-census"
    ? { register: "water-bodies-census", label: "First Census of Water Bodies", holderLabel: "Owned by" }
    : { register: "tngis", label: "TNGIS register", holderLabel: "Registered by" };
}

export interface VintageRow {
  label: string;
  describes: string;
  retrieved: string;
  produced: string;
  /** True when the reference period is more than three years before the reading. */
  historical: boolean;
  note: string;
}

export interface DistrictReading {
  slug: string;
  districtName: string;
  /** The day the roll-up is dated to: the latest brief assessment. */
  asOf: string;
  panchayatCount: number;
  blockCount: number;
  briefReady: number;
  verdict: DistrictVerdict;
  facts: HeadlineFact[];
  irrigation: { source: IrrigationSource | null; shares: MixShare[]; irrigatedHectares: number; places: number; describes: string };
  /** The current district mix (DES Season and Crop Report), when served.
   *  The Census 2011 pattern above stays beside it as the block-level
   *  baseline; when this is null the page renders exactly as before. */
  irrigationCurrent: {
    edition: string;
    /** "Season and Crop Report 2024-25", built from the artifact's edition. */
    label: string;
    netHectares: number;
    grossHectares: number;
    moreThanOnceHectares: number;
    intensity: number;
    shares: MixShare[];
    /** Only when the report records supplementary wells: their net area is
     *  NOT additive to the net total, and the note says so. */
    supplementaryWellsNote: string | null;
  } | null;
  drinking: { shares: MixShare[]; topTypes: MixShare[]; total: number; sentence: string; describes: string };
  mettur: MetturReading | null;
  groundwater: GroundwaterReading;
  blocks: BlockReading[];
  blockFindings: BlockFindings;
  waterBodies: WaterBodiesReading | null;
  /** The district's Environment Plan as transcribed, figure by figure with
   *  page citations; null renders the named gap. */
  environmentPlan: EnvironmentPlanReading | null;
  vintages: VintageRow[];
}

/* ── helpers ───────────────────────────────────────────────────────────── */

const DEFICIT_CATEGORIES = new Set(["over_exploited", "critical"]);
const HISTORICAL_AFTER_YEARS = 3;

function num(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

function pct(value: number | null): string {
  return value === null ? "not stated" : `${value.toFixed(1)}%`;
}

function whole(value: number | null): string {
  return value === null ? "not stated" : `${Math.round(value)}%`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, "-");
}

/** What the state calls the unit IN-GRES assesses: TALUK in Tamil Nadu,
 *  TALUKA in Maharashtra. Read from the served artifact, lower-cased. */
export function unitLabelOf(taluks: { source?: { assessmentUnitType?: string } } | undefined): string {
  const raw = taluks?.source?.assessmentUnitType?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : "taluk";
}

/** IN-GRES shouts taluk names ("THIRUCHIRAPALLI-EAST"); the page does not. */
export function displayTalukName(name: string): string {
  return name
    .toLocaleLowerCase("en-IN")
    .replace(/(^|[\s-])([a-z])/g, (_, boundary: string, letter: string) => boundary + letter.toLocaleUpperCase("en-IN"));
}

function yearOf(text: string): number | null {
  const match = /(19|20)\d{2}/.exec(text);
  return match ? Number(match[0]) : null;
}

function isHistorical(describes: string, asOf: string): boolean {
  const year = yearOf(describes);
  const asOfYear = yearOf(asOf);
  if (year === null || asOfYear === null) return false;
  return asOfYear - year > HISTORICAL_AFTER_YEARS;
}

function latest(dates: Array<string | undefined | null>): string | null {
  const valid = dates.filter((d): d is string => typeof d === "string" && d.length > 0).sort();
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

function sourceOf(envelope: AtlasEnvelope | undefined, id?: string) {
  if (!envelope) return undefined;
  return id
    ? envelope.provenance.sources.find((s) => s.id === id)
    : envelope.provenance.sources[0];
}

/* ── verdict ───────────────────────────────────────────────────────────── */

export interface VerdictSignals {
  source: IrrigationSource | null;
  canalPercent: number | null;
  wellPercent: number | null;
  taluks: number;
  overExploited: number;
  critical: number;
  semiCritical: number;
  safe: number;
  tapPercent: number | null;
  households: number;
  gapBlocks: Array<{ name: string; tapPercent: number; canalPercent: number | null; inDeficitTaluk: boolean }>;
  /** True when the district sits in the Cauvery (TN) basin, where the canal head is Mettur. */
  metturBasin: boolean;
  /** The assessment unit's name in this state; "taluk" when unstated. */
  unitLabel?: string;
  /** The state's own sentence on the missing current irrigation reading. */
  irrigationNextStep?: string;
  /** Non-null when a current irrigation mix is served ("Season and Crop
   *  Report 2024-25"); canalPercent and wellPercent then carry the current
   *  district figures rather than the Census 2011 pattern, and the verdict
   *  opens with them. */
  currentMixLabel: string | null;
  /** The District Environment Plan on file, if any, and whether it prints
   *  a water balance; absent or null, the plan itself is the next step. */
  environmentPlan?: { label: string; hasWaterBalance: boolean } | null;
}

export function classifyIrrigation(
  canalPercent: number | null,
  wellPercent: number | null,
): IrrigationSource | null {
  if (canalPercent === null && wellPercent === null) return null;
  if ((canalPercent ?? 0) >= 50) return "canal";
  if ((wellPercent ?? 0) >= 50) return "well";
  return "mixed";
}

type ServiceGap = "none" | "narrow" | "wide" | null;

function serviceGapOf(tapPercent: number | null): ServiceGap {
  if (tapPercent === null) return null;
  if (tapPercent < 90) return "wide";
  if (tapPercent < 99.5) return "narrow";
  return "none";
}

/**
 * The tone rule. Source stress is the share of assessed taluks that are
 * over-exploited or critical; the service gap is the district tap figure.
 *
 *  blocked  a wide tap gap on a district with any taluk in deficit: closing
 *           the gap draws on a source already over-drawn (the GP rule, scaled)
 *  warning  most taluks in deficit; or some in deficit on a district that
 *           irrigates from wells or still has a tap gap; or a wide tap gap
 *           on a safe aquifer
 *  positive no taluk in deficit and taps at or near complete
 *  neutral  nothing assessed, or a partial deficit the canals carry
 */
export function deriveDistrictTone(s: VerdictSignals): BriefTone {
  const deficit = s.overExploited + s.critical;
  const deficitShare = s.taluks > 0 ? deficit / s.taluks : null;
  const gap = serviceGapOf(s.tapPercent);
  if (deficitShare === null && gap === null) return "neutral";
  if (gap === "wide" && deficitShare !== null && deficitShare > 0) return "blocked";
  if (deficitShare !== null && deficitShare >= 0.5) return "warning";
  if (deficitShare !== null && deficitShare > 0 && (s.source === "well" || gap !== "none")) {
    return "warning";
  }
  if (gap === "wide") return "warning";
  if (deficitShare === 0 && (gap === "none" || gap === "narrow")) return "positive";
  return "neutral";
}

// The irrigation source mix is the Census 2011 village pattern (reference
// year 2009). It no longer opens the verdict (see composeDistrictVerdict);
// this clause is kept for the "what the district runs on" section, where
// the vintage is stated beside it.
export function sourceClause(s: VerdictSignals): string {
  const head = s.metturBasin ? "canal water released at Mettur" : "canal water released upstream";
  switch (s.source) {
    case "canal":
      return `${whole(s.canalPercent)} of the irrigated farmland ran on ${head} at the 2011 Census`;
    case "well":
      return `${whole(s.wellPercent)} of the irrigated farmland was watered from wells at the 2011 Census`;
    case "mixed":
      return `irrigation was split between canals (${whole(s.canalPercent)}) and wells (${whole(s.wellPercent)}) at the 2011 Census`;
    default:
      return "no Census irrigation record is on file";
  }
}

function groundwaterClause(s: VerdictSignals): string {
  const unit = s.unitLabel ?? "taluk";
  if (s.taluks === 0) return `no IN-GRES ${unit} assessment is on file`;
  const n = s.taluks;
  if (s.overExploited > 0 && s.critical > 0) {
    return (
      `${s.overExploited} of ${n} ${unit}s already draw more groundwater than recharges ` +
      `and ${s.critical} more ${plural(s.critical, "is", "are")} close to that line`
    );
  }
  if (s.overExploited > 0) {
    return `${s.overExploited} of ${n} ${unit}s already draw more groundwater than recharges`;
  }
  if (s.critical > 0) return `${s.critical} of ${n} ${unit}s ${plural(s.critical, "is", "are")} assessed critical`;
  if (s.semiCritical > 0) {
    return `none of the ${n} ${unit}s is over-exploited, though ${s.semiCritical} ${plural(s.semiCritical, "is", "are")} semi-critical`;
  }
  return `every one of the ${n} assessed ${unit}s is within its recharge`;
}

function serviceClause(s: VerdictSignals): string {
  if (s.tapPercent === null) return "no JJM tap figure is on file";
  if (s.tapPercent === 100) {
    return (
      `all ${num(s.households)} households on the JJM register are recorded with a tap, ` +
      "a 100.0% that reads as a reporting convention rather than a measurement"
    );
  }
  const gap = serviceGapOf(s.tapPercent);
  if (gap === "none" || s.gapBlocks.length === 0) {
    return `${pct(s.tapPercent)} of households are recorded with a tap`;
  }
  const worst = [...s.gapBlocks].sort((a, b) => a.tapPercent - b.tapPercent).slice(0, 2);
  const noCanal = worst.every((b) => (b.canalPercent ?? 0) < 10);
  const where = noCanal
    ? `sitting in the blocks without canal water, ${listNames(worst.map((b) => b.name))}`
    : `concentrated in ${listNames(worst.map((b) => b.name))}`;
  return `${pct(s.tapPercent)} of households are recorded with a tap, with the gap ${where}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The verdict's opening clause when a current mix is served: the Season and
 *  Crop Report district figure, labelled inline so the vintage travels with
 *  the number. */
function currentMixClause(s: VerdictSignals): string {
  const label = s.currentMixLabel ?? "";
  const head = s.metturBasin ? "canal water released at Mettur" : "canal water released upstream";
  switch (s.source) {
    case "canal":
      return `${whole(s.canalPercent)} of the irrigated farmland runs on ${head} (${label})`;
    case "well":
      return `${whole(s.wellPercent)} of the irrigated farmland is watered from wells (${label})`;
    default:
      return `irrigation is split between canals (${whole(s.canalPercent)}) and wells (${whole(s.wellPercent)}) (${label})`;
  }
}

/**
 * The verdict leads with what is current. When the Season and Crop Report
 * mix is served (currentMixLabel non-null), it is the FIRST clause - the
 * standing rule that the first metric a reader meets must be a current
 * reading - with the IN-GRES taluk balance and the JJM service register
 * following as before. Without it, the verdict opens on the taluk balance,
 * the Census 2011 pattern stays out of the opening sentence and the
 * headline facts, and the missing current reading is the first named gap.
 */
export function composeDistrictVerdict(s: VerdictSignals): DistrictVerdict {
  const opening =
    s.currentMixLabel !== null && s.source !== null
      ? `${currentMixClause(s)}, ${groundwaterClause(s)}`
      : groundwaterClause(s);
  const sentence = `${capitalise(opening)}, and ${serviceClause(s)}.`;
  const nextSteps: string[] = [];
  if (s.source !== null && s.currentMixLabel === null) {
    nextSteps.push(
      "A current irrigation reading by source: the canal, well and tank shares below are the Census 2011 pattern (reference year 2009); " +
        (s.irrigationNextStep ?? "the Season and Crop Report 2024-25 is published and not yet wired."),
    );
  }
  if (s.metturBasin && (s.canalPercent ?? 0) > 0) {
    nextSteps.push("Live Mettur storage (the tnsmart daily reservoir feed), not wired yet.");
  }
  if (s.overExploited + s.critical > 0) {
    nextSteps.push(
      `A measured groundwater level series for the ${s.unitLabel ?? "taluk"}s in deficit, so the assessment can be read against observation.`,
    );
  }
  if (s.gapBlocks.length > 0) {
    nextSteps.push(
      `Where the next connections in ${listNames(s.gapBlocks.map((b) => b.name))} would draw from, before the tap gap closes on the same aquifer.`,
    );
  }
  if (s.tapPercent === 100) {
    nextSteps.push("A habitation-level check of the 100.0% tap figure against a survey, to tell reported complete from measured.");
  }
  if (!s.environmentPlan) {
    nextSteps.push("The District Environment Plan water balance (NGT template), not yet on file.");
  } else if (!s.environmentPlan.hasWaterBalance) {
    nextSteps.push(
      `A water balance: the District Environment Plan on file (${s.environmentPlan.label}) is on the CPCB model and prints no demand, supply or deficit table.`,
    );
  }
  return { sentence, tone: deriveDistrictTone(s), nextSteps };
}

/* ── readings ──────────────────────────────────────────────────────────── */

function drinkingShares(briefs: PlaceBrief[]): { byCategory: MixShare[]; byType: MixShare[]; total: number } {
  const categories = new Map<string, number>();
  const types = new Map<string, number>();
  let total = 0;
  for (const brief of briefs) {
    for (const source of brief.detail.sources) {
      categories.set(source.category, (categories.get(source.category) ?? 0) + source.count);
      types.set(source.type, (types.get(source.type) ?? 0) + source.count);
      total += source.count;
    }
  }
  const toShares = (map: Map<string, number>): MixShare[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label,
        value,
        percent: total > 0 ? Number(((100 * value) / total).toFixed(1)) : 0,
      }));
  return { byCategory: toShares(categories), byType: toShares(types), total };
}

function irrigationShares(aggregate: DistrictAggregate): MixShare[] {
  const irrigated = aggregate.irrigatedHectares;
  const known = (aggregate.canalPercent ?? 0) + (aggregate.wellPercent ?? 0) + (aggregate.tankPercent ?? 0);
  const other = Math.max(0, Number((100 - known).toFixed(1)));
  const share = (key: string, label: string, percent: number | null): MixShare => ({
    key,
    label,
    value: Math.round((irrigated * (percent ?? 0)) / 100),
    percent: percent ?? 0,
  });
  return [
    share("canal", "Canals", aggregate.canalPercent),
    share("well", "Wells", aggregate.wellPercent),
    share("tank", "Tanks", aggregate.tankPercent),
    share("other", "Other sources", other),
  ];
}

function metturReading(
  district: AtlasDistrict,
  aggregate: DistrictAggregate,
  blocks: BlockReading[],
): MetturReading | null {
  const canal = aggregate.canalPercent;
  if (district.basin?.basinId !== "cauvery-tn" || canal === null || canal <= 0) return null;
  const topBlocks = [...blocks]
    .filter((b) => b.canalPercent !== null)
    .sort((a, b) => (b.canalPercent ?? 0) - (a.canalPercent ?? 0))
    .slice(0, 3)
    .map((b) => b.name);
  let sentence: string;
  if (canal >= 50) {
    sentence =
      `With ${pct(canal)} of irrigated farmland on canal water, the district's water year is ` +
      "decided by the release at Mettur, upstream of every block here. The canal share is the " +
      "Census 2011 pattern; whether a given season's release reached the tail end is not in any served source.";
  } else if (canal >= 20) {
    sentence =
      `Canal water reaches ${pct(canal)} of irrigated farmland, concentrated in ` +
      `${listNames(topBlocks)}, so the Mettur release decides the season there and the ` +
      "aquifer decides it everywhere else.";
  } else {
    sentence =
      `Canal water reaches only ${pct(canal)} of irrigated farmland (${listNames(topBlocks)}); ` +
      "the Mettur release is a local question here, not a district one.";
  }
  return {
    canalPercent: canal,
    sentence,
    gap:
      "Live Mettur storage: not wired. The tnsmart daily reservoir feed is a named gap on this page; " +
      "no figure is shown rather than a stale one.",
  };
}

function groundwaterReading(
  aggregate: DistrictAggregate,
  taluksArtifact: ReturnType<typeof loadGroundwaterTaluks>,
  projection: GroundwaterProjectionArtifact | undefined,
): GroundwaterReading {
  const availabilityByTaluk = new Map(
    (taluksArtifact?.records ?? []).map((record) => [record.locationName, record.totalAvailabilityHam]),
  );
  const unit = unitLabelOf(taluksArtifact);
  const taluks: TalukReading[] = aggregate.taluks.map((taluk) => ({
    ...taluk,
    totalAvailabilityHam: availabilityByTaluk.get(taluk.name) ?? null,
  }));
  const categories: Record<string, number> = {};
  for (const taluk of taluks) categories[taluk.category] = (categories[taluk.category] ?? 0) + 1;
  const rechargeHam = taluks.reduce((sum, t) => sum + t.annualRechargeHam, 0);
  const availabilityHam = taluks.reduce((sum, t) => sum + (t.totalAvailabilityHam ?? 0), 0);
  const futureUseHam = taluks.reduce((sum, t) => sum + t.availabilityForFutureUseHam, 0);
  const headroomPercent =
    availabilityHam > 0 ? Number(((100 * futureUseHam) / availabilityHam).toFixed(1)) : null;
  const year = aggregate.groundwaterAssessmentYear;

  let finding: string;
  if (taluks.length === 0) {
    finding = `No IN-GRES ${unit} assessment is on file for this district, so the headroom is unstated rather than estimated.`;
  } else {
    const byFuture = [...taluks].sort((a, b) => b.availabilityForFutureUseHam - a.availabilityForFutureUseHam);
    const most = byFuture[0];
    const least = byFuture[byFuture.length - 1];
    const counts = (["over_exploited", "critical", "semi_critical", "safe", "saline"] as const)
      .filter((c) => (categories[c] ?? 0) > 0)
      .map((c) => `${categories[c]} ${categoryLabel(c)}`);
    const districtRow =
      taluksArtifact?.district.category && taluksArtifact.district.stageOfExtractionPercent !== null
        ? ` The district as a whole is assessed ${categoryLabel(taluksArtifact.district.category)} at ` +
          `${formatExtractionStage(taluksArtifact.district.stageOfExtractionPercent)}% of extraction.`
        : "";
    const headroom =
      headroomPercent === null
        ? `${num(futureUseHam)} ham left for future use`
        : `${num(futureUseHam)} ham (${headroomPercent}%) left for future use`;
    finding =
      `IN-GRES ${year ?? ""} puts total groundwater availability across the ${taluks.length} ${unit}s at ` +
      `${num(availabilityHam)} ham a year, ${num(rechargeHam)} ham of it rainfall recharge, with ${headroom}. ` +
      `Of the ${taluks.length} ${unit}s, ${listNames(counts)}.${districtRow} ` +
      `Headroom sits mostly in ${displayTalukName(most.name)} (${num(most.availabilityForFutureUseHam)} ham) ` +
      `and is thinnest in ${displayTalukName(least.name)} (${num(least.availabilityForFutureUseHam)} ham).`;
  }

  return {
    assessmentYear: year,
    unitLabel: unit,
    districtCategory: taluksArtifact?.district.category ?? null,
    districtStagePercent: taluksArtifact?.district.stageOfExtractionPercent ?? null,
    taluks,
    rechargeHam,
    availabilityHam,
    futureUseHam,
    headroomPercent,
    categories,
    finding,
    projection: projection
      ? {
          gramPanchayats: projection.summary.gramPanchayats,
          projected: projection.summary.projected,
          deferred: projection.summary.deferred,
          method: projection.projectionMethod,
          limitations: projection.projection?.limitations ?? [],
        }
      : null,
  };
}

function blockReadings(
  aggregate: DistrictAggregate,
  projection: GroundwaterProjectionArtifact | undefined,
): BlockReading[] {
  const byBlock = new Map<string, Map<string, number>>();
  for (const record of projection?.records ?? []) {
    if (!record.category) continue;
    const counts = byBlock.get(record.lgdBlockCode) ?? new Map<string, number>();
    counts.set(record.category, (counts.get(record.category) ?? 0) + 1);
    byBlock.set(record.lgdBlockCode, counts);
  }
  return aggregate.blocks.map((block) => {
    const counts = byBlock.get(block.code);
    let dominantCategory: string | null = null;
    let projectedPlaces = 0;
    if (counts) {
      for (const [category, count] of counts) {
        projectedPlaces += count;
        if (dominantCategory === null || count > (counts.get(dominantCategory) ?? 0)) {
          dominantCategory = category;
        }
      }
    }
    return { ...block, dominantCategory, projectedPlaces };
  });
}

function blockFindings(aggregate: DistrictAggregate, blocks: BlockReading[], unit: string): BlockFindings {
  const withCanal = blocks
    .filter((b) => b.canalPercent !== null)
    .sort((a, b) => (b.canalPercent ?? 0) - (a.canalPercent ?? 0));

  let gradient: string;
  if (withCanal.length < 2) {
    gradient = "Too few blocks carry a Census irrigation record to read a gradient across them.";
  } else {
    const top = withCanal[0];
    const bottom = withCanal[withCanal.length - 1];
    const atTop = withCanal.filter((b) => b.canalPercent === top.canalPercent).map((b) => b.name);
    const atBottom = withCanal.filter((b) => b.canalPercent === bottom.canalPercent).map((b) => b.name);
    gradient =
      `Canal share runs from ${pct(top.canalPercent)} in ${listNames(atTop)} to ${pct(bottom.canalPercent)} ` +
      `in ${listNames(atBottom)}; wells fill the difference, ${pct(bottom.wellPercent)} of irrigated ` +
      `farmland at the bottom of the gradient against ${pct(top.wellPercent)} at the top.`;
  }

  const gapBlocks = blocks
    .filter((b) => b.tapPercent !== null && b.tapPercent < 99)
    .sort((a, b) => (a.tapPercent ?? 0) - (b.tapPercent ?? 0));
  const describe = (b: BlockReading) =>
    `${b.name} (${pct(b.tapPercent)} of households, ${pct(b.canalPercent)} canal)`;
  let tapGap: string;
  if (gapBlocks.length === 0) {
    const exact = blocks.filter((b) => b.tapPercent === 100).length;
    tapGap =
      `No block reports a tap gap: ${exact === blocks.length ? "every block" : `${blocks.length - exact} of ${blocks.length} blocks record 99% or more and ${exact}`} ` +
      `record${exact === blocks.length ? "s" : ""} exactly 100.0% of households with a connection.`;
  } else {
    const noCanal = gapBlocks.filter((b) => (b.canalPercent ?? 0) < 10);
    const canalFed = blocks.filter((b) => (b.canalPercent ?? 0) >= 10 && b.tapPercent !== null);
    const canalFloor = canalFed.length > 0 ? Math.min(...canalFed.map((b) => b.tapPercent ?? 0)) : null;
    if (noCanal.length === gapBlocks.length) {
      tapGap =
        `The tap gap sits on the blocks without canal water: ${listNames(gapBlocks.map(describe))}.` +
        (canalFloor !== null ? ` Every block with canal water records ${pct(canalFloor)} or more.` : "");
    } else if (noCanal.length > 0) {
      const exceptions = gapBlocks.filter((b) => (b.canalPercent ?? 0) >= 10);
      tapGap =
        `The tap gap is mostly on the blocks without canal water (${listNames(noCanal.map(describe))}); ` +
        `${listNames(exceptions.map(describe))} ${plural(exceptions.length, "is", "are")} the exception, with canal water and a gap.`;
    } else {
      tapGap = `The tap gap does not follow the canal line: ${listNames(gapBlocks.map(describe))}.`;
    }
    if (gapBlocks.every((b) => b.dominantCategory !== null && DEFICIT_CATEGORIES.has(b.dominantCategory))) {
      tapGap +=
        ` Each of these blocks sits mostly in a ${unit} assessed over-exploited or critical, so closing the gap draws on a source already in deficit.`;
    }
  }

  const exactBlocks = blocks.filter((b) => b.tapPercent === 100);
  const districtExact = aggregate.tapPercent === 100;
  const artifact =
    exactBlocks.length > 0 || districtExact
      ? `${exactBlocks.length} of ${blocks.length} blocks report exactly 100.0% of households with a tap` +
        `${districtExact ? ", and so does the district as a whole" : ""}. A figure that exact across ` +
        `${num(aggregate.households.value)} households is a reporting convention, connections entered equal ` +
        "to households, and is read here as reported complete rather than measured."
      : null;

  return { gradient, tapGap, artifact };
}

function waterBodiesReading(
  aggregate: DistrictAggregate,
  shards: WaterBodiesShard[],
): WaterBodiesReading | null {
  const first = shards[0];
  if (!first) return null;
  const departments = new Set<string>();
  for (const shard of shards) for (const d of shard.ext.atlas.contributingDepartments) departments.add(d);
  const source = sourceOf(first);
  const register = waterBodyRegisterOf(shards);
  const census = register.register === "water-bodies-census";
  const unassigned: WaterBodiesUnassigned = { sharedVillage: 0, uncoveredVillage: 0, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 0 };
  const types = new Map<string, number>();
  let pointsServed = 0;
  for (const shard of shards) {
    for (const key of Object.keys(unassigned) as Array<keyof WaterBodiesUnassigned>) {
      unassigned[key] += shard.ext.atlas.unassigned?.[key] ?? 0;
    }
    for (const feature of shard.features) {
      pointsServed += feature.properties.pointCount ?? 0;
      for (const entry of feature.properties.byType ?? []) types.set(entry.type, (types.get(entry.type) ?? 0) + entry.count);
    }
  }
  return {
    count: aggregate.waterBodyCount,
    areaHectares: aggregate.waterBodyAreaHectares,
    places: aggregate.waterBodyPlaces,
    placesWithout: aggregate.placesWithoutWaterBodies,
    layer: first.ext.atlas.layer,
    departments: [...departments].sort(),
    rightsStatus: first.ext.atlas.rights.status,
    termsQuote: first.ext.atlas.rights.termsQuote,
    licence: source?.license ?? "licence unstated",
    retrieved: source?.retrieved ?? first.ext.atlas.acquiredAt,
    register: register.register,
    label: register.label,
    holderLabel: register.holderLabel,
    areaBasis: census ? (first.ext.atlas.attributes?.waterspread ?? "withheld") : "computed",
    attributeNote: first.ext.atlas.attributes?.note ?? null,
    // Urban rows belong to no block, so the district total the producer
    // stamps on every shard is the honest figure; the block sum is the
    // fallback for a shard written before the field existed.
    unassigned: census ? (first.ext.atlas.unassignedDistrict ?? unassigned) : null,
    byType: [...types.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
    pointsServed,
    pointsOutsideDistrict: first.ext.atlas.pointsOutsideDistrict ?? 0,
  };
}

/* ── the reading ───────────────────────────────────────────────────────── */

/**
 * Everything the reading is composed from, handed in so buildDistrictReading
 * is a pure function of the served artifacts: getDistrictReading supplies
 * them from disk, the tests from the fixture corpus.
 */
export interface DistrictReadingInputs {
  district: AtlasDistrict;
  aggregate: DistrictAggregate;
  briefs: PlaceBrief[];
  directory: DistrictDirectoryArtifact | undefined;
  irrigationCurrent: IrrigationCurrentArtifact | undefined;
  groundwater: GroundwaterTaluksArtifact | undefined;
  projection: GroundwaterProjectionArtifact | undefined;
  rainfall: RainfallArtifact | undefined;
  jjm: JjmServiceShard[];
  census: CensusShard[];
  waterBodies: WaterBodiesShard[];
  briefShards: BriefsShard[];
  curated: CuratedBriefsArtifact | undefined;
  /** Optional: the Tamil Nadu fixtures predate the family. */
  environmentPlan?: EnvironmentPlanArtifact | undefined;
  asOf: string;
}

export function buildDistrictReading(inputs: DistrictReadingInputs): DistrictReading {
  const { district, aggregate, briefs, directory, groundwater, projection, asOf } = inputs;
  const blocks = blockReadings(aggregate, projection);
  const source = classifyIrrigation(aggregate.canalPercent, aggregate.wellPercent);
  // District-grain current mix, when served. Wells are tube/bore plus open
  // wells; the Census-derived BLOCK gradient below stays 2011 on purpose,
  // because the report carries no grain below the district.
  const current = inputs.irrigationCurrent;
  const decimal = (value: number): number => Number(value.toFixed(1));
  const currentShares = current
    ? {
        canal: decimal(
          current.bySource
            .filter((share) => share.key === "canals")
            .reduce((sum, share) => sum + share.percent, 0),
        ),
        well: decimal(
          current.bySource
            .filter((share) => share.key === "tube-bore-wells" || share.key === "open-wells")
            .reduce((sum, share) => sum + share.percent, 0),
        ),
      }
    : null;
  const currentMixLabel = current ? `${district.irrigationCurrentSource.label} ${current.edition}` : null;
  const categories = groundwaterReading(aggregate, groundwater, projection);
  const gapBlocks = blocks
    .filter((b) => b.tapPercent !== null && b.tapPercent < 99)
    .sort((a, b) => (a.tapPercent ?? 0) - (b.tapPercent ?? 0))
    .map((b) => ({
      name: b.name,
      tapPercent: b.tapPercent ?? 0,
      canalPercent: b.canalPercent,
      inDeficitTaluk: b.dominantCategory !== null && DEFICIT_CATEGORIES.has(b.dominantCategory),
    }));
  const signals: VerdictSignals = {
    source: currentShares ? classifyIrrigation(currentShares.canal, currentShares.well) : source,
    canalPercent: currentShares ? currentShares.canal : aggregate.canalPercent,
    wellPercent: currentShares ? currentShares.well : aggregate.wellPercent,
    taluks: aggregate.taluks.length,
    overExploited: categories.categories.over_exploited ?? 0,
    critical: categories.categories.critical ?? 0,
    semiCritical: categories.categories.semi_critical ?? 0,
    safe: categories.categories.safe ?? 0,
    tapPercent: aggregate.tapPercent,
    households: aggregate.households.value,
    gapBlocks,
    metturBasin: district.basin?.basinId === "cauvery-tn",
    currentMixLabel,
    unitLabel: categories.unitLabel,
    irrigationNextStep: district.irrigationCurrentSource.nextStep,
    environmentPlan: inputs.environmentPlan
      ? {
          label: `${inputs.environmentPlan.document.publisher.split(" and ")[0]}, ${inputs.environmentPlan.document.editionLabel}`,
          hasWaterBalance: inputs.environmentPlan.waterBalance !== null,
        }
      : null,
  };
  const verdict = composeDistrictVerdict(signals);

  const censusDescribes = directory?.vintages.census.sourceAsOf ?? "Census 2011";
  const jjmRetrieved = directory?.vintages.jjm.sourceAsOf ?? "unstated";
  const drinking = drinkingShares(briefs);
  const groundwaterShare = drinking.byCategory.find((s) => /ground/i.test(s.label));
  const surfaceShare = drinking.byCategory.find((s) => /surface/i.test(s.label));
  const topType = drinking.byType[0];
  // Headline facts are current readings only: the Season and Crop Report
  // mix when served (always first), the IN-GRES taluk balance and the JJM
  // register. The Census 2011 irrigation mix (reference year 2009) is a
  // labelled baseline in "what the district runs on", never the first
  // number a reader meets.
  const facts: HeadlineFact[] = [];
  if (current && currentShares && currentMixLabel && signals.source !== null) {
    const sharesText = current.bySource
      .map((share) => `${share.label.toLowerCase()} ${share.percent}%`)
      .join(", ");
    const supplementary =
      current.supplementaryWells.netHectares > 0
        ? ` Supplementary wells (${num(current.supplementaryWells.netHectares)} ha net) supplement other sources and are not additive.`
        : "";
    const mixFact =
      signals.source === "canal"
        ? { value: whole(currentShares.canal), label: "of irrigated farmland runs on canal water" }
        : signals.source === "well"
          ? { value: whole(currentShares.well), label: "of irrigated farmland is watered from wells" }
          : {
              value: `${whole(currentShares.canal)} / ${whole(currentShares.well)}`,
              label: "of irrigated farmland on canals / wells",
            };
    facts.push({
      ...mixFact,
      asOf: currentMixLabel,
      note: `${num(current.netAreaIrrigatedHectares)} ha net irrigated: ${sharesText}.${supplementary}`,
    });
  }
  if (aggregate.taluks.length > 0) {
    const deficit = signals.overExploited + signals.critical;
    facts.push({
      value: `${deficit} of ${aggregate.taluks.length}`,
      label: `${categories.unitLabel}s over-exploited or critical`,
      asOf: `IN-GRES ${aggregate.groundwaterAssessmentYear ?? ""}`.trim(),
      note:
        (categories.districtCategory
          ? `District stage of extraction ${formatExtractionStage(categories.districtStagePercent)}%, assessed ${categoryLabel(categories.districtCategory)}. `
          : "") + `Assessed per revenue ${categories.unitLabel}, not per block or Panchayat.`,
    });
  }
  if (aggregate.tapPercent !== null) {
    facts.push({
      value: pct(aggregate.tapPercent),
      label: "of households recorded with a tap",
      asOf: `JJM, read ${jjmRetrieved}`,
      note:
        `${num(aggregate.connections)} connections against ${num(aggregate.households.value)} households in ` +
        `${aggregate.households.places} Panchayats.` +
        (aggregate.tapPercent === 100 ? " Exactly 100.0% is read as reported complete, not measured." : ""),
    });
  }
  if (groundwaterShare && drinking.total > 0) {
    facts.push({
      value: pct(groundwaterShare.percent),
      label: "of drinking-water sources draw on groundwater",
      asOf: `JJM, read ${jjmRetrieved}`,
      note:
        `${num(drinking.total)} sources on the JJM register` +
        (topType ? `, ${num(topType.value)} of them ${topType.label.toLowerCase()}` : "") +
        `; ${surfaceShare ? num(surfaceShare.value) : 0} on surface water.`,
    });
  }
  if (facts.length < 3 && aggregate.waterBodyCount > 0) {
    const register = waterBodyRegisterOf(inputs.waterBodies);
    facts.push({
      value: num(aggregate.waterBodyCount),
      label: `water bodies in the ${register.label}`,
      asOf: `${register.register === "tngis" ? "TNGIS" : "Census of Water Bodies"}, read ${inputs.waterBodies[0]?.ext.atlas.acquiredAt ?? "unstated"}`,
      note:
        register.register === "tngis"
          ? `${num(aggregate.waterBodyAreaHectares)} ha of mapped waterspread in ${aggregate.waterBodyPlaces} Panchayats.`
          : `In ${aggregate.waterBodyPlaces} Panchayats, each assigned through the LGD's own village list.`,
    });
  }

  let drinkingSentence: string;
  if (drinking.total === 0) {
    drinkingSentence = "JJM records no drinking-water sources for the Panchayats here.";
  } else {
    const lead =
      signals.source === "canal" && groundwaterShare && groundwaterShare.percent >= 80
        ? "The district irrigates from the canal and drinks from the aquifer: "
        : "";
    drinkingSentence =
      `${lead}${groundwaterShare ? `${pct(groundwaterShare.percent)}` : "an unstated share"} of the ` +
      `${num(drinking.total)} drinking-water sources JJM records here draw on groundwater` +
      (topType ? ` (${num(topType.value)} of them ${topType.label.toLowerCase()}s)` : "") +
      (surfaceShare ? `, against ${num(surfaceShare.value)} on surface water.` : ".");
    drinkingSentence = drinkingSentence.charAt(0).toUpperCase() + drinkingSentence.slice(1);
  }

  const vintages: VintageRow[] = [];
  const push = (
    label: string,
    envelope: AtlasEnvelope | undefined,
    describes: string,
    retrieved: string | undefined,
    note: string,
  ) => {
    if (!envelope) return;
    vintages.push({
      label,
      describes,
      retrieved: retrieved ?? "unstated",
      produced: envelope.provenance.produced_at,
      historical: isHistorical(describes, asOf),
      note,
    });
  };
  if (directory && identityAdapterOf(directory) === "lgd-directory") {
    push(
      "Panchayat list and codes",
      directory,
      `LGD edition ${identityVintage(directory).sourceAsOf}`,
      identityVintage(directory).retrievedAt,
      "Local Government Directory (Ministry of Panchayati Raj) as republished on data.gov.in: the Panchayat list, its covered villages and the taluka list, refreshed monthly.",
    );
  } else {
    push(
      "Panchayat list and codes",
      directory,
      directory ? identityVintage(directory).sourceAsOf : "unstated",
      directory ? identityMasterVintage(directory).retrievedAt : undefined,
      "TNRD LGD directory, cross-checked against the current TNRD master on the retrieval date.",
    );
  }
  push(
    "Drinking-water service, sources, testing",
    inputs.jjm[0],
    `current at ${sourceOf(inputs.jjm[0])?.retrieved ?? jjmRetrieved}`,
    sourceOf(inputs.jjm[0])?.retrieved,
    "Jal Jeevan Mission citizen corner: habitations, tap connections, sources, sample rows.",
  );
  push(
    "Irrigation by source, district",
    current,
    currentMixLabel ?? "unstated",
    sourceOf(current)?.retrieved,
    "DES Season and Crop Report Table III-B: net area irrigated per source at district grain. The block gradient below stays Census 2011 until a taluk-grain source is wired.",
  );
  push(
    "Land, irrigation and seasonal sources",
    inputs.census[0],
    censusDescribes,
    sourceOf(inputs.census[0])?.retrieved,
    (current
      ? "Census 2011 village tables, the newest village-level irrigation enumeration served here. The Season and Crop Report district mix above is the current reading; the 2017-18 Minor Irrigation Census (wells and tanks by village) is not wired yet."
      : `Census 2011 village tables, the newest village-level irrigation enumeration served here. ${district.irrigationCurrentSource.gapNote}`) +
      (directory?.vintages.census.scope ? ` ${directory.vintages.census.scope}` : ""),
  );
  push(
    "Groundwater assessment",
    groundwater,
    groundwater?.assessmentYear ?? "unstated",
    sourceOf(groundwater)?.retrieved,
    `IN-GRES, assessed per revenue ${categories.unitLabel}. The year is the hydrological-year label.`,
  );
  push(
    "Groundwater projected to Panchayats",
    projection,
    projection?.assessmentYear ?? "unstated",
    projection?.projectedAt,
    projection?.projectionMethod === "administrative-membership"
      ? `Each Panchayat inherits its ${categories.unitLabel}'s category through the register's own membership.`
      : `Each Panchayat inherits its containing ${categories.unitLabel}'s category by spatial intersection.`,
  );
  push(
    "Rainfall",
    inputs.rainfall,
    inputs.rainfall ? `${inputs.rainfall.window.start} to ${inputs.rainfall.window.end}` : "unstated",
    sourceOf(inputs.rainfall)?.retrieved,
    "Open-Meteo reanalysis at a grid point inside each Panchayat, not a gauge.",
  );
  const waterBodyRegister = waterBodyRegisterOf(inputs.waterBodies);
  push(
    "Water bodies",
    inputs.waterBodies[0],
    waterBodyRegister.register === "tngis"
      ? "as mapped; the register carries no survey date"
      : "reference years 2017-18 to 2020-21, published 2023",
    sourceOf(inputs.waterBodies[0])?.retrieved,
    waterBodyRegister.register === "tngis"
      ? "TNGIS all-water-bodies register, counts and areas only."
      : "First Census of Water Bodies, assigned to each Panchayat through the LGD's own village list; counts, classes and points.",
  );
  push(
    "Panchayat briefs",
    inputs.briefShards[0],
    inputs.briefShards[0]?.assessedAt ?? "unstated",
    inputs.briefShards[0]?.assessedAt,
    "Generated from the families above; a place without identity, population and service stays directory-only.",
  );
  push(
    "Reviewed briefs",
    inputs.curated,
    inputs.curated ? `reviewed ${inputs.curated.provenance.produced_at}` : "unstated",
    inputs.curated?.provenance.produced_at,
    "Written by a person for the places named in them; preferred on those pages over the generated brief.",
  );
  push(
    "District Environment Plan",
    inputs.environmentPlan,
    inputs.environmentPlan
      ? `${inputs.environmentPlan.document.editionLabel} plan, dated ${inputs.environmentPlan.document.documentDate}`
      : "unstated",
    inputs.environmentPlan?.document.retrievedAt,
    "Transcribed from the published PDF with the page each figure sits on; nothing computed from it.",
  );

  return {
    slug: district.slug,
    districtName: aggregate.districtName,
    asOf,
    panchayatCount: aggregate.panchayatCount,
    blockCount: aggregate.blockCount,
    briefReady: briefs.filter((b) => b.status === "brief-ready").length,
    verdict,
    facts: facts.slice(0, 3),
    irrigation: {
      source,
      shares: irrigationShares(aggregate),
      irrigatedHectares: aggregate.irrigatedHectares,
      places: aggregate.landPlaces,
      describes: censusDescribes,
    },
    irrigationCurrent:
      current && currentMixLabel
        ? {
            edition: current.edition,
            label: currentMixLabel,
            netHectares: current.netAreaIrrigatedHectares,
            grossHectares: current.grossAreaIrrigatedHectares,
            moreThanOnceHectares: current.areaIrrigatedMoreThanOnceHectares,
            intensity: current.irrigationIntensity,
            shares: current.bySource.map((share) => ({
              key: share.key,
              label: share.label,
              value: share.netHectares,
              percent: share.percent,
            })),
            supplementaryWellsNote:
              current.supplementaryWells.netHectares > 0 ? current.supplementaryWells.note : null,
          }
        : null,
    drinking: {
      shares: drinking.byCategory,
      topTypes: drinking.byType.slice(0, 4),
      total: drinking.total,
      sentence: drinkingSentence,
      describes: `JJM, read ${jjmRetrieved}`,
    },
    mettur: metturReading(district, aggregate, blocks),
    groundwater: categories,
    blocks,
    blockFindings: blockFindings(aggregate, blocks, categories.unitLabel),
    waterBodies: waterBodiesReading(aggregate, inputs.waterBodies),
    environmentPlan: inputs.environmentPlan ? environmentPlanReading(inputs.environmentPlan) : null,
    vintages,
  };
}

/** The day a district's figures are dated to: the latest brief assessment,
 *  else the directory acquisition. Read from the artifacts, never typed. */
export function districtAsOf(
  briefShards: BriefsShard[],
  directory: DistrictDirectoryArtifact | undefined,
): string {
  return (
    latest(briefShards.map((s) => s.assessedAt)) ??
    directory?.acquiredAt ??
    directory?.provenance.produced_at ??
    "unstated"
  );
}

const cache = new Map<string, DistrictReading>();

export function getDistrictReading(stateSlug: string, districtSlug: string): DistrictReading | undefined {
  const district = findAtlasDistrict(stateSlug, districtSlug);
  if (!district) return undefined;
  const key = `${district.stateSlug}/${district.slug}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const briefShards = loadBriefShards(district);
  const directory = loadDirectory(district);
  const asOf = districtAsOf(briefShards, directory);
  const aggregate = getDistrictAggregate(stateSlug, districtSlug, asOf);
  if (!aggregate) return undefined;
  const built = buildDistrictReading({
    district,
    aggregate,
    briefs: getDistrictBriefs(district.slug),
    directory,
    irrigationCurrent: loadIrrigationCurrent(district),
    groundwater: loadGroundwaterTaluks(district),
    projection: loadGroundwaterProjection(district),
    rainfall: loadRainfall(district),
    jjm: loadJjmServiceShards(district),
    census: loadCensusShards(district),
    waterBodies: loadWaterBodyShards(district),
    briefShards,
    curated: district.hasCuratedBriefs
      ? readDistrictArtifact<CuratedBriefsArtifact>(district, "curated-briefs")
      : undefined,
    environmentPlan: loadEnvironmentPlan(district),
    asOf,
  });
  cache.set(key, built);
  return built;
}

/** Drop the built readings. */
export function clearDistrictReadingCache(): void {
  cache.clear();
}

// ─── River IDs ──────────────────────────────────────────────────────────────

/**
 * A river identifier. Historically a Chennai-only union of 4 literals;
 * widened to plain string so the same RiverData / RiverQualityData
 * shape can carry Madurai's vaigai / periyar / suruliyaru / ... and
 * future cities. ChennaiRiverId preserves the narrow union for
 * Chennai-specific call sites that need exhaustive typing.
 */
export type RiverId = string;

export const CHENNAI_RIVER_IDS = ["cooum", "adyar", "buckingham-canal", "kosasthalaiyar"] as const;
export type ChennaiRiverId = (typeof CHENNAI_RIVER_IDS)[number];

/** Backwards-compat alias - some Chennai code paths import RIVER_IDS. */
export const RIVER_IDS = CHENNAI_RIVER_IDS;

export function isChennaiRiverId(value: string): value is ChennaiRiverId {
  return (CHENNAI_RIVER_IDS as readonly string[]).includes(value);
}

/** Backwards-compat alias. */
export function isRiverId(value: string): boolean {
  return isChennaiRiverId(value);
}

// ─── Quality types ──────────────────────────────────────────────────────────

export type RiverQualityStatus =
  | "dead"
  | "severely_degraded"
  | "degraded"
  | "stressed"
  | "healthy";

export type MeasureRange = { min: number | null; max: number | null };
export type Measure = number | MeasureRange | null;

export interface RiverQualityReading {
  year: number;
  /** "YYYY-MM" for cities whose feed is genuinely monthly.
   *
   *  Every other city here is on CPCB's annual NWMP, so a yearly row is the
   *  true resolution of the data. Delhi is the exception: DPCC samples its
   *  Yamuna stations every month, and collapsing that to one row a year threw
   *  the extra resolution away - the chart showed a single point because all
   *  the captured months fell in one calendar year.
   *
   *  Optional on purpose: when absent the chart plots by year exactly as
   *  before, so annual cities are untouched. */
  month?: string | null;
  // A reading is either a POINT value (CPCB monthly / state-board sampling) or
  // an ANNUAL RANGE. CPCB's national NWMP tables publish min-max per station
  // per year, so a city built on that source carries ranges and we do not
  // invent a midpoint to flatten them. Renderers must handle both.
  do_mgl: Measure; // Dissolved oxygen mg/L
  bod_mgl: Measure; // Biochemical oxygen demand mg/L
  // CPCB NWMP publishes these as annual min-max too, exactly like DO and BOD.
  // They were left as `number` when Measure was introduced, so every renderer
  // treated a {min,max} object as a number: React refused to render one as a
  // child ("object with keys {min, max}", error #31) and the Hyderabad rivers
  // panel died on click. The type has to tell the truth or nothing downstream
  // can be correct.
  ph: Measure;
  conductivity_us: number | null; // µS/cm
  cod_mgl: number | null; // Chemical oxygen demand mg/L
  fecal_coliform_mpn: Measure; // Fecal coliform MPN/100ml
  /** Set when the published figure itself is disputed (e.g. the Mithi's
   *  2023 CPCB value, publicly flagged by Praja as a likely recording
   *  error). Rendered as a footnote under the FC tile - the number is
   *  shown as published, never silently corrected. */
  fecal_coliform_note?: string | null;
  tds_mgl: number | null; // Total dissolved solids mg/L
  nitrate_mgl: Measure; // Nitrate mg/L
  chromium_mgl: number | null; // Chromium mg/L (heavy metal)
  lead_mgl: number | null; // Lead mg/L (heavy metal)
  cadmium_mgl: number | null; // Cadmium mg/L (heavy metal)
}

export interface RiverStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stretch: string; // "Upper" | "Middle" | "Lower" | "Estuary" | etc.
  readings: RiverQualityReading[];
  /** True when the station coord sits more than ~2 km from the
   *  OSM-traced river LineString. Set by the snap step when
   *  re-curating Bangalore river stations: OSM does not trace
   *  Bangalore's rivers through built-up BBMP (they flow as storm
   *  drains), so KSPCB sampling stations at named city places end
   *  up far from any river polyline point. The map marker renders
   *  with a dashed border and the tooltip surfaces an off-polyline
   *  note when this flag is set. */
  off_osm_river_polyline?: boolean;
  /** Set when the station coord was moved by the snap step.
   *  Preserves the original named-place coordinate for audit. */
  lat_original?: number;
  lng_original?: number;
  snapped_to_river_polyline?: boolean;
  /** Distance in metres from the curated coord to the nearest OSM
   *  river polyline point, before any snap. Always reported for
   *  transparency. */
  osm_river_offset_m_before?: number;
  osm_river_offset_m_after?: number;
  /** Long-form explanation of why the marker sits off the OSM
   *  polyline. Set by snap-river-stations.py when
   *  off_osm_river_polyline is true. Kept out of `stretch` so the
   *  primary station label stays short. */
  osm_coverage_caveat?: string;
}

export interface RiverData {
  id: RiverId;
  name: string;
  name_ta: string;
  length_km: number;
  overall_status: RiverQualityStatus;
  cpcb_class: string;
  description: string;
  description_ta?: string;
  notes: string;
  notes_ta?: string;
  stations: RiverStation[];
}

export interface RiverQualityData {
  last_updated: string; // "YYYY-MM"
  data_year_range: [number, number];
  source: string;
  /** Optional override for the panel's source citation link. Cities whose
   *  canonical reference is a mirrored report (e.g. Bengaluru's CPCB PRS
   *  October-2025 PDF, self-hosted because the NMCG copy serves corrupted)
   *  set both; the shared panel falls back to the CPCB NWMP page. */
  source_url?: string;
  source_label?: string;
  rivers: RiverData[];
}

export interface SelectedRiver {
  riverId: RiverId;
  stationId?: string; // undefined = river-level click
  latlng: [number, number];
}

export const QUALITY_COLORS: Record<RiverQualityStatus, string> = {
  dead: "#dc2626",
  severely_degraded: "#f97316",
  degraded: "#a16207",
  stressed: "#4d7c0f",
  healthy: "#22c55e",
};

export const QUALITY_LABELS: Record<RiverQualityStatus, string> = {
  dead: "Dead",
  severely_degraded: "Severely Degraded",
  degraded: "Degraded",
  stressed: "Stressed",
  healthy: "Healthy",
};

// ─── Trend types & computation ───────────────────────────────────────────────

export type TrendDirection = "improving" | "worsening" | "stable" | "mixed";

export interface StationTrend {
  direction: TrendDirection;
  /** DO delta = latest − start_year value. Positive = oxygen rising = improving. */
  do_delta: number | null;
  /** BOD delta = latest − start_year value. Negative = pollution falling = improving. */
  bod_delta: number | null;
  start_year: number;
  end_year: number;
}

/**
 * Minimum absolute change considered meaningful (noise thresholds).
 * DO of 0.3 mg/L and BOD of 3 mg/L are approximately the smallest
 * year-on-year shifts that exceed typical CPCB measurement uncertainty
 * for highly polluted urban rivers.
 */
export const TREND_DO_THRESHOLD = 0.3;   // mg/L
export const TREND_BOD_THRESHOLD = 3;    // mg/L

/**
 * Compute a trend from the last 3 annual readings of a monitoring station.
 * Returns null when fewer than 3 data points are available.
 *
 * Per-metric direction rules:
 *   DO  ↑ (delta ≥  DO_THRESHOLD)  → improving  (more oxygen = better)
 *   DO  ↓ (delta ≤ −DO_THRESHOLD)  → worsening
 *   BOD ↓ (delta ≤ −BOD_THRESHOLD) → improving  (less pollution = better)
 *   BOD ↑ (delta ≥  BOD_THRESHOLD) → worsening
 *   Within threshold               → stable
 *
 * Combined direction:
 *   any improving + any worsening → "mixed"
 *   any worsening (no improving)  → "worsening"
 *   any improving (no worsening)  → "improving"
 *   all stable                    → "stable"
 */
export function computeStationTrend(
  readings: RiverQualityReading[]
): StationTrend | null {
  const sorted = [...readings]
    .filter((r) => r.do_mgl !== null || r.bod_mgl !== null)
    .sort((a, b) => a.year - b.year);

  if (sorted.length < 3) return null;

  const latest = sorted[sorted.length - 1];
  const twoYearsAgo = sorted[sorted.length - 3];

  // Trends compare the threshold-relevant end of each reading, so a city on
  // annual ranges (CPCB NWMP) trends on like-for-like rather than on a mix of
  // range and point.
  const worst = (m: Measure, k: "lower-is-worse" | "higher-is-worse"): number | null => {
    if (m == null) return null;
    if (typeof m === "number") return m;
    const lo = typeof m.min === "number" ? m.min : null;
    const hi = typeof m.max === "number" ? m.max : null;
    if (lo == null && hi == null) return null;
    return k === "lower-is-worse" ? (lo ?? hi) : (hi ?? lo);
  };
  const dLatest = worst(latest.do_mgl, "lower-is-worse");
  const dPrev = worst(twoYearsAgo.do_mgl, "lower-is-worse");
  const bLatest = worst(latest.bod_mgl, "higher-is-worse");
  const bPrev = worst(twoYearsAgo.bod_mgl, "higher-is-worse");

  const do_delta =
    dLatest !== null && dPrev !== null ? +(dLatest - dPrev).toFixed(2) : null;

  const bod_delta =
    bLatest !== null && bPrev !== null ? +(bLatest - bPrev).toFixed(1) : null;

  type Signal = "improving" | "worsening" | "stable";

  const doSignal: Signal | null =
    do_delta === null ? null
    : do_delta >= TREND_DO_THRESHOLD ? "improving"
    : do_delta <= -TREND_DO_THRESHOLD ? "worsening"
    : "stable";

  const bodSignal: Signal | null =
    bod_delta === null ? null
    : bod_delta <= -TREND_BOD_THRESHOLD ? "improving"
    : bod_delta >= TREND_BOD_THRESHOLD ? "worsening"
    : "stable";

  const signals = [doSignal, bodSignal].filter((s): s is Signal => s !== null);
  if (signals.length === 0) return null;

  const hasImproving = signals.includes("improving");
  const hasWorsening = signals.includes("worsening");

  const direction: TrendDirection =
    hasImproving && hasWorsening ? "mixed"
    : hasWorsening ? "worsening"
    : hasImproving ? "improving"
    : "stable";

  return {
    direction,
    do_delta,
    bod_delta,
    start_year: twoYearsAgo.year,
    end_year: latest.year,
  };
}

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

export interface RiverQualityReading {
  year: number;
  do_mgl: number | null; // Dissolved oxygen mg/L
  bod_mgl: number | null; // Biochemical oxygen demand mg/L
  ph: number | null;
  conductivity_us: number | null; // µS/cm
  cod_mgl: number | null; // Chemical oxygen demand mg/L
  fecal_coliform_mpn: number | null; // Fecal coliform MPN/100ml
  /** Set when the published figure itself is disputed (e.g. the Mithi's
   *  2023 CPCB value, publicly flagged by Praja as a likely recording
   *  error). Rendered as a footnote under the FC tile - the number is
   *  shown as published, never silently corrected. */
  fecal_coliform_note?: string | null;
  tds_mgl: number | null; // Total dissolved solids mg/L
  nitrate_mgl: number | null; // Nitrate mg/L
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

  const do_delta =
    latest.do_mgl !== null && twoYearsAgo.do_mgl !== null
      ? +(latest.do_mgl - twoYearsAgo.do_mgl).toFixed(2)
      : null;

  const bod_delta =
    latest.bod_mgl !== null && twoYearsAgo.bod_mgl !== null
      ? +(latest.bod_mgl - twoYearsAgo.bod_mgl).toFixed(1)
      : null;

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

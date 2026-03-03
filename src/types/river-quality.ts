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
}

export interface RiverStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stretch: string; // "Upper" | "Middle" | "Lower" | "Estuary" | etc.
  readings: RiverQualityReading[];
}

export interface RiverData {
  id: string;
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
  riverId: string;
  stationId?: string; // undefined = river-level click
  latlng: [number, number];
}

export const QUALITY_COLORS: Record<RiverQualityStatus, string> = {
  dead: "#dc2626",
  severely_degraded: "#f97316",
  degraded: "#eab308",
  stressed: "#84cc16",
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

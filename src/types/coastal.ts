/**
 * Types for the Chennai coastal shoreline-change layer (/coastal).
 *
 * The geometry + numbers currently come from a SEED layer
 * (public/geojson/chennai-coastal-zones.geojson +
 * chennai-coastal-hotspots.geojson): OpenStreetMap coastline split into the
 * six study zones, carrying the published per-zone rates from
 *
 *   Anagha, Singh & Frappart (2026), "Shoreline and salinity shifts along
 *   the Chennai coast", Environmental Challenges.
 *
 * When the CoastSat + DSAS pipeline (neer-vazhvu-api/app/gee/coastline.py)
 * is run, it emits a transect layer with `source: "computed"` that
 * supersedes the seed. The `source` field lets the UI label provenance.
 */

export type CoastalTrend = "erosion" | "accretion" | "mixed" | "stable";
export type CoastalSource = "study-reported" | "computed";

export interface CoastalZoneProperties {
  zone_id: string; // "S" (extension) or "I" .. "VI" (study)
  zone_name: string;
  length_km: number;
  /** Study per-zone mean erosion rate (m/yr). null for the "S" extension,
   *  which is beyond the study and has no published rate. */
  mean_erosion_m_yr: number | null;
  dominant_trend: CoastalTrend;
  summary: string;
  source: CoastalSource;
  source_label: string;
  source_url: string;
  period: string;
}

export interface CoastalHotspotProperties {
  name: string;
  zone_id: string;
  /** Signed rate: negative = erosion (retreat), positive = accretion (gain). */
  rate_m_yr: number;
  trend: Extract<CoastalTrend, "erosion" | "accretion">;
  note: string;
  source: CoastalSource;
  source_label: string;
  source_url: string;
  period: string;
}

/** One computed DSAS transect (our own MNDWI/GEE measurement). */
export interface CoastalTransectProperties {
  transect_id: number;
  zone_id: string;
  /** WLR rate, m/yr. Negative = erosion, positive = accretion. */
  rate_m_yr: number;
  epr_m_yr: number | null;
  r_squared: number | null;
  n_epochs: number;
  trend: Extract<CoastalTrend, "erosion" | "accretion" | "stable">;
  /** Net shoreline movement (m) vs the earliest epoch, per measured year. */
  series: [number, number][] | null;
  /** WLR over the early half (1990-2010) and recent half (2015-2026), m/yr. */
  early_rate_m_yr: number | null;
  recent_rate_m_yr: number | null;
  /** "low" where the shoreline is ambiguous (river/creek mouth, lagoon) and the
   *  per-epoch waterline can snap to a different feature - dimmed, never led with. */
  confidence: "high" | "low";
  /** true on the one clean, strong eroder the UI pre-selects on load. */
  showcase?: boolean;
  source: "computed";
  period: string;
}

export type AccelStatus =
  | "erosion-accelerating"
  | "erosion-slowing"
  | "accretion-accelerating"
  | "accretion-slowing"
  | "reversed"
  | "steady"
  | "unknown";

/**
 * Compare the recent-half rate to the early-half rate to say whether the
 * shoreline trend is accelerating. Threshold of 1 m/yr avoids over-reading
 * noise from the coarse fixed-threshold method.
 */
export function accelStatus(
  early: number | null,
  recent: number | null,
): AccelStatus {
  if (early == null || recent == null) return "unknown";
  const delta = recent - early; // more negative = eroding faster
  const T = 1.0;
  const eroding = recent < -0.5;
  const accreting = recent > 0.5;
  if (eroding && early >= 0 && Math.abs(delta) > T) return "reversed";
  if (accreting && early <= 0 && Math.abs(delta) > T) return "reversed";
  if (eroding) return delta < -T ? "erosion-accelerating" : delta > T ? "erosion-slowing" : "steady";
  if (accreting) return delta > T ? "accretion-accelerating" : delta < -T ? "accretion-slowing" : "steady";
  return "steady";
}

export const ACCEL_LABELS: Record<AccelStatus, string> = {
  "erosion-accelerating": "Erosion accelerating",
  "erosion-slowing": "Erosion slowing",
  "accretion-accelerating": "Accretion accelerating",
  "accretion-slowing": "Accretion slowing",
  reversed: "Trend reversed",
  steady: "Steady rate",
  unknown: "Not enough data",
};

export type SelectedCoastal =
  | { kind: "zone"; props: CoastalZoneProperties }
  | { kind: "hotspot"; props: CoastalHotspotProperties }
  | { kind: "transect"; props: CoastalTransectProperties };

/** Trend -> colour for zone lines and legend swatches. */
export const TREND_COLORS: Record<CoastalTrend, string> = {
  erosion: "#dc2626", // red-600
  accretion: "#2563eb", // blue-600 (land gain, but port-driven = not "good")
  mixed: "#d97706", // amber-600
  stable: "#16a34a", // green-600 (the conservation/turtle sector)
};

export const TREND_LABELS: Record<CoastalTrend, string> = {
  erosion: "Erosion (retreat)",
  accretion: "Accretion (gain)",
  mixed: "Mixed",
  stable: "Stable",
};

/** Colour a hotspot by the sign of its rate. */
export function hotspotColor(rate: number): string {
  return rate < 0 ? TREND_COLORS.erosion : TREND_COLORS.accretion;
}

/**
 * Diverging colour for a computed transect rate (m/yr): red erosion ->
 * slate stable -> blue accretion, saturating around +/-6 m/yr.
 */
export function rateColor(rate: number): string {
  if (rate <= -6) return "#991b1b"; // red-800
  if (rate <= -2) return "#dc2626"; // red-600
  if (rate <= -0.5) return "#f87171"; // red-400
  if (rate < 0.5) return "#94a3b8"; // slate-400 (stable)
  if (rate < 2) return "#60a5fa"; // blue-400
  if (rate < 6) return "#2563eb"; // blue-600
  return "#1e3a8a"; // blue-900
}

/** Aggregate the map computes from the computed-transect layer for the header. */
export interface CoastalSummary {
  total: number;
  eroding: number;
  erodingWithSplit: number;
  acceleratingErosion: number;
  period: string;
  /** Clean, strongly-eroding transect pre-selected on load (the pipeline's
   *  showcase pick, or the worst high-confidence as fallback). */
  featured: CoastalTransectProperties | null;
}

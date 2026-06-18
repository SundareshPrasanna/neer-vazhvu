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
  zone_id: string; // "I" .. "VI"
  zone_name: string;
  length_km: number;
  /** Study per-zone mean erosion rate (m/yr, positive magnitude). */
  mean_erosion_m_yr: number;
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
  source: "computed";
  period: string;
}

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

export type CoastalViewMode = "zones" | "transects";

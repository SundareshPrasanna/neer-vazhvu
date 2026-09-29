/**
 * Cities whose ward rankings come from a pre-baked ward-risk-<city>.json
 * (composite_score is risk: higher = worse). Chennai is the one city computed
 * live from its ward profiles instead.
 *
 * Adding a city: produce public/data/ward-risk-<city>.json with ward_number,
 * ward_name, zone, composite_score, grade and the metric fields named below,
 * then declare its three table columns and source line here.
 *
 * Free of `fs` so the client can import the membership set via ./cities.
 */

export interface RankingColumnSpec {
  /** Field in the ward-risk row, also the column's sort key. */
  key: string;
  label: string;
  /** Display for a present value; a null value always renders "-" (no reading
   *  is not the same as a reading of zero). */
  format: (v: number) => string;
}

export interface PrebakedRankingSpec {
  columns: RankingColumnSpec[];
  sourceLabel: (algorithmVersion: string) => string;
}

const metres = (v: number) => `${v.toFixed(1)} m`;
const perSqKm = (v: number) => `${v.toFixed(2)} /km²`;

export const PREBAKED_RANKING_SPECS: Readonly<Record<string, PrebakedRankingSpec>> = {
  madurai: {
    columns: [
      { key: "gw_depth_m", label: "Groundwater depth", format: metres },
      { key: "wb_density_per_sqkm", label: "Water-body density", format: perSqKm },
      { key: "wb_health_score", label: "Water-body health", format: (v) => v.toFixed(0) },
    ],
    sourceLabel: (v) =>
      `Pre-baked ${v} composite from public/data/ward-risk-madurai.json (groundwater depth, water-body density, water-body health)`,
  },
  // Equity-first model (scripts/compute-mumbai-ward-risk.py); Mumbai is outside
  // the CGWB assessment, so per-ward supply hours (Praja 2024) lead.
  mumbai: {
    columns: [
      { key: "supply_hours", label: "Water supply (hrs/day)", format: (v) => `${v.toFixed(1)} h` },
      { key: "flood_hotspot_count", label: "Chronic flood spots", format: String },
      { key: "slum_area_share", label: "Slum-area share", format: (v) => `${Math.round(v * 100)}%` },
    ],
    sourceLabel: (v) =>
      `Pre-baked ${v} equity composite from public/data/ward-risk-mumbai.json (per-ward water-supply hours from Praja 2024, chronic flood spots, Priority-I river burden)`,
  },
  // Groundwater + equity (scripts/compute-delhi-ward-risk.py). Wards with no
  // CGWB well within 4 km keep gw_depth_m null and are scored on the rest.
  delhi: {
    columns: [
      { key: "gw_depth_m", label: "Groundwater depth", format: metres },
      { key: "jj_households_per_1000", label: "JJ households / 1,000", format: (v) => v.toFixed(0) },
      { key: "flood_hotspots", label: "Chronic flood spots", format: String },
    ],
    sourceLabel: (v) =>
      `Pre-baked ${v} composite from public/data/ward-risk-delhi.json (measured CGWB well depth, district extraction stage, DUSIB JJ-basti household share, chronic flood spots, water-body density)`,
  },
  // V0 (scripts/compute-bangalore-ward-risk.py): population density, OSM
  // water-body density, flagship-kere flag; no per-ward groundwater yet.
  bangalore: {
    columns: [
      { key: "wb_density_per_sqkm", label: "Water-body density", format: perSqKm },
      { key: "wb_health_score", label: "Flagship-kere flag", format: (v) => (v >= 100 ? "Flagship" : "—") },
      { key: "gw_depth_m", label: "Groundwater depth", format: metres },
    ],
    sourceLabel: (v) =>
      `Pre-baked ${v} composite from public/data/ward-risk-bangalore.json (population density, OSM water-body density per ward, flagship-kere flag). Per-ward groundwater depth + IISc 65 stress-ward overlay are roadmap follow-ups.`,
  },
};

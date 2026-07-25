export interface GroundwaterWard {
  wardNumber: number;
  wardName: string;
  wardNameTa?: string;
  zone: string;
  depthM: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export interface GroundwaterApiResponse {
  period: { year: number; month: number };
  cityAverage: number | null;
  wards: GroundwaterWard[];
  summary: {
    healthy: number;    // 0-3m
    moderate: number;   // 3-6m
    declining: number;  // 6-10m
    stressed: number;   // 10-15m
    critical: number;   // 15-25m
    crisis: number;     // >25m
    noData: number;
  };
}

export type GroundwaterStatus =
  | 'healthy'
  | 'moderate'
  | 'declining'
  | 'stressed'
  | 'critical'
  | 'crisis'
  | 'noData';

export function getGroundwaterStatus(depthM: number | null): GroundwaterStatus {
  if (depthM === null) return 'noData';
  if (depthM <= 3) return 'healthy';
  if (depthM <= 6) return 'moderate';
  if (depthM <= 10) return 'declining';
  if (depthM <= 15) return 'stressed';
  if (depthM <= 25) return 'critical';
  return 'crisis';
}

export interface WardHistoryPoint {
  year: number;
  month: number;
  date: string;    // "YYYY-MM"
  depthM: number | null;
}

export interface WardHistoryResponse {
  wardNumber: number;
  wardName: string;
  history: WardHistoryPoint[];
}

export function getGroundwaterColor(depthM: number | null): string {
  if (depthM === null) return '#9ca3af';
  if (depthM <= 3) return '#22c55e';
  if (depthM <= 6) return '#84cc16';
  if (depthM <= 10) return '#eab308';
  if (depthM <= 15) return '#f97316';
  if (depthM <= 25) return '#ef4444';
  return '#7f1d1d';
}

// ── Risk score types ────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'noData';

export type ViewMode = 'depth' | 'risk' | 'exploitation' | 'iisc';

export interface WardRiskData {
  wardNumber: number;
  riskScore: number;
  riskLevel: RiskLevel;
  groundwaterComponent: number | null;
  trendComponent: number | null;
  reservoirComponent: number | null;
  seasonalComponent: number | null;
}

export interface RiskApiResponse {
  computedDate: string;
  wards: WardRiskData[];
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e';
    case 'moderate': return '#eab308';
    case 'high': return '#f97316';
    case 'critical': return '#dc2626';
    default: return '#9ca3af';
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'Low Risk';
    case 'moderate': return 'Moderate Risk';
    case 'high': return 'High Risk';
    case 'critical': return 'Critical';
    default: return 'No Data';
  }
}

// ── WRIS / CGWB block-level groundwater resource types ────────────────────────

export type GWBlockClass = "Safe" | "Semi Critical" | "Critical" | "Over Exploited";

export interface GWBlockHistory {
  year: number;
  /** Display label for the assessment cycle in the SOURCE's own vocabulary
   *  (IN-GRES hydrological labels like "2023-24"). `year` stays the numeric
   *  end-year for sorting; when year_label is present the UI renders it -
   *  prevents the "which 2023?" confusion between portal and app. */
  year_label?: string;
  class: GWBlockClass;
  development_pct: number;
  availability_ham: number | null;
  draft_total_ham: number | null;
}

export interface GWBlock {
  name: string;
  /** Overrides the generic "CGWB changed block boundaries" caveat shown
   *  under a short history. The default text describes compound-block
   *  splits (Bengaluru/Chennai); cities whose series is short for another
   *  reason (Delhi: annual assessment only began 2021-22, and the unit
   *  changed from tehsil to district) must state their own reason. */
  history_caveat?: string;
  history: GWBlockHistory[];
  latest: {
    class: GWBlockClass;
    development_pct: number;
    availability_ham: number | null;
    draft_total_ham: number | null;
  };
}

export interface GWRData {
  source: string;
  source_url: string;
  fetched_at: string;
  years: number[];
  blocks: GWBlock[];
}

export interface GWStation {
  name: string;
  lat: number;
  lng: number;
  agency: string;
  block: string;
  station_code: string;
  data_types: string;
}

export interface GWStationsData {
  source: string;
  fetched_at: string;
  stations: GWStation[];
}

// ── WRIS / CGWB live station readings (India WRIS API) ───────────────────────

/**
 * Data quality flag computed by the `groundwater_wris_latest` view:
 * - stuck:   Telemetric sensor has effectively stopped moving (range < 10cm
 *            over last 60 days with at least 5 readings). Treat the latest
 *            value as suspect, likely hardware failure or recalibration.
 * - stale:   Telemetric station not reporting for >14d, or Manual station
 *            not resurveyed for >180d.
 * - ok:      Station is operating as expected.
 * - unknown: Not enough data to judge.
 */
export type WrisDataQualityFlag = "ok" | "stuck" | "stale" | "unknown";

export interface WrisStation {
  stationCode: string;
  stationName: string;
  latitude: number | null;
  longitude: number | null;
  latestDate: string;     // YYYY-MM-DD
  latestDepthM: number;   // negative = below ground (depth to water)
  acquisitionMode: string; // "Manual" | "Telemetric"
  wellType: string | null;         // "Dug Well", "Bore Well", "Piezometer", etc.
  wellDepthM: number | null;       // Total well depth in metres
  wellAquiferType: string | null;  // "Unconfined", "Confined", "Semi-Confined"
  recentCount: number | null;      // Number of readings in the last 60 days
  recentRangeM: number | null;     // Max-min depth over the last 60 days
  dataQualityFlag: WrisDataQualityFlag | null;
}

export interface WrisStationsResponse {
  stations: WrisStation[];
  totalStations: number;
}

export interface WrisStationReading {
  date: string;     // YYYY-MM-DD
  depthM: number;   // negative = below ground
}

export interface WrisStationHistoryResponse {
  station: {
    stationCode: string;
    stationName: string;
    latitude: number | null;
    longitude: number | null;
    acquisitionMode: string;
    wellType: string | null;
    wellDepthM: number | null;
    wellAquiferType: string | null;
    recentCount: number | null;
    recentRangeM: number | null;
    dataQualityFlag: WrisDataQualityFlag | null;
  } | null;
  readings: WrisStationReading[];
}

/* ── CGWB Year Book stations ───────────────────────────────────────────
   Quarterly depth-to-water-level readings (May/Aug/Nov/Jan) sourced from
   CGWB's annual State Ground Water Year Books. Distinct from the WRIS
   live-station network: these are static, peer-reviewed snapshots that
   we ingest year-by-year. Used in cities (currently Madurai) where the
   live WRIS network is too sparse for an honest IDW interpolation, so
   we surface CGWB stations as the authoritative point overlay instead.
   Source file shape: public/data/<city>-cgwb-stations.json. */

export interface CgwbStationReading {
  year: number;
  month: number;        // 1-12
  depth_m_bgl: number;  // metres below ground level (positive)
  year_book: string;    // e.g. "2024-25"
  _note?: string;
}

/* Major-ion chemistry for a CGWB well, from the state groundwater-quality
   report (Annexure IX, pre-monsoon sampling). EC in uS/cm; ions in mg/l;
   arsenic and uranium in ug/l. All fields optional - only a subset of wells
   are sampled for quality, and trace metals (Fe/As/U) are reported per well
   only where above detection. */
export interface CgwbStationQuality {
  ph?: number;
  ec_us_cm?: number;
  tds_mg_l?: number;
  hardness_mg_l?: number;
  calcium_mg_l?: number;
  magnesium_mg_l?: number;
  sodium_mg_l?: number;
  bicarbonate_mg_l?: number;
  chloride_mg_l?: number;
  sulphate_mg_l?: number;
  nitrate_mg_l?: number;
  fluoride_mg_l?: number;
  iron_mg_l?: number;
  arsenic_ug_l?: number;
  uranium_ug_l?: number;
}

export interface CgwbStation {
  name: string;
  lat: number;
  lng: number;
  block: string;
  block_inferred?: boolean;
  readings: CgwbStationReading[];
  quality?: CgwbStationQuality;
}

export interface CgwbStationsFile {
  district: string;
  well_type: string;
  aquifer: string;
  depth_unit: string;
  source_label?: string;
  source_url?: string;
  quality_note?: string;
  year_book_summaries: Array<{
    year_book: string;
    report_id?: string;
    publication_date?: string;
    publisher?: string;
    source_url?: string;
    source_index_url?: string;
    annual_fluctuation_madurai?: Record<string, unknown>;
    statewide_context?: Record<string, string>;
  }>;
  wells: CgwbStation[];
}

const BLOCK_CLASS_COLORS: Record<GWBlockClass, string> = {
  "Safe": "#22c55e",
  "Semi Critical": "#eab308",
  "Critical": "#f97316",
  "Over Exploited": "#dc2626",
};

export function getBlockClassColor(cls: string): string {
  return BLOCK_CLASS_COLORS[cls as GWBlockClass] || "#94a3b8";
}

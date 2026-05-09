/**
 * A reservoir source code. Historically a Chennai-only enum; widened to
 * string so the same ReservoirSummary / ReservoirCards components can
 * carry Madurai's vaigai / mullaperiyar / sothuparai (and future cities)
 * without a per-city type fork. ChennaiReservoirName preserves the narrow
 * union for Chennai-specific code paths (CMWSSB scraper, RESERVOIR_METADATA
 * keyed lookup, i18n display name table).
 */
export type ReservoirName = string;

export type ChennaiReservoirName =
  | 'poondi'
  | 'cholavaram'
  | 'redhills'
  | 'chembarambakkam'
  | 'veeranam'
  | 'kannankottai';

export interface ReservoirReading {
  reservoir: ReservoirName;
  date: string;
  current_level_ft: number | null;
  current_storage_mcft: number;
  capacity_mcft: number;
  storage_pct: number;
  inflow_cusecs: number;
  outflow_cusecs: number;
  rainfall_mm: number;
}

export interface ReservoirMeta {
  reservoir: ReservoirName;
  display_name: string;
  full_capacity_mcft: number;
  full_tank_level_ft: number | null;
  latitude: number;
  longitude: number;
  catchment_area_sqkm: number | null;
}

export interface ReservoirSummary {
  name: ReservoirName;
  displayName: string;
  currentStorage: number;
  capacity: number;
  storagePct: number;
  inflowCusecs: number;
  outflowCusecs: number;
  rainfallMm: number;
  /** False when the city's config registers this reservoir but no live
   *  measurement is published for it (e.g. Madurai's Sothuparai Dam -
   *  TWAD doesn't publish daily levels). The card UI treats `false`
   *  differently from a real-zero reading: it shows a "data not
   *  available" treatment rather than a misleading 0% storage bar.
   *  Defaults to true for back-compat - existing callers that build a
   *  summary from a live reading don't have to set it. */
  isLive?: boolean;
  /** Optional human-readable note explaining the data gap when
   *  `isLive` is false (one short sentence, surfaced in the card). */
  noLiveDataReason?: string;
}

export interface HistoryPoint {
  date: string;
  totalStorage: number;
  totalInflow?: number;   // cusecs (summed across reservoirs for combined view)
  totalOutflow?: number;  // cusecs
}

export interface ReservoirApiResponse {
  lastUpdated: string;
  reservoirs: ReservoirSummary[];
  totals: {
    currentStorage: number;
    capacity: number;
    storagePct: number;
  };
  history: HistoryPoint[];
}

/**
 * Per-source historical reading (one TMC/percent value per date).
 */
export interface HistorySeriesPoint {
  date: string;
  storage_tmc: number | null;
  storage_pct_frl: number | null;
}

export interface HistorySeries {
  source_code: string;
  display_name: string;
  full_capacity_mcft: number | null;
  full_tank_level_ft: number | null;
  is_primary: boolean;
  points: HistorySeriesPoint[];
}

/**
 * Per-source forecast (one prediction with 80% confidence band per target date).
 */
export interface ForecastSeriesPoint {
  date: string;
  predicted_tmc: number;
  lower_tmc: number;
  upper_tmc: number;
}

export interface ForecastSeries {
  source_code: string;
  forecast_date: string;
  model_name: string;
  points: ForecastSeriesPoint[];
}

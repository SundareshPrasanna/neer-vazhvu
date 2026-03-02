export type ReservoirName =
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

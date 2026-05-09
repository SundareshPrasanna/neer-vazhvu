import type { ChennaiReservoirName } from '@/types/reservoir';

/** Conversion factor: 1 MLD (million litres per day) = 0.0353147 mcft (million cubic feet) */
export const MLD_TO_MCFT = 0.0353147;

/** Conversion factor: 1 cusec flowing for 24 hours = 0.0864 mcft */
export const CUSEC_DAY_TO_MCFT = 0.0864;

/** Default daily water consumption for Chennai in MLD */
export const DEFAULT_CONSUMPTION_MLD = 830;

/** Default desalination output in MLD (Minjur 100 + Nemmeli 100) */
export const DEFAULT_DESALINATION_MLD = 190;

/** Chennai centroid coordinates */
export const CHENNAI_CENTER = {
  lat: 13.0827,
  lng: 80.2707,
} as const;

/** Day Zero reference data from 2019 crisis */
export const DAY_ZERO_2019 = {
  date: '2019-06-19',
  totalStorageMcft: 19.0,
} as const;

/** Total capacity of the 4 major drinking water reservoirs in mcft (Poondi + Cholavaram + Red Hills + Chembarambakkam) */
export const MAJOR_RESERVOIR_CAPACITY_MCFT = 3231.0 + 1081.0 + 3300.0 + 3645.0; // 11,257

/** Total capacity including all 6 reservoirs per CMWSSB lake level page (Apr 2026) */
export const TOTAL_RESERVOIR_CAPACITY_MCFT = 3231.0 + 1081.0 + 3300.0 + 3645.0 + 500.0 + 1465.0; // 13,222

/** Reservoir display order  -  largest capacity first */
export const RESERVOIR_DISPLAY_ORDER = [
  'chembarambakkam',
  'redhills',
  'poondi',
  'veeranam',
  'kannankottai',
  'cholavaram',
] as const;

export const RESERVOIR_METADATA: Record<
  ChennaiReservoirName,
  {
    displayName: string;
    fullCapacityMcft: number;
    fullTankLevelFt: number | null;
    latitude: number;
    longitude: number;
    catchmentAreaSqkm: number | null;
  }
> = {
  poondi: {
    displayName: 'Poondi',
    fullCapacityMcft: 3231.0,
    fullTankLevelFt: 36.0,
    latitude: 13.3542,
    longitude: 80.0678,
    catchmentAreaSqkm: 2530.0,
  },
  cholavaram: {
    displayName: 'Cholavaram',
    fullCapacityMcft: 1081.0,
    fullTankLevelFt: 22.0,
    latitude: 13.2184,
    longitude: 80.1499,
    catchmentAreaSqkm: 77.4,
  },
  redhills: {
    displayName: 'Red Hills (Puzhal)',
    fullCapacityMcft: 3300.0,
    fullTankLevelFt: 48.5,
    latitude: 13.171,
    longitude: 80.1811,
    catchmentAreaSqkm: 60.3,
  },
  chembarambakkam: {
    displayName: 'Chembarambakkam',
    fullCapacityMcft: 3645.0,
    fullTankLevelFt: 24.0,
    latitude: 12.9517,
    longitude: 80.0551,
    catchmentAreaSqkm: 71.6,
  },
  veeranam: {
    displayName: 'Veeranam',
    fullCapacityMcft: 1465.0,
    fullTankLevelFt: null,
    latitude: 11.35,
    longitude: 79.54,
    catchmentAreaSqkm: null,
  },
  kannankottai: {
    displayName: 'Kannankottai (TK)',
    fullCapacityMcft: 500.0,
    fullTankLevelFt: null,
    latitude: 12.82,
    longitude: 79.98,
    catchmentAreaSqkm: null,
  },
};

/** Maps various CMWSSB names to our canonical reservoir names */
export const RESERVOIR_NAME_MAP: Record<string, string> = {
  poondi: 'poondi',
  cholavaram: 'cholavaram',
  puzhal: 'redhills',
  'red hills': 'redhills',
  chembarambakkam: 'chembarambakkam',
  veeranam: 'veeranam',
  kannankottai: 'kannankottai',
  'thervoy kandigai': 'kannankottai',
};

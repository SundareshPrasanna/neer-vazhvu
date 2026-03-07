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

/** Total capacity of the 4 major drinking water reservoirs in mcft */
export const MAJOR_RESERVOIR_CAPACITY_MCFT = 3231.0 + 881.0 + 3300.0 + 3645.0; // 11,057

/** Total capacity including all 6 reservoirs */
export const TOTAL_RESERVOIR_CAPACITY_MCFT = 3231.0 + 881.0 + 3300.0 + 3645.0 + 1465.0 + 1574.0; // 14,096

/** Reservoir display order — largest capacity first */
export const RESERVOIR_DISPLAY_ORDER = [
  'chembarambakkam',
  'redhills',
  'poondi',
  'cholavaram',
] as const;

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

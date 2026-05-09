import type { CityConfig } from './types';

export const MADURAI: CityConfig = {
  placeKind: 'city',
  cityId: 'madurai',
  displayName: 'Madurai',
  stateCode: 'TN',
  timezone: 'Asia/Kolkata',
  center: { lat: 9.9252, lng: 78.1198 },
  bbox: { south: 9.85, north: 10.0, west: 78.05, east: 78.2 },
  primaryAuthority: {
    code: 'mmc',
    name: 'Madurai Municipal Corporation',
    acronym: 'MMC',
  },
  localGovernment: {
    code: 'mmc',
    name: 'Madurai Municipal Corporation',
    acronym: 'MMC',
    wardCount: 100,
  },
  defaultConsumptionMld: 135,
  defaultDesalinationMld: null,
  // Madurai's tracked dams are irrigation-primary (Vaigai is shared
  // across Madurai/Theni/Sivagangai/Ramanathapuram for fields,
  // Mullaperiyar is Kerala-side basin storage). Chennai's days-left
  // headline math (storage / demand) is honest there because CMWSSB
  // reservoirs ARE the city's tap; here it would overstate runway by
  // an order of magnitude. Use the allocation hero instead, anchored
  // on MMC's published Vaigai drinking-water allocation.
  heroMode: 'allocation',
  urbanSupply: {
    allocatedSourceCodes: ['vaigai'],
    annualAllocationMcft: 1500,
    recentDrawMcft: 900,
    wtpCapacityMld: 125,
    wtpName: 'Pannaipatty WTP',
    supplyChainDescription:
      'Mullaperiyar Dam (Kerala) → Vaigai Dam → Pannaipatty WTP → MMC distribution',
    sourceUrl: 'https://maduraicorporation.co.in/aboutus/water-supply/',
  },
  waterSources: [
    {
      sourceCode: 'vaigai',
      displayName: 'Vaigai Dam',
      type: 'reservoir',
      fullCapacityMcft: 6837.0,
      fullTankLevelFt: 71.0,
      latitude: 10.0533,
      longitude: 77.5897,
      catchmentAreaSqkm: 2253.0,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'mullaperiyar',
      displayName: 'Mullaperiyar (Periyar) Dam',
      type: 'reservoir',
      // SC 2014 verdict caps Kerala-side storage at 142 ft; the historical
      // 152 ft TN FRL (~15,660 mcft) is no longer operationally available.
      fullCapacityMcft: 10560.0,
      fullTankLevelFt: 142.0,
      latitude: 9.5394,
      longitude: 77.1422,
      catchmentAreaSqkm: 624.0,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'sothuparai',
      displayName: 'Sothuparai Dam',
      type: 'reservoir',
      fullCapacityMcft: 1272.0,
      fullTankLevelFt: null,
      latitude: 10.07,
      longitude: 77.45,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: false,
    },
  ],
  // Madurai's groundwater data is sparse at the ward scale (only 4 WRIS
  // live stations across the entire ~2,700 sq km district), so the IDW-
  // interpolated ward depth and the ward-level risk composite would
  // manufacture precision the underlying data does not support.
  // Instead we surface 21 CGWB Year Book point stations as the
  // authoritative depth signal, alongside the 11-block CGWB
  // exploitation classification.
  groundwaterViews: {
    exploitation: true,
    depth: false,
    risk: false,
    cgwbStations: true,
  },
  sourceNameAliases: {
    vaigai: 'vaigai',
    'vaigai dam': 'vaigai',
    'வைகை': 'vaigai',
    mullaperiyar: 'mullaperiyar',
    'mullai periyar': 'mullaperiyar',
    periyar: 'mullaperiyar',
    'periyar dam': 'mullaperiyar',
    'மூலைப்பெரியார்': 'mullaperiyar',
    sothuparai: 'sothuparai',
    'sothuparai dam': 'sothuparai',
    'சோத்துப்பாறை': 'sothuparai',
  },
};

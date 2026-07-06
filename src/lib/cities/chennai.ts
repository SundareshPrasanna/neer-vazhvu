import type { CityConfig } from './types';

export const CHENNAI: CityConfig = {
  cityId: 'chennai',
  displayName: 'Chennai',
  displayNameLocalized: { ta: 'சென்னை' },
  stateCode: 'TN',
  timezone: 'Asia/Kolkata',
  center: { lat: 13.0827, lng: 80.2707 },
  bbox: { south: 12.7, north: 13.4, west: 79.9, east: 80.4 },
  primaryAuthority: {
    code: 'cmwssb',
    name: 'Chennai Metropolitan Water Supply and Sewerage Board',
    acronym: 'CMWSSB',
  },
  localGovernment: {
    code: 'gcc',
    name: 'Greater Chennai Corporation',
    acronym: 'GCC',
    wardCount: 200,
  },
  defaultConsumptionMld: 830,
  defaultDesalinationMld: 190,
  availableLanguages: ['en', 'ta'],
  // Cascade reconstruction available (755 nodes / 573 edges across 7
  // cascade depths from the same HydroSHEDS pipeline that built
  // Madurai's). Chennai's max depth is shorter because the delta is
  // flatter; convergence into Red Hills, Chembarambakkam, Sholavaram,
  // Cholavaram is correctly identified.
  hasCascadeOverlay: true,
  waterSources: [
    {
      sourceCode: 'chembarambakkam',
      displayName: 'Chembarambakkam',
      type: 'reservoir',
      fullCapacityMcft: 3645.0,
      fullTankLevelFt: 24.0,
      latitude: 12.9517,
      longitude: 80.0551,
      catchmentAreaSqkm: 71.6,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'redhills',
      displayName: 'Red Hills (Puzhal)',
      type: 'reservoir',
      fullCapacityMcft: 3300.0,
      fullTankLevelFt: 48.5,
      latitude: 13.171,
      longitude: 80.1811,
      catchmentAreaSqkm: 60.3,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'poondi',
      displayName: 'Poondi',
      type: 'reservoir',
      fullCapacityMcft: 3231.0,
      fullTankLevelFt: 36.0,
      latitude: 13.3542,
      longitude: 80.0678,
      catchmentAreaSqkm: 2530.0,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'veeranam',
      displayName: 'Veeranam',
      type: 'reservoir',
      fullCapacityMcft: 1465.0,
      fullTankLevelFt: null,
      latitude: 11.35,
      longitude: 79.54,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: false,
    },
    {
      sourceCode: 'kannankottai',
      displayName: 'Kannankottai (TK)',
      type: 'reservoir',
      fullCapacityMcft: 500.0,
      fullTankLevelFt: null,
      latitude: 12.82,
      longitude: 79.98,
      catchmentAreaSqkm: null,
      displayOrder: 5,
      isPrimaryDrinkingSource: false,
    },
    {
      sourceCode: 'cholavaram',
      displayName: 'Cholavaram',
      type: 'reservoir',
      fullCapacityMcft: 1081.0,
      fullTankLevelFt: 22.0,
      latitude: 13.2184,
      longitude: 80.1499,
      catchmentAreaSqkm: 77.4,
      displayOrder: 6,
      isPrimaryDrinkingSource: true,
    },
  ],
  // Chennai has dense per-ward groundwater coverage (OpenCity monthly
  // survey across all 200 GCC wards) plus ~35 live India WRIS stations,
  // so all four GW views are honestly supported. CGWB Year Book point
  // overlay is not used here because the OpenCity ward dataset already
  // provides finer granularity than the Year Book's quarterly snapshot.
  groundwaterViews: {
    exploitation: true,
    depth: true,
    risk: true,
    cgwbStations: false,
  },
  // Chennai is the first city with the full home-dashboard pipeline: the
  // synthesized AI briefing (daily_briefing), the reservoir rainfall-anomaly
  // context strip, and a dense per-ward groundwater snapshot.
  dashboard: {
    aiBriefing: true,
    reservoirCatchmentContext: true,
    groundwaterSnapshot: true,
    weapBalance: true,
  },
  // Chennai's facts run the live + derived builders at request time
  // (reservoir storage, Day Zero compare, CGWB blocks, river quality)
  // merged with the static layer, rather than a static JSON snapshot.
  facts: { dynamicPipeline: true },
  // Full interactive hazard / historical / drainage / sewerage flood map.
  flood: { variant: 'interactive' },
  // Sub-basin climate-risk choropleth (6 sub-basins x 4 subthemes) from the
  // TNGCC + CEEW Feb 2026 risk index. All four subthemes are supported.
  climateRisk: {
    risk: true,
    hazard: true,
    exposure: true,
    vulnerability: true,
  },
  // Encroachment census + restoration ranking + ward search + lost bodies.
  waterBodies: {
    censusSource: true,
    rankingTab: true,
    wardSearch: true,
    lostBodies: true,
  },
  // Chennai's reservoir history lives in the original v1 tables
  // (reservoir_daily / reservoir_forecast), stored in Mcft, not the
  // multi-city reservoir_daily_v2 schema. The shared loaders select the
  // source from this flag.
  reservoirDataSource: 'legacy-v1',
  // Day Zero anchor: "On this day in 2019" is the whole point in Chennai.
  heroComparisonYear: 2019,
  historyUnit: 'Mcft',
  // Coastal shoreline-change surface (Mahabalipuram to Pulicat), 1990-2026.
  hasShoreline: true,
  // Allocation Ledger: the Krishna/Telugu Ganga chain (1976 tripartite 15 TMC ->
  // 1983 accord 12 TMC net at the border -> ~2-3 TMC delivered) + Veeranam and
  // the desal contracts, compiled in allocations-chennai.json.
  hasAllocationLedger: true,
  // Commitments register: desal trio, metering policy, ring main, NGT sewage
  // commitments, Cooum/Adyar/Buckingham restoration - commitments-chennai.json.
  hasCommitments: true,
  sourceNameAliases: {
    poondi: 'poondi',
    cholavaram: 'cholavaram',
    puzhal: 'redhills',
    'red hills': 'redhills',
    chembarambakkam: 'chembarambakkam',
    veeranam: 'veeranam',
    kannankottai: 'kannankottai',
    'thervoy kandigai': 'kannankottai',
  },
};

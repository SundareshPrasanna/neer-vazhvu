import type { CityConfig } from './types';

// Bangalore was registered DISABLED through the onboarding window and
// flipped to enabled: true on the cutover commit that merged PR #117 to
// main (June 2026). For the equivalent flip on the Supabase `cities`
// table see the M1 migration notes; both must agree for /bangalore to
// be reachable in production.
//
// Ward count is the post-15-May-2025 GBA delimitation (369 wards across
// 5 City Corporations, notified 19 Nov 2025).
//
// waterSources are the 4 upstream Cauvery basin reservoirs (KRS,
// Hemavathi, Kabini, Harangi). These are NOT Bangalore's tap supply -
// they are the upstream basin storage that determines how much Cauvery
// water Karnataka can release for BWSSB's pumping operation at T.K.
// Halli. Mirrors Madurai's Mullaperiyar pattern (Kerala-side dam
// tracked because it feeds Madurai's supply). isPrimaryDrinkingSource
// is false on all four because they feed irrigation, Mysore, Mandya,
// and Bangalore drinking in that order. The Bangalore home page hero
// will surface these as an upstream-basin-storage panel rather than
// Chennai-style days-left math.
export const BANGALORE: CityConfig = {
  cityId: 'bangalore',
  displayName: 'Bengaluru',
  displayNameLocalized: { kn: 'ಬೆಂಗಳೂರು' },
  stateCode: 'KA',
  timezone: 'Asia/Kolkata',
  center: { lat: 12.9716, lng: 77.5946 },
  bbox: { south: 12.83, north: 13.18, west: 77.40, east: 77.78 },
  primaryAuthority: {
    code: 'bwssb',
    name: 'Bangalore Water Supply and Sewerage Board',
    acronym: 'BWSSB',
  },
  localGovernment: {
    code: 'gba',
    name: 'Greater Bengaluru Authority',
    acronym: 'GBA',
    wardCount: 369,
  },
  defaultConsumptionMld: 1450,
  defaultDesalinationMld: null,
  availableLanguages: ['en', 'kn'],
  heroMode: 'cauvery-pumping',
  // Per-ward GW depth interpolation (`depth`) is off because Bengaluru
  // has only 13 CGWB telemetric stations across 369 wards - density too
  // low to honestly IDW. `exploitation` is ON since round 11 (WRIS
  // GEC 2024 extract): 6 CGWB blocks, every one Over-Exploited, with
  // Bangalore-East at 306% draft/recharge and Yelahanka up from 140%
  // to 260% in four years (2020-2024). `risk` ships the ward-risk
  // composite from ward-risk-bangalore.json (round 5); `cgwbStations`
  // surfaces the 13-station point overlay (round 7).
  groundwaterViews: {
    exploitation: true,
    depth: false,
    risk: true,
    cgwbStations: true,
    iisc: true,
  },
  waterSources: [
    {
      sourceCode: 'krs',
      displayName: 'Krishnaraja Sagar (KRS)',
      type: 'reservoir',
      fullCapacityMcft: 48400.0,
      fullTankLevelFt: null,
      latitude: 12.4247,
      longitude: 76.5722,
      catchmentAreaSqkm: 10619.0,
      displayOrder: 1,
      isPrimaryDrinkingSource: false,
    },
    {
      sourceCode: 'hemavathi',
      displayName: 'Hemavathi (Gorur Dam)',
      type: 'reservoir',
      fullCapacityMcft: 35700.0,
      fullTankLevelFt: null,
      latitude: 12.5667,
      longitude: 76.4500,
      catchmentAreaSqkm: 5410.0,
      displayOrder: 2,
      isPrimaryDrinkingSource: false,
    },
    {
      sourceCode: 'kabini',
      displayName: 'Kabini (Beechanahalli)',
      type: 'reservoir',
      fullCapacityMcft: 19520.0,
      fullTankLevelFt: null,
      latitude: 11.9735,
      longitude: 76.3528,
      catchmentAreaSqkm: 2141.90,
      displayOrder: 3,
      isPrimaryDrinkingSource: false,
    },
    {
      sourceCode: 'harangi',
      displayName: 'Harangi',
      type: 'reservoir',
      fullCapacityMcft: 8500.0,
      fullTankLevelFt: null,
      latitude: 12.4917,
      longitude: 75.9056,
      catchmentAreaSqkm: 419.58,
      displayOrder: 4,
      isPrimaryDrinkingSource: false,
    },
  ],
  // Cascade reconstruction overlay (V1): 1,033 nodes / 1,053 edges /
  // 43 river outlets, max depth 11, 79% high-confidence edges. Built
  // via scripts/run_cascade.py with allow_multi_outflow=True to honour
  // the historical feeder+surplus channel pattern on Bengaluru's ridge
  // geometry. Top convergence is Doddajala Kere (degree_in=8) on the
  // Hebbal cascade. Layer B curation (named cascades, NGO partners,
  // atlas refs) queued for follow-up once WELL Labs Urban Water Balance
  // and IISc kere chain inventories are joined.
  hasCascadeOverlay: true,
  // Basin Atlas: Arkavathi basin (Vrishabhavathi / Kumudavathi / Suvarnamukhi),
  // co-built with Paani Earth. Data under public/data/basins/arkavathi/.
  basinIds: ['arkavathi'],
  sourceNameAliases: {
    krs: 'krs',
    'krishna raja sagar': 'krs',
    'krishnaraja sagar': 'krs',
    kannambadi: 'krs',
    hemavathi: 'hemavathi',
    hemavati: 'hemavathi',
    gorur: 'hemavathi',
    'gorur dam': 'hemavathi',
    kabini: 'kabini',
    kapila: 'kabini',
    beechanahalli: 'kabini',
    bichanahalli: 'kabini',
    harangi: 'harangi',
  },
  enabled: true,
};

import type { PlaceConfig } from '@/lib/cities/types';

// Jaipur (Nagar Nigam Jaipur, Rajasthan). Onboarding October 2026.
//
// SUPPLY MODEL - A CITY THAT DRINKS A DAM 120 KM AWAY. The Public Health
// Engineering Department (PHED), not the corporation, runs Jaipur's water. Its
// Annual Progress Report 2025-26 (status 31.12.2025, printed p.85) puts the
// city's production at 766.73 MLD: 590 from Bisalpur dam on the Banas and 176
// from 3,633 PHED tube wells. A year earlier Bisalpur gave 492.08; the whole
// rise came from the dam. That is the `cauvery-pumping` definition ("carried
// from a distant source"), so the hero reads jaipur-supply-overview.json.
//
// BISALPUR IS NOT THE CITY'S STORAGE. It also supplies Ajmer, Tonk and
// villages on both pipelines and irrigates the land below it; a Water
// Resources Department study (2020) describes 11.1 TMC a year for Jaipur and
// its pipeline villages, but no allocation order has been found. So no
// days-left figure is computed (it would read about 1,060 days and overstate
// the city's security by years), and Bisalpur's card is labelled shared.
// The card's percentage is WRD's gross storage over designed capacity, never
// spliced with CWC's live-storage percentage.
//
// RAMGARH, the city's old source, held nothing on 8 October 2026 and on the
// same date in 2025, when the state's dams were 90% full. The Rajasthan High
// Court has heard the catchment case since 2011.
//
// GROUNDWATER - THE CITY HAS ITS OWN UNIT. IN-GRES carved JAIPUR_URBAN out
// of Sanganer, Amber and Jhotwara in 2021-2022; it stands at 349.88% in
// 2025-2026, the worst of the district's 16 units, all over-exploited.
//
// ONE CORPORATION AGAIN. Greater and Heritage merged back (effective 10 Nov
// 2025); 150 wards under LSG notification DLB/25/19631 of 16 Sep 2025. No
// official vector of the 2025 wards is published (the official map is a
// raster), so wardsVintage is null and My Ward ships as a ward table.
const config: PlaceConfig = {
  cityId: 'jaipur',
  listOrder: 130,
  displayName: 'Jaipur',
  originsTagline: 'From 827 wells inside its walls to a dam 120 kilometres away',
  displayNameLocalized: { hi: 'जयपुर' },
  stateCode: 'RJ',
  // Provisional: centroid of the OSM 2020 corporation outline, and that outline
  // with the old Greater wards padded for the villages added in March 2025. No
  // official vector of the 2025 boundary is published; recompute from it.
  center: { lat: 26.9, lng: 75.8 },
  bbox: { south: 26.73, north: 27.07, west: 75.64, east: 75.96 },
  wardsVintage: null,
  landing: {
    hook:
      "Three quarters of its piped water comes from a dam 120 km away; the aquifer under the city is pumped at more than three times its recharge; its old reservoir, Ramgarh, stands empty.",
    accent: 'bg-rose-700',
  },
  footerSources: [
    { label: 'PHED Rajasthan', href: 'https://phedwater.rajasthan.gov.in/' },
    { label: 'Rajasthan WRD dam storage', href: 'https://water.rajasthan.gov.in/wr/#/' },
    { label: 'IN-GRES', href: 'https://ingres.iith.ac.in/' },
    { label: 'CPCB NWMP', href: 'https://cpcb.gov.in/water-quality-data/' },
  ],
  routes: [
    '',
    'about',
    'groundwater',
    'water-bodies',
    'rivers',
    'flood-risk',
    'lake-restoration',
    'my-ward',
    'facts',
    'origins',
    'commitments',
  ],
  primaryAuthority: {
    code: 'phed_rj',
    name: 'Public Health Engineering Department, Government of Rajasthan',
    acronym: 'PHED',
  },
  // 150 wards: LSG notification DLB/25/19631 of 16 Sep 2025, Rajasthan
  // Gazette Extraordinary 20 Sep 2025; council elected 11 Sep 2026.
  localGovernment: {
    code: 'jmc',
    name: 'Nagar Nigam Jaipur (Jaipur Municipal Corporation)',
    acronym: 'JMC',
    wardCount: 150,
  },
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  availableLanguages: ['en'],
  // Hindi is in the LanguageCode union and the city name is localised above,
  // but no translation pass has run (the Delhi and Gurugram posture).
  upcomingLanguages: ['hi'],

  heroMode: 'cauvery-pumping',

  // Storage is GROSS: the WRD report prints gross storage and its % of designed
  // capacity, no live storage. fullCapacityMcft is designed gross (1 Mcum =
  // 35.3147 mcft), the basis scrape_rajasthan_wrd_dams.py writes. Never mix with
  // CWC's live %. Bisalpur is primary: 590 of 766.73 MLD (PHED APR 2025-26,
  // 31.12.2025); shared with Ajmer, Tonk and irrigation, and
  // defaultConsumptionMld is null, so no runway is computed.
  waterSources: [
    {
      sourceCode: 'bisalpur',
      displayName: 'Bisalpur (Banas)',
      type: 'reservoir',
      fullCapacityMcft: 38699.3, // 1,095.840 Mcum designed, WRD = NRLD-2019 gross
      fullTankLevelFt: 1035.1, // FRL 315.50 m
      // NRLD-2019 RA11HH0160 (pdf p263, text + image): 25 55'29" N 75 27'21" E
      latitude: 25.92472,
      longitude: 75.45583,
      isPrimaryDrinkingSource: true,
      noFeedNote:
        'The Rajasthan Water Resources Department publishes this dam’s storage daily from mid-June to mid-October and on the 1st and 16th of other months, often weeks late. The latest report has not reached this page yet.',
    },
    {
      sourceCode: 'ramgarh',
      displayName: 'Ramgarh (Jamwa Ramgarh)',
      type: 'reservoir',
      fullCapacityMcft: 2650.0, // 75.040 Mcum designed (2026 reports)
      fullTankLevelFt: null, // the report's 19.82 m is a gauge reading, not an FRL
      // NRLD-2019 RA11MH0016 (pdf p259): 27 2'44" N 76 3'36" E
      latitude: 27.04556,
      longitude: 76.06,
      // The city's former source (Supreme Court, 9 Nov 2017); it holds no water now.
      isPrimaryDrinkingSource: false,
      noFeedNote:
        'The Rajasthan Water Resources Department publishes this dam’s storage with its other dams. The latest report has not reached this page yet.',
    },
  ],
  reservoirDataSource: 'v2',
  reservoirPublisher: "the Rajasthan Water Resources Department's dam storage report",
  historyUnit: 'TMC',
  reservoirHistoryDefaultRange: 'all',
  reservoirHistoryNote:
    'Storage is each dam’s gross storage, the water held at that morning’s reading, as the Rajasthan Water Resources Department reports it against the dam’s designed capacity; the department publishes no usable (live) storage figure. Reports are daily from mid-June to mid-October and on the 1st and 16th of other months from May 2025; its monsoon bulletins carry the same table back to June 2023. Earlier weekly points for Bisalpur are the Central Water Commission’s live storage, which leaves out the water below the lowest outlet. Bisalpur’s water is shared by Jaipur, Ajmer, Tonk and irrigation, so the chart shows the whole dam, not the city’s share. The department reported Ramgarh empty on every date read, June 2023 to October 2026.',

  groundwaterViews: {
    // Unit choropleth on IN-GRES's own 2021 polygons: 16 units, all over-exploited.
    exploitation: true,
    exploitationLabel: 'IN-GRES block assessment',
    // OFF: shallow and deep piezometers sit side by side (Durgapura about 8 m,
    // Mansarovar about 42 m), so a per-ward depth surface would average
    // different aquifers into one number.
    depth: false,
    risk: false,
    cgwbStations: true,
    stationOverlayLabel: 'Rajasthan Ground Water Department and CGWB telemetry wells',
    iisc: false,
  },

  facts: {},
  flood: { variant: 'narrative' },

  waterBodies: {
    // OSM polygons; no city lake register is published. The first Census of
    // Water Bodies (2017-18) recorded no urban water body in Jaipur district.
    censusSource: false,
    rankingTab: false,
    wardSearch: false,
    lostBodies: false,
    elevationBands: false,
  },

  // OFF: no published STP outlet series for Jaipur (CPCB's 2024 drains and
  // STPs table has no Rajasthan rows; RSPCB publishes sample counts only).
  hasTreatmentDischarge: false,

  // No cascade/catchment layer: the cascade pipeline has not been run for
  // Jaipur. "Not built yet", not a reasoned absence (the Pune/Vizag pattern).
  hasCatchments: false,

  enabled: false,
};

export default config;

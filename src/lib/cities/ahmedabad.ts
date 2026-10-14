import type { PlaceConfig } from './types';

// Ahmedabad is registered DISABLED through the onboarding window (the Surat
// and Pune pattern): flipped to enabled: true on a cutover commit once data
// and UI land and the corpus release is pinned. Until then /ahmedabad is
// reachable only via NEXT_PUBLIC_PREVIEW_CITIES=ahmedabad.
//
// SUPPLY MODEL - A CITY THAT DRINKS A CANAL. AMC's Budget 2026-27 (pp.63-64)
// puts 1,550 of the 1,850 MLD it draws a day on three offtakes of the Narmada
// Main Canal, fed from Sardar Sarovar; 200 MLD on the Mahi through the Shedhi
// branch canal (Kadana, diverted at the Wanakbori weir); 100 MLD on 555
// borewells. The Sabarmati supplies none of it - the French wells and the
// Dudheshwar works dropped out of AMC's source table after 2021 - and the
// water held through the riverfront is topped up from the same canal. That is
// the `cauvery-pumping` definition ("carried from a distant source"), so the
// hero reads ahmedabad-supply-overview.json, which carries no number AMC does
// not publish: no NRW (never measured; connections are unmetered), no
// population (the same budget gives two), no entitlement (see allocations).
//
// THE RESERVOIRS ARE NOT THE CITY'S STORAGE. Sardar Sarovar is a four-state
// project and Kadana an irrigation dam; AMC's share of either is not
// published. All three cards are therefore isPrimaryDrinkingSource: false and
// no days-left figure is computed. What they DO have is a live, archived
// feed: the Gujarat water department's daily dam report, one frozen PDF per
// day since 2019-06-07, read by scrape_gujarat_wrd_dams.py.
//
// THE SABARMATI IS THE SIGNATURE ISSUE, and it is split by the city. Above
// it, Dharoi; through it, a 15 km reach held by the Vasna barrage and topped
// up with Narmada water; below Vasna, a CPCB Priority I stretch in the 2018,
// 2022 and 2025 reports. The rivers page carries the river's measured quality
// from Dharoi to Vautha and the city's STP outlets against their norms.
//
// THE SEWAGE BALANCE CARD STAYS OFF, and that is a finding. AMC and the state
// report sewage "generated" as 80% of water supplied and "treated" as equal to
// it - a zero gap by method - while GPCB measured pumping-station bypasses of
// 284.18 and 163.95 MLD. A balance card would render the derived zero as a
// measurement.
//
// GROUNDWATER - THE DISTRICT HIDES THE CITY. IN-GRES (2025-26) puts Ahmedabad
// district at 79.14%, semi critical, and the Ahmedabad Urban unit - which
// holds almost all of the AMC wards - at 128.85%, over exploited. Drilled to
// taluka on IN-GRES's own unit polygons, with 139 telemetry stations.
export const AHMEDABAD: PlaceConfig = {
  cityId: 'ahmedabad',
  displayName: 'Ahmedabad',
  displayNameLocalized: { gu: 'અમદાવાદ' },
  stateCode: 'GJ',
  center: { lat: 23.0225, lng: 72.5714 },
  // AMC's own ward layer spans 22.914-23.141 N, 72.437-72.729 E (the 2020
  // limit, with Bopal, Ghuma and Kathwada); padded so the riverfront's
  // upstream reach and the Kharicut belt sit inside the frame.
  bbox: { south: 22.88, north: 23.17, west: 72.4, east: 72.76 },
  wardsVintage: '2020',
  landing: {
    hook:
      "Eighty-four per cent of its water comes down the Narmada canal; the Sabarmati below the city is a Priority I stretch; the aquifer under it is over-exploited.",
    accent: "bg-orange-700",
  },
  footerSources: [
    { label: "Ahmedabad Municipal Corporation", href: "https://ahmedabadcity.gov.in/" },
    { label: "Gujarat dam storage reports", href: "https://wrd-dam.gujarat.gov.in/index.php" },
    { label: "CPCB NWMP", href: "https://cpcb.gov.in/water-quality-data/" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
  ],
  // `allocations`: off - no public order states AMC's base allocation from the
  // Narmada or the Mahi. `tanker`: off - AMC publishes no tanker register or
  // survey. `shoreline`: landlocked. `climate-risk`: not built. Each carries
  // its reason in scripts/lib/exemptions.ts.
  routes: [
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "lake-restoration",
    "my-ward",
    "facts",
    "origins",
    "commitments",
  ],
  primaryAuthority: {
    code: 'amc_water',
    name: 'Ahmedabad Municipal Corporation, Water Project and Water Operations',
    acronym: 'AMC',
  },
  localGovernment: {
    code: 'amc',
    name: 'Ahmedabad Municipal Corporation',
    acronym: 'AMC',
    // SEC final delimitation of 3 Oct 2020; unchanged for the 2026 polls.
    wardCount: 48,
  },
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  availableLanguages: ['en'],
  // Gujarati is in the LanguageCode union and the city name is localised
  // above, but no translation pass has run (the Surat posture).
  upcomingLanguages: ['gu'],

  heroMode: 'cauvery-pumping',

  // Live storage, the platform convention: fullCapacityMcft is DESIGNED LIVE
  // capacity from the department's own report (1 MCM = 35.3147 mcft).
  waterSources: [
    {
      sourceCode: 'sardar_sarovar',
      displayName: 'Sardar Sarovar (Narmada)',
      type: 'reservoir',
      fullCapacityMcft: 203412.7, // 5,760 MCM live
      fullTankLevelFt: 455.0, // FRL 138.68 m
      latitude: 21.831,
      longitude: 73.7502,
      // 84% of what AMC draws comes from here (Budget 2026-27), but the dam
      // serves four states and the city's share is not published.
      isPrimaryDrinkingSource: false,
      noFeedNote:
        'The Gujarat water department publishes this dam’s level, storage and releases every day; our daily ingestion starts at launch.',
    },
    {
      sourceCode: 'kadana',
      displayName: 'Kadana (Mahi)',
      type: 'reservoir',
      fullCapacityMcft: 42084.6, // 1,191.7 MCM live
      fullTankLevelFt: 419.0, // FRL 127.71 m
      latitude: 23.3053,
      longitude: 73.8248,
      isPrimaryDrinkingSource: false,
      noFeedNote:
        'Kadana’s releases reach Ahmedabad through the Wanakbori weir and the Shedhi branch canal to Raska. Published daily by the Gujarat water department; our ingestion starts at launch.',
    },
    {
      sourceCode: 'dharoi',
      displayName: 'Dharoi (Sabarmati)',
      type: 'reservoir',
      fullCapacityMcft: 26331.8, // 745.63 MCM live
      fullTankLevelFt: 622.0, // FRL 189.59 m
      latitude: 24.0044,
      longitude: 72.8539,
      // Not a current AMC source: releases to the city stopped in 1999. Carried
      // because it is the Sabarmati's own dam, upstream of the city and of
      // every river station but the state-entry one at Kheroj.
      isPrimaryDrinkingSource: false,
      noFeedNote:
        'Not a current AMC source: the city stopped receiving Dharoi releases in 1999. Published daily by the Gujarat water department.',
    },
  ],
  reservoirDataSource: 'v2',
  historyUnit: 'TMC',
  reservoirHistoryDefaultRange: 'all',
  reservoirHistoryNote:
    'Daily storage from the Gujarat water department’s dam report, which keeps one PDF per day back to 7 June 2019, so the series can begin there rather than at launch. Storage is live storage, the water above the lowest outlet. None of these dams is the city’s own: AMC’s share of each is not published.',

  groundwaterViews: {
    // Taluka choropleth on IN-GRES's own unit polygons. Two coastal talukas,
    // Dholera and Dhandhuka, are categorised 'salinity' and drawn grey.
    exploitation: true,
    // 24 telemetry stations in the Ahmedabad Urban unit, with shallow and
    // deep piezometers side by side: a per-ward surface would average
    // different aquifers into one number.
    depth: false,
    risk: false,
    cgwbStations: true,
    iisc: false,
  },

  facts: {},
  flood: { variant: 'narrative' },

  waterBodies: {
    censusSource: false,
    rankingTab: false,
    wardSearch: true,
    lostBodies: false,
    elevationBands: false,
  },

  // OFF: the shared treatment panel reads a monthly per-plant BOD series.
  // GPCB's public record for AMC's STPs is 2023-24 averages for ten plants,
  // three of them without a BOD figure, which that panel cannot show honestly.
  hasTreatmentDischarge: false,

  hasCatchments: false,
  catchmentsGapNote:
    "Ahmedabad has no cascade view. The cascade layer reconstructs chained tank systems, where each tank's overflow was built to feed the next. Ahmedabad's lakes were not built as a chain: the two the historical record describes, Kankaria and Chandola, were filled by a stream turned at a dam near Kamod and, from 1881, by the Kharicut canal. AMC's current lake interlinking is storm-water storage, a different system from an inherited cascade.",

  enabled: false,
};

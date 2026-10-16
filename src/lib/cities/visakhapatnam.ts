import type { PlaceConfig } from './types';

const APWRIMS_FEED_NOTE =
  "The Andhra Pradesh Water Resources Department publishes this reservoir's level and storage every morning on APWRIMS. No reading for the latest date has arrived yet.";

/**
 * Visakhapatnam - city twelve.
 *
 * Registered DISABLED through the onboarding window (the Surat and Pune
 * pattern): reachable only via NEXT_PUBLIC_PREVIEW_CITIES=visakhapatnam until a
 * cutover commit flips `enabled`. Seeded by 057_visakhapatnam_seed_disabled.sql.
 *
 * WHAT KIND OF CITY THIS IS. A port with no large river (CGWB: "No major
 * river/perennial rivers"). The harbour was dug out of the swamp at the mouth
 * of a gedda (the Meghadrigedda) in 1927-33. The town's first piped water,
 * Mudasarlova (handed over May 1903), came from about 10 km away. Its largest
 * source today is the Godavari and Yeleru system, which CGWB lists at 190 km
 * away (CGWB 2025 Table 9.1, one row for both; we have not found a split
 * between the two). The water reaches the city through the Yeleru canal; two
 * lifts bring in Godavari water, VIWSCO's Kateru pump house through a 56 km
 * pipeline to the canal and the Purushottapatnam lift into Yeleru reservoir
 * (since July 2018). In between came the Gosthani wells, Gambheeram,
 * Thatipudi (1968), the Meghadrigedda reservoir (CGWB lists it from 1976,
 * 5 km; NRLD 2019 and GVMC's 2018 floating-solar IEE give 1977, and the IEE
 * says commissioned 1979) and Raiwada (built 1981-82), so later sources are
 * not always further away, though the three largest are also the three
 * furthest (CGWB 2025 Table 9.1). Official distances disagree: Thatipudi
 * 56 / Raiwada 60 km (CGWB 2025), 60 / 56 km (CGWB 2022 and Nov 2023).
 * GVMC's daily supply sheet of 11 Mar 2021 (NGT OA 14/2021 (SZ), 1421_0.pdf
 * PDF p20) gives Raiwada 76, Thatipudi 56, Meghadrigedda 20 (CGWB 2025: 5),
 * Mudasarlova 10, the Yeleru reservoir 156 and the Godavari at Kateru 56 km.
 * The c.2006 city plan (Table 4.4, CDP PDF p49), measuring from the town
 * service reservoir, gives Raiwada 75, Thatipudi 65, Meghadrigedda 25 and
 * Mudasarlova 5 km. The canal was built first for the steel plant and is
 * still shared with it, NTPC, APIIC's industrial parks, the port and rural
 * water supply.
 *
 * SUPPLY-OVERVIEW HERO, NOT DAYS-LEFT. The reservoirs behind the city are
 * multi-use (irrigation, industry and the city draw on the same storage; only
 * Mudasarlova serves the city alone) and the lifts top the system up from the
 * Godavari, so a runway computed from storage would be false comfort. The
 * honest headline is the distance and the sharing: of the canal's tail-end
 * water on 11 Mar 2021, the one day for which we have found GVMC's split,
 * 41.6 million gallons (unit not printed on the sheet; read as MGD) went to
 * the city and 35.6 to the steel plant.
 *
 * THE FEED IS UNUSUALLY GOOD. APWRIMS (the AP Water Resources Department's
 * portal) serves daily reservoir level and storage for Yeleru, Raiwada,
 * Thatipudi and Meghadrigedda through a public JSON API (no login), with a
 * daily archive from 2012 for Yeleru (and most of 2012 for Raiwada) and from
 * late 2014 or 2015 for the others, so the reservoir cards and history chart
 * can be live from day one once ingestion runs. GVMC's own Mudasarlova
 * reservoir and the Water Resources Department's Gambhiramgedda reservoir are
 * not in APWRIMS and carry no feed.
 *
 * NO WARD SURFACES, and the reason is two-sided. The 98-ward boundaries in
 * circulation are an Esri India tracing of a GVMC CAD plot; we have not found
 * a licence anywhere in the chain, and its zone field disagrees with GVMC's
 * own ward list for 94 of 98 wards. And the 98 wards are already superseded: GVMC
 * notified 120 wards in 2026 (preliminary notice 17-05-2026; final gazette
 * reported 14-09-2026), and we have not found public geometry for them.
 * Official-or-nothing, the Hyderabad rule, so `my-ward` is off and
 * wardsVintage is null.
 *
 * NOT IN, each with a written reason in scripts/lib/exemptions.ts: `my-ward`
 * (above), `tanker` (one day of tanker trips, 11-03-2021, is all we have
 * found from GVMC), `climate-risk` (no sub-basin risk layer built).
 */
export const VISAKHAPATNAM: PlaceConfig = {
  cityId: 'visakhapatnam',
  displayName: 'Visakhapatnam',
  displayNameLocalized: { te: 'విశాఖపట్నం' },
  stateCode: 'AP',
  center: { lat: 17.6868, lng: 83.2185 },
  // The 98-ward extent (82.994-83.464 E, 17.546-17.940 N) padded outward. The
  // supply reservoirs sit outside it (Yeleru 17.31 N 82.10 E, Raiwada 18.01 N,
  // Thatipudi 18.17 N) and render as source cards, not on the city map.
  bbox: { south: 17.5, north: 18.0, west: 82.95, east: 83.55 },
  wardsVintage: null,
  landing: {
    hook:
      "A port with no large river: the Godavari and Yeleru drawn from up to 190 km away through a canal shared with the steel plant, daily reservoir storage from the state's public feed, and a coast measured from satellite.",
    accent: "bg-teal-700",
  },
  footerSources: [
    { label: "APWRIMS", href: "https://apwrims.ap.gov.in/" },
    { label: "GVMC", href: "https://www.gvmc.gov.in/" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
  ],
  routes: [
    "",
    "about",
    "groundwater",
    "water-bodies",
    "rivers",
    "flood-risk",
    "shoreline",
    "lake-restoration",
    "facts",
    "origins",
    "allocations",
    "commitments",
  ],
  primaryAuthority: {
    code: 'gvmc_ws',
    name: 'Greater Visakhapatnam Municipal Corporation, Water Supply wing',
    acronym: 'GVMC',
  },
  localGovernment: {
    code: 'gvmc',
    name: 'Greater Visakhapatnam Municipal Corporation',
    acronym: 'GVMC',
    // The council elected in March 2021 sits on 98 wards (G.O.Ms.18 of
    // 10-01-2020). GVMC has since notified 120 wards for the next council;
    // we have not found public geometry for them (see the header).
    wardCount: 98,
  },
  // We have not found a measured consumption figure. The 490 MLD "demand" in
  // CGWB's reports is a 2020 projection carried forward unchanged, and the hero
  // is supply-overview, which needs none.
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  availableLanguages: ['en'],
  // Telugu is in the LanguageCode union and the city name is localised above,
  // but no translation pass has run.
  upcomingLanguages: ['te'],

  heroMode: 'cauvery-pumping',

  // Capacities are LIVE (useful) storage: APWRIMS design gross minus dead
  // storage, the basis reservoir_daily_v2.storage_tmc is written on (migration
  // 058). Yeleru's live figure reproduces CWC's: 10.89 TMC (308.4 Mcum, 60.67%)
  // on 8 Oct 2026 against CWC's bulletin of 0.308 BCM, 60.63%.
  //
  // All six are drinking sources. Five are shared: Yeleru anchors the Godavari
  // and Yeleru system, the city's largest source, and also feeds irrigation and
  // the steel plant; Raiwada and Thatipudi are irrigation dams with a city
  // share; Meghadrigedda and Gambhiramgedda are dams the Water Resources
  // Department operates and maintains (CWC NRLD 2019, AP01MH0042 pdf p59 and
  // AP01LH0008 pdf p58). GVMC's 2018 floating-solar IEE describes
  // Meghadrigedda's reservoir surface as owned by GVMC (pdf p31), and GVMC
  // passes raw water from it to the Naval Dockyard and MES (sheet of 11 Mar
  // 2021); Gambhiramgedda has an irrigated ayacut, and GVMC draws on it from
  // March to June. GVMC supplied HPCL clear water from Raiwada, Meghadrigedda
  // and Thatipudi under three 2020 agreements, which a GVMC-GVSCCL-HPCL
  // agreement in force from 29.03.2024 subsumes, keeping 8.8 LIGD of GVMC
  // clear water beside 66.2 LIGD of recycled water from GVSCCL (HPCL EC
  // compliance report, Oct 2025-Mar 2026, pp106-110). Only Mudasarlova serves
  // the city alone, and it gives about 4.5 of some 380 MLD available from nine
  // sources (CGWB 2025). Hence no days-left hero (see the header).
  // isPrimaryDrinkingSource stays true on the shared five, as on Pune's
  // Khadakwasla chain (an irrigation complex with a drinking share): it marks a
  // source the city drinks from, which drives the About badge and the
  // missed-ingestion pill, and the supply-overview hero computes no runway
  // from it. Set false, the dashboard could never flag a missing APWRIMS day.
  waterSources: [
    { sourceCode: 'yeleru', displayName: 'Yeleru', type: 'reservoir', fullCapacityMcft: 17950.0, fullTankLevelFt: 283.99, latitude: 17.30794, longitude: 82.09538, isPrimaryDrinkingSource: true, hasPublicFeed: true, noFeedNote: APWRIMS_FEED_NOTE },
    { sourceCode: 'raiwada', displayName: 'Raiwada', type: 'reservoir', fullCapacityMcft: 3270.0, fullTankLevelFt: 373.77, latitude: 18.0065, longitude: 82.96574, isPrimaryDrinkingSource: true, hasPublicFeed: true, noFeedNote: APWRIMS_FEED_NOTE },
    { sourceCode: 'thatipudi', displayName: 'Thatipudi', type: 'reservoir', fullCapacityMcft: 3175.0, fullTankLevelFt: 297.0, latitude: 18.17231, longitude: 83.19147, isPrimaryDrinkingSource: true, hasPublicFeed: true, noFeedNote: APWRIMS_FEED_NOTE },
    { sourceCode: 'meghadrigedda', displayName: 'Meghadrigedda', type: 'reservoir', fullCapacityMcft: 1039.0, fullTankLevelFt: 61.0, latitude: 17.75928, longitude: 83.19483, isPrimaryDrinkingSource: true, hasPublicFeed: true, noFeedNote: APWRIMS_FEED_NOTE },
    // Capacity left null: GVMC's 2018 IEE lists 1,500,000 m3 in its hydraulics
    // table (pdf p15), and para 20 (pdf p18) calls that the original capacity and
    // gives 0.75 Mcum as the present capacity at full tank level after siltation,
    // with no survey or date behind it.
    { sourceCode: 'mudasarlova', displayName: 'Mudasarlova', type: 'reservoir', fullCapacityMcft: null, fullTankLevelFt: 166.99, latitude: 17.76462, longitude: 83.29412, isPrimaryDrinkingSource: true, hasPublicFeed: false,
      noFeedNote: "Mudasarlova is GVMC's own reservoir inside the city. It is not in the state's daily reservoir feed (APWRIMS), and we have not found a published daily level for it." },
    // Point from the National Register of Large Dams 2019 (AP01LH0008), not the
    // APWRIMS tank MI012862, which is a smaller tank 4 km east on the same stream.
    { sourceCode: 'gambheeram', displayName: 'Gambheeram (Gambhiramgedda)', type: 'reservoir', fullCapacityMcft: 111.5, fullTankLevelFt: null, latitude: 17.87472, longitude: 83.35167, isPrimaryDrinkingSource: true, hasPublicFeed: false,
      noFeedNote: "Gambhiramgedda is a state Water Resources Department reservoir that GVMC draws on from March to June. It is not in the state's daily reservoir feed (APWRIMS), and we have not found a published daily level for it." },
  ],

  groundwaterViews: {
    // ON, by mandal. 2024-25 matches CGWB's Dynamic Ground Water Resources of
    // Andhra Pradesh 2025 for these mandals; the map colours 2025-26, the
    // IN-GRES edition newer than CGWB's December 2025 report. The series starts
    // at 2023-24 because the city was one 513.8 km2 GVMC unit until then, and
    // the district itself was redrawn in April 2022, so no unit's history is
    // carried across a redraw.
    exploitation: true,
    exploitationLabel: "IN-GRES mandal assessment",
    // OFF: the wells in visakhapatnam-cgwb-stations.json are too few across
    // eleven mandals for a per-ward surface.
    depth: false,
    risk: false,
    cgwbStations: true,
    // The wells are APWRIMS recorders and AP Ground Water Department hand-read
    // wells, not CGWB Year Book wells.
    stationOverlayLabel: "AP Ground Water Department and APWRIMS well overlay",
    iisc: false,
    gapNote:
      "Visakhapatnam's groundwater is assessed by mandal, not by ward. In CGWB's December 2025 report (assessment year 2024-25), Visakhapatnam Rural mandal drew 95% of the groundwater that can be extracted there each year and was the district's only critical unit, while the district as a whole stood at about 44%. The 2025-26 IN-GRES edition, newer than CGWB's December 2025 report, puts Gajuwaka at 89% (semi-critical) and Visakhapatnam Rural at 48% (safe). The wells the AP Ground Water Department reads by hand each month and the automatic recorders on the state's APWRIMS portal are too few to draw a depth map for each ward.",
  },

  facts: {},
  flood: { variant: 'narrative' },

  waterBodies: {
    // OSM polygons (1,088 bodies) with no official register behind them: we
    // have found no gazetted lake register, no ward census join, and no
    // published official list of lost tanks.
    censusSource: false,
    rankingTab: false,
    wardSearch: false,
    lostBodies: false,
    elevationBands: true,
  },

  reservoirDataSource: 'v2',
  // GVMC runs the supply; the four reservoir readings are the state's.
  reservoirPublisher: "the AP Water Resources Department's APWRIMS portal",
  historyUnit: 'TMC',
  // A daily archive since 2012; one year would show a single monsoon.
  reservoirHistoryDefaultRange: '3yr',
  reservoirHistoryNote:
    "Daily storage from the Andhra Pradesh Water Resources Department's APWRIMS feed, shown as live storage: the water above each dam's lowest outlet. Yeleru's record runs from 2012, Thatipudi's from October 2014 and Meghadrigedda's from November 2015. Raiwada has most of 2012, then runs from October 2014 with a break from November 2015 to June 2016. Days whose published level or storage fails a basic check are left out. Yeleru reads zero in dry spells, when its water falls below the lowest outlet. Mudasarlova and Gambheeram are not in the feed.",

  // No cascade/catchment layer: the cascade pipeline has not been run for
  // Visakhapatnam. This is "not built yet", not a reasoned absence, so
  // catchmentsGapNote is deliberately omitted (the Pune/Gurugram pattern).
  hasCatchments: false,

  enabled: false,
};

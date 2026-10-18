import type { PlaceConfig } from '@/lib/cities/types';

// Nagpur is LIVE (see `enabled` at the foot of this file). The build and the
// switch-on ship in one pull request, with the corpus release pinned in the
// same PR. Scope is NMC only: the city frame is NMC's own GIS outline
// (NMCAdminBoundaries layer 3, edited 2023-08-13), whose stored area is
// 221.76 km2 (221.72 km2 measured on the WGS84 ellipsoid, 222.33 on a sphere).
//
// SUPPLY MODEL - TWO RIVERS, ONE OF THEM STORED IN ANOTHER STATE'S RESERVOIR.
// NMC ESR 2023-24 (s.6.2.1, printed pp.132-134): five treatment plants rated
// 786 MLD = Pench I 136 + II 175 + III 120 + IV 115 (546) + Kanhan 240.
// Totladoh, the Pench hydro-electric reservoir shared with Madhya Pradesh,
// releases to the Navegaon Khairi pick-up dam, and the city's draw goes to
// the Mahadula pumping station, at km 48.5 of the old canal route (ESR
// 2017-18 draft p.22; NMC told the regulator during Case 8 of 2017 that a
// closed pipeline replaced the canal in April 2015, Order 13/2018 para
// 32(v); no source gives the pipeline's length). The Kanhan plant lifts from the river 14 km from the city.
// FY 2023-24: 706 MLD supplied, 410 MLD billed, 41.91% lost source to
// consumer (ESR p.133; 410/706 gives 41.93). Table 6.2's 257.642 Mcum is the
// supplied total (706 MLD over 365 days, 704 over the 366 days of 2023-24);
// the report's sentence pairs it with the billed 410 MLD, but its table and
// the arithmetic make it supply. Budget 2026-27 (published May 2026; speech
// pp.B-3/B-4, a scan): 4.50 lakh connections, 106 water tanks, 4,650 km of
// mains, 37 tankers.
//
// THE PENCH SHARE IS A RESERVATION, NOT A STOCK. WRD GR of 19 Mar 2020
// (table p.2 of 3) and MWRRA Order 13/2018 (Case 8/2017): 112 Mcum a year in
// the project plan + 78 sanctioned 21 Mar 1998 (held "legal and intact" under
// s.31B in 2018) = 190 in phase 1 (our sum; the GR prints only the totals),
// 341 after the Lohghogari tunnel. Neither
// dam is coded for water supply in CWC's register (Totladoh hydro, Navegaon
// Khairi irrigation), and the city's 190 is about a fifth of the complex's
// planned use, so the hero is the supply overview (nagpur-supply-overview.json
// hero_copy) and no days-left figure is computed. Received volumes by source
// are published only for 2017-18; the allocations ledger says so.
//
// GROUNDWATER - THE DISTRICT SAFE IN EVERY EDITION, A CAVEAT ON THE CITY'S UNIT.
// IN-GRES drilled to 14 talukas over six editions (2019-2020 to 2025-2026):
// the district Safe in all six (45.30% in 2025-2026); every taluka Safe from
// 2023-2024, Katol Semi Critical to 2022-2023 and Saoner to 2021-2022. The
// city's own unit, Nagpur (Urban), is carved out from 2023-2024 and its
// 2025-2026 stage (54.62%) is computed on different inputs (a 206 ha command
// area against 16,081 ha the year before), so the category is the steadier
// comparison. The pre-2023 NAGPUR unit continues as Nagpur (Rural), the
// Pune/Haveli precedent, stated in its caveat.
//
// RIVERS. The Nag, Pili and Pora carry the city's storm water and sewage
// (NMC's 23 sampling points, ESR 2023-24 Tables 6.13-6.16); the Kanhan, Kolar
// and Wainganga around the city carry MPCB's monthly readings for five national
// stations, 2017-2024. The treatment panel stays off (below).
const config: PlaceConfig = {
  cityId: 'nagpur',
  listOrder: 95,
  displayName: 'Nagpur',
  originsTagline: 'The city named for a small stream, and the river from Madhya Pradesh that now fills its taps',
  displayNameLocalized: { mr: 'नागपूर' },
  stateCode: 'MH',
  // Centroid of NMC's own city outline (NMC GIS, NMCAdminBoundaries layer 3,
  // stored area 221.76 km2; edited 2023-08-13).
  center: { lat: 21.1423, lng: 79.0868 },
  // The outline spans 21.0531-21.2309 N, 78.9929-79.1841 E. The frame is
  // padded to the water system, the Pune convention: Totladoh (21.66 N,
  // 79.23 E) and Navegaon Khairi (21.46 N) sit 35-60 km north of the city.
  // No page reads this box; producers that fetch by bbox keep theirs equal
  // to it (build_nagpur_geography.py FRAME, asserted by its tests). Only the
  // rivers fetch runs east to 79.65 E, so the Kanhan meets the Wainganga.
  bbox: { south: 20.9, north: 21.75, west: 78.75, east: 79.45 },
  // public/geojson/nagpur-wards-2025.geojson: 38 ward outlines from MRSAC's
  // PM Gati Shakti layer, populations from the final notification of 4 Oct
  // 2025. MRSAC's ward populations follow the August 2025 draft, with some
  // typing slips and a different 23/26 split; the final notification moved
  // the lines between wards 6 and 7, 7 and 9, and 8 and 19, and MRSAC's 23/26
  // line differs from both, so wards 6, 7, 8, 9, 19, 23 and 26 carry a
  // boundary_note in the data.
  wardsVintage: '2025',
  landing: {
    // ESR 2023-24 pp.132-133 (four Pench plants, Kanhan WTP); Totladoh and
    // Navegaon Khairi as in scrape_pravah_dams.py's docstring. Shown on the
    // home page's city card.
    hook:
      "Four of its five treatment plants run on Pench water stored at Totladoh, a reservoir shared with Madhya Pradesh, and released through Navegaon Khairi; the fifth draws on the Kanhan.",
    accent: "bg-violet-700",
  },
  footerSources: [
    { label: "Nagpur Municipal Corporation", href: "https://nmcnagpur.gov.in/" },
    { label: "WRD Pravah", href: "https://mwrdpravah.in/damsafety/control/main" },
    { label: "IN-GRES", href: "https://ingres.iith.ac.in/" },
    { label: "MPCB", href: "https://mpcb.gov.in/" },
  ],
  // Every route here has its artifact or content module behind it.
  // `allocations` and `commitments` travel together (the ledger links each
  // future to its commitment). `my-ward` is on, with the ward 6/7/8/9/19/23/26
  // boundary caveat shown in the ward header (boundary_note). Off, each
  // with its reason in scripts/lib/exemptions.ts: `tanker` (NMC publishes
  // tanker counts but no register or survey), `shoreline` (landlocked),
  // `climate-risk` (not built).
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
    "allocations",
  ],
  primaryAuthority: {
    code: 'NMC_WW',
    name: 'Nagpur Municipal Corporation, Water Works Department',
    acronym: 'NMC',
  },
  localGovernment: {
    code: 'NMC',
    name: 'Nagpur Municipal Corporation',
    acronym: 'NMC',
    // Final delimitation, Maharashtra Gazette of 4 Oct 2025 (No.
    // 1600-E.D.-NMC-2025): 37 four-member wards and one three-member ward,
    // 151 councillors. Not the 10 administrative zones.
    wardCount: 38,
  },
  // No days-left: the city's 190 Mcum is a reservation in project dams and the
  // Kanhan is run-of-river, so there is no demand figure to divide by.
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  availableLanguages: ['en'],
  // Marathi is in the LanguageCode union and the city name is localised
  // above, but no translation pass has run (the Pune posture).
  upcomingLanguages: ['mr'],

  heroMode: 'cauvery-pumping',

  // Live storage, the platform convention: fullCapacityMcft is DESIGNED LIVE
  // capacity from the Pravah bulletin (1 Mcum = 35.3147 mcft), the same basis
  // as the storage_pct_frl the scraper writes, so card percentages and
  // volumes agree.
  //
  // The two Pench dams are what the city drinks (Pench I-IV, 546 of 786 MLD,
  // NMC ESR 2023-24), so they are primary: that sets the history chart's
  // default series, the About badge and the ingestion pill. The flag can only
  // feed a runway under heroMode 'days-left'; Nagpur's hero is the supply
  // overview with defaultConsumptionMld null, the Pune pattern (Ahmedabad
  // flags its dams false because AMC's share is unpublished; NMC's is, 190
  // Mcum). Storage is whole-dam (hydro-electric, shared with Madhya Pradesh;
  // irrigation), in which NMC holds a reservation, never the city's own stock.
  waterSources: [
    {
      sourceCode: 'totladoh',
      displayName: 'Totladoh (Pench)',
      type: 'reservoir',
      // 1,016.93 Mcum designed live storage (Pravah; equal to NRLD-2019's
      // effective storage, p.196, purpose H). The Pench hydro-electric
      // project reservoir, shared with Madhya Pradesh.
      fullCapacityMcft: 35912.6,
      fullTankLevelFt: 1607.6, // FRL 490.00 m, CWC weekly reservoir bulletin
      // NRLD-2019 21 39'32" N 79 13'55" E; 6 m off MRSAC's 75.39 km2 polygon.
      latitude: 21.65889,
      longitude: 79.23194,
      isPrimaryDrinkingSource: true,
      // Shown only while no reading exists for the latest date: before the
      // first ingestion, or on a day the bulletin row is missing.
      noFeedNote:
        'The state Water Resources Department publishes this reservoir’s storage every morning. The latest reading has not reached this page yet.',
    },
    {
      sourceCode: 'navegaon_khairi',
      displayName: 'Navegaon Khairi (Kamthi Khairy)',
      type: 'reservoir',
      // 141.98 Mcum designed live storage (Pravah "Kamthi Khairy"; NRLD-2019
      // "KAMTHIKHAIRY (PENCH)" p.172, purpose I). The Pench irrigation
      // project's pick-up dam below Totladoh, from which NMC's draw goes to
      // Mahadula (km 48.5 of the old canal route). No source used here gives
      // its FRL.
      fullCapacityMcft: 5014.0,
      fullTankLevelFt: null,
      // NRLD-2019 21 27'42" N 79 11'27" E; inside MRSAC's 22.73 km2 polygon.
      latitude: 21.46167,
      longitude: 79.19083,
      isPrimaryDrinkingSource: true,
      noFeedNote:
        'The state Water Resources Department publishes this reservoir’s storage every morning. The latest reading has not reached this page yet.',
    },
    {
      sourceCode: 'kanhan_intake',
      displayName: 'Kanhan river intake',
      type: 'river',
      // Run-of-river intake for the 240 MLD Kanhan plant (ESR 2023-24),
      // "approximately 14 km from Nagpur City and 300 m downstream of the
      // confluence of the River Kolar and the River Kanhan" (ESR 2017-18
      // s.4.1.2). Placed 300 m down OSM's Kanhan line from the Kolar-Kanhan
      // junction (node 1570091102): approximate. No page reads lat/lng.
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 21.24743,
      longitude: 79.16088,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        'A river intake, not a reservoir: the Kanhan plant draws from the river itself, so there is no stored volume to show. The state’s daily dam bulletin covers dams, not river intakes.',
    },
    {
      sourceCode: 'gorewada',
      displayName: 'Gorewada lake',
      type: 'reservoir',
      // NRLD-2019 p.151: completed 1911, Pili ("Poli") river, gross 8.84
      // Mcum, effective storage not printed, purpose I. Its old 16 MLD plant
      // is not among the five NMC lists for 2023-24, so not primary.
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      // NRLD-2019 21 11'53" N 79 2'44" E; inside MRSAC's Gorewada polygon.
      latitude: 21.19806,
      longitude: 79.04556,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: false,
      noFeedNote:
        'Gorewada lake was built in 1911 on the Pili river as a water source for the city. It is not among the dams in the state’s daily bulletin, so no daily reading is shown here.',
    },
  ],
  // Khindsi, Nand and Wadgaon sit in the same district block of the bulletin
  // and are parsed (a missing one only warns; the scraper writes nothing
  // if Totladoh or Kamthi Khairy is missing) but are not cards: none feeds
  // NMC.
  reservoirDataSource: 'v2',
  // The dams are read from the state bulletin, not from NMC.
  reservoirPublisher: "the Maharashtra Water Resources Department's daily dam bulletin",
  // The English bulletin prints storage (Mcum and %), not levels.
  reservoirReadingNoun: 'storage',
  historyUnit: 'TMC',
  // The record opens narrow (daily rows plus each bulletin's same-date-last-
  // year column) unless the Marathi-archive backfill is run, so open on all.
  reservoirHistoryDefaultRange: 'all',
  reservoirHistoryNote:
    'Storage is each dam’s live storage as the Maharashtra Water Resources Department reports it every morning, against its designed live capacity. Totladoh is the Pench hydro-electric reservoir, shared with Madhya Pradesh, and Navegaon Khairi (Kamthi Khairy in the bulletin) is the Pench irrigation project’s dam. NMC holds a yearly reservation in this water, so the chart shows the whole dam, not the city’s share. The chart starts at the earliest dated bulletin this site holds; each day’s bulletin also gives the same date a year earlier.',

  groundwaterViews: {
    // Taluka choropleth on IN-GRES's own 2021 unit polygons: 14 talukas, six
    // editions (2019-2020 to 2025-2026), every taluka Safe from 2023-2024
    // (Katol and Saoner Semi Critical in earlier editions). The city's own
    // assessment unit, Nagpur (Urban), is published from 2023-2024; its
    // 2025-2026 stage is computed on different inputs (a 206 ha command area
    // against 16,081 ha the year before), and the block panel shows
    // that as the unit's history_caveat (D5: quote the category).
    exploitation: true,
    exploitationLabel: "IN-GRES taluka assessment",
    // OFF because of the aquifer, not for lack of stations. The three in-city
    // telemetry wells are CGWB semi-confined piezometers (27.8 to 69.5 m deep,
    // India-WRIS). GSDA's long-record city wells are shallow dug wells (11.3
    // and 16.7 m). A per-ward surface would average two aquifers into one number.
    depth: false,
    risk: false,
    // 101 NWDP telemetry series (91 GSDA, 10 CGWB), placed by coordinates in
    // the taluka polygons. 3 stand inside the NMC outline, all CGWB.
    cgwbStations: true,
    // Telemetry wells, not CGWB Year Book wells.
    stationOverlayLabel: "NWDP telemetry wells of GSDA and CGWB (monthly means)",
    iisc: false,
    // Rendered only if every view above is off (page.tsx); kept as the
    // honest fallback.
    gapNote:
      "Nagpur's groundwater layers come from the IN-GRES taluka assessment and the National Water Data Portal's telemetry wells. A ward-level depth map is not drawn: the city's three telemetry wells read a deeper aquifer than its shallow dug wells, so averaging them into wards would mix two aquifers.",
  },

  // None of the optional dashboard sections has a Nagpur pipeline: no daily
  // briefing, no reservoir-catchment rainfall context, no dense per-ward
  // groundwater, no published basin water balance, and no generated-vs-
  // treated sewage balance file (ESR 2023-24 gives 520 MLD generated against
  // 403.5 MLD of capacity in 12 plants, a capacity figure, not a balance).
  dashboard: {
    aiBriefing: false,
    reservoirCatchmentContext: false,
    groundwaterSnapshot: false,
    weapBalance: false,
    sewageBalance: false,
  },

  // Static public/data/facts-nagpur.json, compiled by build_nagpur_facts.py
  // from the city's shipped artifacts (22 facts; 5 featured on the dashboard
  // strip, none tier 1, since no card is live).
  facts: {},
  // Card stack from src/cities/nagpur/flood.ts. flood-lines-nagpur.json (13
  // WRD red/blue-line sheets) and elevation-bands-nagpur.geojson are built,
  // but only the map variant mounts the flood-lines section; the narrative
  // page links the WRD register instead.
  flood: { variant: 'narrative' },

  waterBodies: {
    // Base layer is MRSAC's 1:10,000 survey of 2017-18 (official), names from
    // MRSAC, else OSM by overlap (name_source per feature).
    censusSource: false, // /api/water-bodies-census serves Chennai's encroachment census
    rankingTab: false, // no restoration-priority-nagpur.json
    wardSearch: true, // public/data/nagpur-ward-profiles.json
    // The layer is the 2017-18 survey; its publisher line carries the date.
    currentSourceLabel: 'Water bodies from',
    lostBodies: false, // no register of lost lakes exists for Nagpur
    legalRegister: false, // no gazetted lake register
    elevationBands: true, // public/data/elevation-bands-nagpur.geojson, FABDEM, 7 bands
    // mapView omitted on purpose: the default city view shows the NMC lakes;
    // Totladoh and Kamthikhairy (35-60 km north) are reached by panning.
  },

  // OFF: the shared treatment panel reads a monthly per-plant outlet BOD
  // series, which no Nagpur source publishes. The 13 plants (ESR Table 6.3)
  // and MPCB's January 2026 status per plant are in nagpur-stps.geojson.
  hasTreatmentDischarge: false,

  // No cascade/catchment layer: the cascade pipeline has not been run for
  // Nagpur district. This is "not built yet", not a reasoned absence, so
  // catchmentsGapNote is deliberately omitted (the Pune posture).
  hasCatchments: false,

  // LIVE. This flag is the ONLY functional gate on the city: [cityId]/layout.tsx
  // reads it, and listEnabledPlaces puts the city in the sitemap and the
  // dashboard in the build's prerender. The `enabled` column on the cities row
  // is read by no code (063_nagpur_enable.sql flips it anyway, for
  // consistency). The two dam cards and the history chart fill from the first
  // --supabase Pravah run after 060 and 061; until then each card shows its
  // noFeedNote.
  enabled: true,
};

export default config;

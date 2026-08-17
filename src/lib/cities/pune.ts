import type { CityConfig } from './types';

/**
 * Pune - city ten.
 *
 * WHAT KIND OF CITY THIS IS. Pune impounds a lot of water and still runs
 * short, which makes it neither Chennai (storage against demand) nor Gurugram
 * (no storage at all). Four dams on the Mutha hold 29.15 TMC between them, but
 * the Khadakwasla Complex is an IRRIGATION project with a drinking-water share
 * inside it: of the complex's 33.77 TMC of use, 22.55 TMC is the irrigation
 * provision and 8.3 TMC was the drinking provision in the project's own
 * planning (Ex. Engineer's affidavit, via MWRRA Order 19/2018). So a
 * days-of-water-left runway computed from total storage would be false comfort
 * of exactly the kind Madurai's Vaigai config exists to avoid - most of that
 * water is not the city's to drink, and downstream Daund and Indapur are in
 * front of a regulator arguing about it.
 *
 * THE SIGNATURE STORY IS AN ARITHMETIC ONE, and PMC publishes both halves of
 * it in a single table of its own Environment Status Report 2025-26:
 *
 *     net demand for 8,164,868 people   1,110.18 MLD   14.308 TMC
 *     system losses at 32% NRW          + 522.19 MLD  + 6.730 TMC
 *     total requirement                 1,631.84 MLD   21.030 TMC
 *     sanctioned entitlement                           16.360 TMC
 *     shortfall PMC reports                             4.670 TMC
 *
 * The shortfall is SMALLER THAN THE LEAK. 4.67 TMC against 6.73 TMC. Pune's
 * entitlement gap sits arithmetically inside its own distribution losses, and
 * closing them would leave the city 2.05 TMC in surplus without a drop of new
 * water. That is why heroMode is the supply-overview hero rather than
 * days-left: the honest headline here is not how long the water lasts, it is
 * what happens to it between the dam and the tap.
 *
 * AND THE TAP RUNS FOUR HOURS A DAY. PMC's own service-level benchmark table
 * reports 4 hours against its own 24-hour target - in every edition from
 * 2021-22 to 2025-26, after Rs 1,557.89 crore of a Rs 2,818.46 crore
 * equitable-supply project, with 67 of 82 service reservoirs built and 35
 * commissioned.
 *
 * DATA-INTEGRITY FINDING carried into the artifact rather than smoothed over:
 * PMC republished an IDENTICAL service-level table for four consecutive years
 * (2021-22 through 2024-25). Only 2025-26 moves. That column is one
 * observation, never a four-year trend.
 *
 * SCOPE IS PMC ONLY, and deliberately so. Pimpri-Chinchwad is a separate
 * corporation of 181 sq km on its own Pavana source, and it publishes its own
 * ESR - but no PCMC ward boundary exists in any public form (no OpenCity
 * dataset, GeoServer login-walled, and OSM carries no PCMC polygon at all), so
 * a `region` place in the MMR shape cannot be drawn honestly. PMC over 41
 * prabhags is the Hyderabad shape, not the Mumbai one.
 *
 * Reference implementations: `src/lib/cities/gurugram.ts` (supply-overview
 * hero on a city with no honest runway), `src/lib/cities/madurai.ts` (the
 * irrigation-dam-with-a-drinking-share problem), `src/lib/cities/mumbai.ts`
 * (the other Maharashtra place, and the other consumer of the Pravah feed).
 */
export const PUNE: CityConfig = {
  cityId: 'pune',
  displayName: 'Pune',
  displayNameLocalized: { mr: 'पुणे' },
  stateCode: 'MH',
  timezone: 'Asia/Kolkata',

  // Centre is the centroid of the 41 PMC prabhag polygons (18.5036, 73.8751),
  // nudged to the Sangam where the Mula meets the Mutha, which is the point
  // the city's water story actually turns on.
  center: { lat: 18.5204, lng: 73.8567 },

  // The bbox covers the WATER SYSTEM, not the municipal boundary. PMC's wards
  // span 73.7318-74.0183 E and 18.3856-18.6216 N, but every dam that fills the
  // city sits west or north of that: Temghar 73.52, Warasgaon 73.53, Panshet
  // 73.55, Pavana 73.45, Mulshi 73.44, and Bhama Askhed north at 18.88. A map
  // clipped to the corporation would show the taps and hide the sources.
  bbox: { south: 18.3, north: 18.95, west: 73.4, east: 74.05 },

  primaryAuthority: {
    code: 'PMC_WS',
    name: 'Pune Municipal Corporation, Water Supply Department',
    acronym: 'PMC',
  },
  localGovernment: {
    code: 'PMC',
    name: 'Pune Municipal Corporation',
    acronym: 'PMC',
    // 41 electoral prabhags of the 2025 delimitation, used for the 2026 PMC
    // election - 165 corporators across 40 four-member wards plus
    // Ambegaon-Katraj with five. NOT the 15 administrative ward offices, which
    // are a separate geography and are what PMC's own operational records
    // (the STP layer's `Ward_Offic` column) key to.
    wardCount: 41,
  },

  // PMC's own total requirement, ESR 2025-26 water budget: 1,631.84 MLD gross
  // of 32% non-revenue water. This is a REQUIREMENT PMC states, not a measured
  // delivery - PMC publishes no measured daily abstraction, and its accounts
  // explicitly exclude groundwater, private tankers and other sources.
  defaultConsumptionMld: 1631.84,
  defaultDesalinationMld: null,

  // The four Khadakwasla-chain dams plus PMC's eastern scheme and PCMC's
  // source. Capacities are LIVE (useful) storage from the Maharashtra WRD
  // Pravah daily bulletin, converted at 1 Mcft = 0.0283168 Mcum, and
  // independently confirmed against CWC's National Register of Large Dams
  // 2019 - which agrees to the cubic metre on Panshet, Warasgaon, Temghar and
  // Bhama Askhed. The chain's four live capacities sum to 825.66 Mcum =
  // 29.158 TMC, reproducing the 29.15 TMC / 825.43 MCM PMC publishes in its
  // own ESR from a completely separate source.
  //
  // Coordinates are OSM reservoir/dam centroids. Cross-check: OSM puts Pavana
  // Dam at 18.6776, 73.4958 against NRLD-2019's 18 deg 40'50" N, 73 deg 29'39"
  // E - about 350 m apart, which is agreement.
  waterSources: [
    {
      sourceCode: 'khadakwasla',
      displayName: 'Khadakwasla',
      type: 'reservoir',
      // 55.91 Mcum live. The SMALLEST of the four and the operational one:
      // it is the balancing reservoir the other three release into, and the
      // dam whose discharge figure is what Pune hears on a flood day.
      fullCapacityMcft: 1974.4,
      fullTankLevelFt: null,
      latitude: 18.4163,
      longitude: 73.7225,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
    {
      sourceCode: 'panshet',
      displayName: 'Panshet (Tanajisagar)',
      type: 'reservoir',
      fullCapacityMcft: 10651.2,
      fullTankLevelFt: null,
      latitude: 18.35,
      longitude: 73.5507,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
    {
      sourceCode: 'warasgaon',
      displayName: 'Warasgaon (Vir Baji Pasalkar)',
      type: 'reservoir',
      // The chain's largest. Pravah prints "Warasgaon"; most secondary
      // writing says Varasgaon; NRLD-2019 registers it as Vir Baji Pasalkar.
      fullCapacityMcft: 12824.9,
      fullTankLevelFt: null,
      latitude: 18.3857,
      longitude: 73.5278,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
    {
      sourceCode: 'temghar',
      displayName: 'Temghar',
      type: 'reservoir',
      fullCapacityMcft: 3708.4,
      fullTankLevelFt: null,
      latitude: 18.453,
      longitude: 73.5176,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: true,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
    {
      sourceCode: 'bhama_askhed',
      displayName: 'Bhama Askhed',
      type: 'reservoir',
      fullCapacityMcft: 7666.7,
      fullTankLevelFt: null,
      latitude: 18.8842,
      longitude: 73.6688,
      catchmentAreaSqkm: null,
      displayOrder: 5,
      isPrimaryDrinkingSource: true,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
    {
      sourceCode: 'pawana',
      displayName: 'Pawana',
      type: 'reservoir',
      // PCMC's principal source, carried because PMC also lifts 27 MLD off
      // the Pavana at Ravet and because the Pavana joins the Mula inside the
      // urban area. Pravah and NRLD-2019 disagree on this one dam by ~11%
      // (live 240.97 vs 274.32 Mcum) with no published explanation; Pravah is
      // used as the operator's own current figure.
      fullCapacityMcft: 8510.0,
      fullTankLevelFt: null,
      latitude: 18.6594,
      longitude: 73.4509,
      catchmentAreaSqkm: null,
      displayOrder: 6,
      isPrimaryDrinkingSource: false,
      // Pravah PUBLISHES this daily - the generic card line ('PMC does not
      // publish daily levels') would be false. What is missing is our first
      // ingestion run, not the upstream feed.
      noFeedNote:
        'Maharashtra WRD publishes this dam’s live storage every morning in its Pravah bulletin. Our daily ingestion starts at launch; until the first run lands there is nothing to chart.',
    },
  ],

  // Three government sources spell one dam three ways: Pravah "Khadakwasla",
  // CWC "KHADAKVASLA", India-WRIS "Khadakwasala_1". Warasgaon/Varasgaon and
  // Panshet/Tanajisagar are the same story.
  sourceNameAliases: {
    Khadakvasla: 'khadakwasla',
    Khadakwasala: 'khadakwasla',
    Khadakwasala_1: 'khadakwasla',
    Tanajisagar: 'panshet',
    'Panshet Tanajisagar': 'panshet',
    Varasgaon: 'warasgaon',
    'Vir Baji Pasalkar': 'warasgaon',
    Pavana: 'pawana',
    Pawana_1: 'pawana',
  },

  // Supply-overview hero, not days-left. See the header: the tracked storage
  // is an irrigation complex with a drinking share, so a runway computed off
  // it would overstate the city's position by roughly the irrigation
  // provision. Reads public/data/pune-supply-overview.json.
  heroMode: 'cauvery-pumping',

  reservoirDataSource: 'v2',
  historyUnit: 'TMC',
  // Pravah has no queryable archive (its dated URLs 404), so Pune's daily
  // series starts when our own scraping does. The same-date-last-year column
  // is reconstructed and back-dated on every run, so the window grows at both
  // ends - but it opens narrow, and 'all' avoids greeting a reader with a
  // single dot.
  reservoirHistoryDefaultRange: 'all',
  reservoirHistoryNote:
    'Daily storage comes from the Maharashtra WRD Pravah bulletin, which publishes only a latest report and no archive. Our own record starts at onboarding; each run also back-fills the same date a year earlier from the bulletin’s own comparison column, so the window widens from both ends. CWC’s weekly bulletins carry Khadakwasla and Panshet back to 2015 and are wired as a backfill for those two, so their series runs a decade deeper than the other five. Warasgaon, Temghar, Pavana and Bhama Askhed are absent from those bulletins entirely, so the four-dam chain total still begins at onboarding.',

  // NARRATIVE, not interactive. Pune's flooding is drainage-driven and the
  // hazard layers the interactive variant defaults to do not exist for this
  // city: Maharashtra WRD publishes the statutory red and blue flood lines as
  // 518 SCANNED PDF SHEETS with no vector form anywhere. The narrative stack
  // needs none of them, and Pune holds the thing that matters here instead -
  // PMC's own nalla network, 3,075 open storm-water channels carrying 1,014 km,
  // which the drainage_map section renders. The flood-line absence ships as a
  // data gap ON the page rather than as a reason to hide the page.
  flood: { variant: 'narrative' },

  // The FOURTH tanker kind, and Pune is why it exists. PMC runs the fleet and
  // publishes the DISPATCH record: one spreadsheet per filling point per working
  // day, one row per tanker already sent. Hyderabad's utility-ledger panel could
  // not carry it, because that page is built on bookings against deliveries and
  // the fulfilment rate between them, and PMC'S REGISTER HAS NO BOOKINGS AT ALL
  // - no fulfilment rate, no division or section unit, no prices, and no volumes
  // (tanker capacity is not on the row). Pushing Pune through it would have meant
  // deleting Hyderabad's copy for a city that has none of what it describes,
  // which is the trade types.ts warns against.
  //
  // What the register does carry is a scheduled-vs-on-demand flag per trip, and
  // that is the finding rather than the volume: 58.4% of trips are on demand, so
  // most of this water is a response rather than a planned route.
  tankerDataKind: 'delivery-register',
  tankerSummary:
    "PMC's own tanker dispatch register: 57,370 deliveries from 7 filling points, one row per tanker sent, 58.4% of trips on demand rather than scheduled. Counts only - the source rows carry recipient addresses and phone numbers and none of that is republished.",

  groundwaterViews: {
    // ON, and this city is the first to drill BELOW the district. Pune
    // district reads 63.73% and SAFE in aggregate, while Shirur taluka inside
    // it is CRITICAL at 95.71% and has been in all six published IN-GRES
    // editions. Publishing the district figure alone would say the opposite
    // of the finding. 14 talukas, 6 editions, reproducing CGWB's National
    // Compilation 2025 exactly.
    exploitation: true,
    // OFF, and not for want of a pipeline. The WRIS telemetry drop holds 120
    // Pune-district groundwater stations with 319,345 six-hourly readings -
    // genuinely dense - but exactly ONE of them stands inside the PMC ward
    // boundary, Shivaji Nagar_1, tested point-in-polygon rather than by
    // bounding box (the box says nine, and six of those nine are rural
    // stations in Purandhar, Haveli and Maval that merely fall inside the
    // rectangle). The rest are mostly in the eastern irrigation belt around
    // Baramati, Indapur, Purandhar and Daund. Interpolating per-ward urban
    // depth from a single in-city station would manufacture precision that
    // does not exist, which is the Madurai rule applied to a denser dataset.
    depth: false,
    risk: false,
    gapNote:
      'Pune’s groundwater is assessed by taluka, not by ward. Of the 120 telemetry stations in the district, exactly one stands inside the city boundary — the rest are mostly in the eastern irrigation belt — so no per-ward depth surface is drawn. PMC itself publishes no groundwater figure at all: its supply accounts explicitly exclude borewells and private tankers, and its 2025-26 report recommends creating the borewell monitoring and licensing that would produce one.',
  },

  waterBodies: {
    // Basic map only at launch. There is no encroachment census for Pune, no
    // gazetted lake register, and no official register of lost water bodies -
    // PMC publishes no lake layer at all, which is why the polygons here come
    // from OSM.
  },

  // No cascade/catchment layer: the cascade pipeline has not been run for
  // Pune district. This is "not built yet", not a reasoned absence, so
  // catchmentsGapNote is deliberately omitted.
  hasCascadeOverlay: false,

  availableLanguages: ['en'],
  upcomingLanguages: ['mr'],

  // Preview-gated. The data layers are real and the producers are wired, but
  // the reservoir series needs its first ingestion run and the narrative
  // surfaces (Origins, commitments, allocations) are not written yet. Flip
  // this to true, and the `cities` row with it, at cutover.
  enabled: false,
};

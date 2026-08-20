import type { CityConfig } from './types';

// Surat is registered DISABLED through the onboarding window (the Delhi and
// Kolkata pattern): flipped to enabled: true on a cutover commit once data and
// UI land, with supabase/migrations/044_surat_seed_disabled.sql now and an
// enable migration at cutover. Until then /surat is reachable only via
// NEXT_PUBLIC_PREVIEW_CITIES=surat.
//
// SUPPLY MODEL - RUN-OF-RIVER, like Kolkata, and for the same reason the
// days-left hero is not merely awkward here but undefined. Surat impounds
// nothing of its own. It abstracts from a weir-cum-causeway pond on the Tapi,
// and the water that fills that pond is released from Ukai dam, ~100 km
// upstream, which SMC does not operate. There is no volume to run down.
//
// But Surat is NOT Kolkata's story either. Kolkata's emergency is drainage
// against a design standard. Surat's emergency is ARRIVAL, and its publisher
// hands us something no other city on this platform publishes: a live reading
// AND the operational threshold it is measured against, at every link of the
// chain. Ukai's full reservoir level. The causeway's overflow level. A danger
// level for each of five urban khadis. Hourly, free, unauthenticated.
//
// So Surat ships heroMode 'flood-headroom'. The distinction from
// drainage-capacity is worth stating because it is why a fifth mode exists
// rather than a reused fourth: drainage-capacity MODELS exceedance of a design
// property quoted from a document; flood-headroom STATES distance to an
// operational trigger level that the operator publishes alongside the reading.
// One is an inference we make, the other is a subtraction.
//
// THE HISTORY PROBLEM - the source page keeps a rolling window of about ten
// readings and offers no archive, no dated URL and no API. Every day the
// scraper does not run is lost permanently. That is why
// scrape_smc_flood_chain.py landed before any UI work on this branch, and why
// it belongs in the daily launchd job rather than CI.
//
// 2006 IS DELIBERATELY ABSENT. The August 2006 flood is Surat's defining water
// event and the obvious thing to render today's release against: Ukai peaked
// near 900,000 cusec, against roughly 23,000 today. That comparison is not in
// the product because every figure for it currently traces to Wikipedia, news
// coverage or advocacy reports. Per the defensible-numbers rule it stays out
// until replaced from the People's Committee on Gujarat Floods report or the
// Surat Citizens' Council Trust report. The flood page carries the 2006
// inundation FOOTPRINT (SMC's own depth-classed GIS layer) without the
// discharge numbers, which is the half we can source.
//
// ANALYTICAL UNIT - ZONE, not ward, and this is a real decision rather than a
// shortcut. "Ward" in Surat means three incompatible things: 30 electoral
// wards (120 corporators), about 134 census/administrative wards in SMC's own
// 1961-2011 area-and-population table, and a third scheme inside SMC's GIS
// ward_boundary layer. The zone is the only unit that simultaneously carries
// live data (rainfall is reported per zone, every khadi is attributed to one),
// an official current denominator (SMC's GIS publishes a 2011 census
// population AND a 2024 estimate per zone), and the city's own supply
// breakdown (the national open-data release gives capacity per sub-ward, which
// rolls up cleanly). Ward surfaces stay off until boundary geometry exists.
//
// VINTAGE CONFLICT, stated rather than smoothed: SMC's Zones page lists NINE
// zones (South split into A and B) while the live rainfall feed still reports
// EIGHT (a single South Zone). The scraper carries the feed's names through
// verbatim rather than remapping them, so no artifact asserts a structure its
// source does not use.
//
// NO MEASURED NRW - and this is a finding, not an omission. The national
// open-data release for Surat contains a "Losses including NRW" column that is
// exactly 20.0000% of total supply on all 48 monthly rows, and an "actual
// supplied" column identical to total supply, which contradicts it. The
// per-sub-ward release carries a "domestic consumption" column that is exactly
// 0.750000 x capacity on all 233 rows. Both are constants presented as
// measurements. Only the capacity and total-supply columns enter the product,
// and the About page says why.
//
// GROUNDWATER - coastal and saline-influenced. India-WRIS holds roughly 65
// Surat-district stations across manual quarterly (1970-2019) and telemetry
// (2026) series, a 56-year span. The block/taluka field is empty for every
// Surat row in those exports, so block assessment must come from IN-GRES
// rather than being derived. Per-ward interpolation stays off: the station
// network is nowhere near dense enough to manufacture per-zone precision.
//
// NO TANK-CASCADE HERITAGE. Surat's water bodies are coastal wetlands, creeks
// and urban talavs, not a chained kanmoi/kere system. hasCascadeOverlay stays
// false and catchmentsGapNote says why on the page, because the cascade story
// would assert a history the city does not have.
export const SURAT: CityConfig = {
  cityId: 'surat',
  displayName: 'Surat',
  displayNameLocalized: { gu: 'સુરત' },
  stateCode: 'GJ',
  timezone: 'Asia/Kolkata',
  center: { lat: 21.1702, lng: 72.8311 },
  // SMC's limit after the June 2020 extension is 462.149 km2 per the
  // corporation's own wardwise area table. The box is drawn to hold that plus
  // the Hazira industrial belt and the Dumas coast to the south-west, since
  // the river and groundwater surfaces legitimately reach past the city line.
  bbox: { south: 21.0, north: 21.35, west: 72.6, east: 72.99 },
  primaryAuthority: {
    code: 'smc_hydraulic',
    name: 'Surat Municipal Corporation, Hydraulic Department',
    acronym: 'SMC',
  },
  localGovernment: {
    code: 'smc',
    name: 'Surat Municipal Corporation',
    acronym: 'SMC',
    // The 30 electoral wards, which is the unit the corporation is elected on.
    // NOT the analytical unit - see ANALYTICAL UNIT above.
    wardCount: 30,
  },
  // SMC's Hydraulic department page states 980 MLD gross daily average supply
  // against 1,300 MLD installed works capacity, but that page is explicitly
  // dated 2015. The national open-data monthly series runs to Dec 2021 and
  // ends around 1,250 MLD. Rather than publish a stale headline or silently
  // pick the newer of two differently-scoped figures, defaultConsumptionMld
  // stays null and the supply surface renders the dated series with its
  // vintage on the face of it.
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  availableLanguages: ['en'],
  // Gujarati is in the LanguageCode union and the city name is localised
  // above, but no translation pass has run. Advertised as coming soon rather
  // than shipped half-done - the same posture Kannada and Marathi took.
  upcomingLanguages: ['gu'],

  heroMode: 'flood-headroom',
  floodChain: {
    chainNote:
      'Rain over the city, releases from Ukai dam, the weir they back up behind, and five creeks that run through the middle of Surat. Every threshold below is the operator’s own published figure.',
    upstreamOperator: {
      name: 'Gujarat Water Resources Department',
      note: 'Ukai is operated by the state irrigation department, not by Surat. The release that reaches the city is not the city’s decision.',
    },
    sourceLink: {
      label: 'SMC live rainfall and flood page',
      href: 'https://www.suratmunicipal.gov.in/Home/RainfallInfo',
    },
  },

  // Surat tracks no impounded source of its own. Ukai is carried as a
  // flow_station rather than a reservoir precisely because counting it as
  // Surat storage would be the error this whole config exists to avoid: it is
  // an irrigation and power dam serving the lower Tapi command area, and the
  // city's share of it is not published.
  waterSources: [
    {
      sourceCode: 'ukai',
      displayName: 'Ukai dam (upstream, not SMC-operated)',
      type: 'flow_station',
      fullCapacityMcft: null,
      fullTankLevelFt: 345.0,
      latitude: 21.2483,
      longitude: 73.5903,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: true,
      noFeedNote:
        'Ukai is the Gujarat Water Resources Department’s to publish, not SMC’s. SMC republishes its level, inflow and outflow hourly; no storage volume or Surat share is published anywhere.',
    },
    {
      sourceCode: 'singanpor_weir',
      displayName: 'Weir-cum-causeway (Singanpor)',
      type: 'flow_station',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 21.2167,
      longitude: 72.8236,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
      // FALSE, and the flag's own doc is what decides it: "such sources are
      // excluded from ingestion-liveness checks: they can never have a
      // reading". This one can never have a reading. SMC publishes the weir's
      // level hourly, so a feed plainly exists - but the liveness check asks
      // whether a DAILY STORAGE reading can land in reservoir_daily_v2, and a
      // level in metres on a river reach is not one. 048_surat_enable.sql
      // records the same fact from the database side: no rows, and none
      // expected. Left true, this put "PREVIEW - waiting for first daily
      // ingestion" on a live city's dashboard, promising an ingestion that
      // is not coming. Surat's live state is the flood-headroom hero, which
      // reads the scraped artifact.
      hasPublicFeed: false,
      noFeedNote:
        'The weir pond is the city’s actual intake. Level and outflow are published hourly; the impounded volume is not, and the pond is a river reach rather than a reservoir, so no capacity is carried.',
    },
  ],

  groundwaterViews: {
    // ON, backed by IN-GRES: four districts (Surat, Tapi, Navsari, Bharuch)
    // across four assessment years. Note the granularity honestly - these are
    // DISTRICTS, not the taluka blocks Chennai shows, which is the same
    // coarseness Kolkata ships. Tapi is in scope because Ukai sits there, so
    // the recharge picture upstream belongs to Surat's story.
    //
    // WHAT THIS ACTUALLY RENDERS: a station map, not a choropleth. IN-GRES
    // assesses Gujarat at district level, so gwr-blocks-surat.json carries a
    // `districts` payload and an EMPTY `blocks` array, and there is no
    // published district-boundary layer to draw it on either. Left true
    // because the flag means "offer the canonical view where its data exists"
    // and the render path now enforces that half: with no blocks the title
    // reads "CGWB Year Book stations", the percent legend does not draw, and
    // the toggle does not appear.
    //
    // Before that gate existed this page drew an exploitation legend - in
    // percent - over markers coloured by DEPTH in metres. Two quantities under
    // one key. Gurugram, which has the same district-level IN-GRES shape and
    // no station layer, drew the same legend over a bare basemap.
    //
    // THE FINDING IS THAT THERE IS NO FINDING. All four districts return SAFE
    // in all four assessment years. That is unusual on this platform and it is
    // the point: Surat's water problem is flood and effluent, not extraction.
    exploitation: true,
    // OFF: about 65 stations across a 462 km2 city plus its district. IDW
    // interpolation to zone level would manufacture precision the network
    // cannot support - the same call Madurai made at 4 stations.
    depth: false,
    risk: false,
    // The India-WRIS point network rendered as click-through markers, which is
    // the honest way to show a sparse but deep record (1970-2026).
    cgwbStations: true,
    gapNote:
      "Surat's groundwater assessment is at DISTRICT level, not the taluka blocks Chennai shows - four districts across four assessment years, from IN-GRES. Per-well depth from the 94 India-WRIS stations is real and is drawn as points; a per-zone depth surface interpolated from those points across a 462 sq km city and its district would not be, so that view stays off.",
  },

  // No dynamic fact pipeline yet: Surat ships the static snapshot.
  facts: {},

  // NARRATIVE, NOT INTERACTIVE, and the correction is worth recording because
  // the first cut of this file said 'interactive' and claimed a 2006
  // inundation footprint that was never built. The interactive renderer wants
  // modelled hazard zones, per-event hotspots, and drainage and sewerage
  // geometry. Surat publishes none of the five: no return-period zones, no
  // depth extents, no waterlogging register, no storm-water network, and no
  // ward file to hang them on. Every one of those layers 404ed, so the route
  // rendered an empty basemap with a five-class legend for hazard classes that
  // do not exist - and, until the ward loader was fixed, Chennai's 200 wards
  // on top of it.
  //
  // What Surat DOES have is the live chain, and that is already the dashboard
  // hero (see floodChain below). This route carries what the hero cannot: the
  // external feeds to watch during an event, and the honest list of what is
  // missing.
  flood: {},

  waterBodies: {
    // No census join: Gujarat publishes no Surat water-body census equivalent
    // to Chennai's or Bengaluru's. The base layer is the SAC wetland atlas.
    censusSource: false,
    rankingTab: false,
    wardSearch: false,
    lostBodies: false,
  },

  reservoirDataSource: 'v2',
  historyUnit: 'TMC',

  // Surat will never have a storage history, and the chart must say so rather
  // than promising one that "fills in automatically". Neither tracked point is
  // a reservoir: Ukai's storage is the Gujarat WRD's to publish and Surat's
  // share of it is not published at all, and the weir pond is a river reach
  // with no impounded volume. This is the Delhi lesson - a live feed does not
  // imply a storage series.
  reservoirHistoryAbsentNote:
    'Surat has no storage history and will not grow one. The city impounds nothing: it abstracts from a weir pond on the Tapi, which is a river reach rather than a reservoir, and the dam upstream belongs to the state irrigation department, which publishes a level but no volume and no Surat share. Level over a full-reservoir mark is not a quantity of water, so there is nothing here to chart. What Surat does have is the live flood chain at the top of this page.',

  // Off by editorial decision, not for want of data. See NO TANK-CASCADE
  // HERITAGE above, and say so on the page rather than leaving the toggle
  // silently absent.
  hasCascadeOverlay: false,
  catchmentsGapNote:
    "Surat has no cascade view, and that is a judgement about the city rather than a missing dataset. The cascade layer reconstructs chained tank systems - the Tamil kanmoi networks and the Bengaluru kere chains, where each tank's surplus was engineered to feed the next over centuries. Surat's water bodies are coastal wetlands, tidal creeks and urban talavs on a flat estuarine plain. The algorithm would find downhill neighbours here because it always does, and drawing them as a cascade would assert an inheritance the city does not have.",

  // Surat is coastal (Dumas, Hazira, the Tapi estuary) but the shoreline
  // surface currently reads Chennai coastal data. Parametrising it is a
  // separate piece of work, so the route stays off rather than shipping a map
  // of another city's coast.
  hasShoreline: false,

  // Off at V1. Surat has no published drinking-water entitlement from Ukai
  // that a ledger could render: the research pass found infrastructure and
  // treatment capacities but no sanctioned allocation instrument. Recorded as
  // a named gap rather than an empty page.
  hasAllocationLedger: false,

  // On: SMC's own reuse programme carries dated, institutionally-owned
  // commitments (70% of treated wastewater reused by 2030, 100% and zero
  // liquid discharge by 2035), which is exactly the register's shape.
  hasCommitments: true,

  sourceNameAliases: {
    ukai: 'ukai',
    'ukai dam': 'ukai',
    tapi: 'singanpor_weir',
    weir: 'singanpor_weir',
    'weir cum causeway': 'singanpor_weir',
    'weir-cum-causeway': 'singanpor_weir',
    singanpor: 'singanpor_weir',
    singanpore: 'singanpor_weir',
  },

  // LIVE 2026-08-20. This flag is the only functional gate on the whole
  // cutover: [cityId]/layout.tsx reads it, and the `enabled` COLUMN in the
  // cities table is read by no code at all. 048_surat_enable.sql exists so a
  // fresh rebuild is honest about a city that is live, not because it switches
  // anything.
  enabled: true,
};

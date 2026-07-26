import type { CityConfig } from './types';

// Hyderabad is registered DISABLED through the onboarding window. It flips to
// enabled: true on the cutover commit once data + UI land; the Supabase
// `cities` table must agree. Until then /hyderabad is reachable only via
// NEXT_PUBLIC_PREVIEW_CITIES=hyderabad.
//
// Research backing every claim below: docs/research/
// hyderabad-kolkata-onboarding-research-2026-07.md (2026-07-26), with raw
// evidence artifacts in docs/research/hyd-kol-evidence/. Figures marked there
// as [R] (news/snippet only) are deliberately NOT used here.
//
// SCOPE - standalone city (the Chennai model), NOT a region (the Mumbai MMR
// model), and this is the counter-intuitive call. GHMC was TRIFURCATED on
// 11 Feb 2026 into GHMC (150 wards) / Cyberabad (76) / Malkajgiri (74), so at
// first glance Hyderabad looks like MMR's nine corporations. It is the
// opposite. MMR needed placeKind:'region' because nine corporations each run
// their OWN water system off a contested shared pool with no utility above
// them. Hyderabad merged 27 urban local bodies UPWARD into a Core Urban Region
// and put ONE utility - HMWSSB - over all three corporations. The water story
// is therefore unitary: one board, one daily reservoir statement, one tanker
// fleet, one sewerage network. Only the ward/administrative layer is
// three-headed, and that is handled with a scope badge on ward surfaces
// ("Core Urban Region - 3 corporations"), the way Mumbai already badges scope
// per card. No new place model needed.
//
// SUPPLY MODEL - reservoir-impounded and pumped, like Chennai rather than
// Bangalore/Delhi: HMWSSB draws from six sources every day and publishes the
// draw. So heroMode is 'days-left', and unusually we can run the FULL
// interactive hero rather than Mumbai's collapsed variant, because the feed
// carries INFLOW as well as storage (see reservoirDataSource note below).
//
// WARD UNIT - 300 wards across three corporations, per the delimitation
// gazetted 25 Dec 2025. THE GEOMETRY IS NOT PUBLIC YET. What exists publicly
// is the superseded 150-ward GHMC 2022 KML on OpenCity (complete and clean for
// that vintage: 155 placemarks, ward numbers 1-150, none missing, with
// ward/CIRCLE/ZONE attributes). So `my-ward` and ward profiles ship OFF at
// launch, exactly as Mumbai's did, until the 300-ward geometry is located.
// Second consequence: the corporations are currently run by a Special Officer
// with elections pending, so there are NO sitting councillors - the ward
// representatives surface is an honest empty state, not a gap to backfill.
//
// NETWORK CONSTRAINT - CPCB (cpcb.nic.in) refuses non-India IPs, verified
// 2026-07-26. Anything needing CPCB NWMP / polluted-river-stretch data for the
// Musi runs via the India-IP runner path, never from CI. HMWSSB, TGDPS,
// lakes.hmda.gov.in, India-WRIS and OpenCity are all reachable from anywhere.
export const HYDERABAD: CityConfig = {
  cityId: 'hyderabad',
  displayName: 'Hyderabad',
  displayNameLocalized: { te: 'హైదరాబాద్' },
  stateCode: 'TG',
  timezone: 'Asia/Kolkata',
  center: { lat: 17.426, lng: 78.43 },
  // Computed from the GHMC 2022 ward KML (43,510 vertices): the 150-ward
  // corporation spans 17.2907-17.5610 N, 78.2390-78.6217 E. Padded outward to
  // cover the Core Urban Region, which absorbed 27 ULBs beyond that outline
  // and whose own boundary file is not yet public. Tighten once the 300-ward
  // geometry lands. The supply reservoirs sit far outside (Yellampally ~18.85 N,
  // Srisailam ~16.09 N) and render as source cards, not on the city map - the
  // Bangalore/Delhi pattern.
  bbox: { south: 17.15, north: 17.7, west: 78.1, east: 78.75 },
  primaryAuthority: {
    code: 'hmwssb',
    name: 'Hyderabad Metropolitan Water Supply and Sewerage Board',
    acronym: 'HMWSSB',
  },
  localGovernment: {
    code: 'ghmc',
    name: 'Greater Hyderabad Municipal Corporation',
    acronym: 'GHMC',
    // The Core Urban Region total across GHMC (150) + Cyberabad (76) +
    // Malkajgiri (74), per the 25-Dec-2025 delimitation gazette. Copy must not
    // imply these are all "GHMC wards" post-trifurcation.
    wardCount: 300,
  },
  // MEASURED, not estimated, and now computed over the full archive rather
  // than a single day: HMWSSB publishes today's draw-off per reservoir in MLD,
  // and the trailing 365 days to 25-Jul-2026 (365/365 days present) give
  // mean 2,628.4 MLD, median 2,647.0, range 1,862.2-4,339.0. This default is
  // the fallback divisor only - the hero uses the live daily figure.
  //
  // For context, mean city draw by calendar year from the same feed:
  //   2014 1,116.6 | 2016 1,174.4 | 2018 1,509.0 | 2020 2,013.2
  //   2022 2,028.9 | 2024 2,597.0 | 2026 2,636.4 (to 25 Jul)
  // i.e. the city's daily draw has grown ~136% in twelve years.
  //
  // Widely-quoted service figures (~1,954 MLD supplied, 1,480 sq km,
  // 1.68 crore population) are news-sourced only and are NOT used.
  defaultConsumptionMld: 2628,
  defaultDesalinationMld: null,
  // Landlocked; no desalination is possible or proposed.
  availableLanguages: ['en'],
  upcomingLanguages: ['te'],
  // Full interactive runway. Hyderabad is the only city whose feed carries
  // BOTH draw and inflow, so the worst-case / current-trend / seasonal
  // scenarios are all computable from measured data - Mumbai had to collapse
  // them to one line because Pravah publishes storage only.
  heroMode: 'days-left',
  // Both landed 2026-07-26 as seeds and deepen through the build.
  // - allocations-hyderabad.json: the Krishna (Nagarjuna Sagar -> Akkampally),
  //   Godavari (Yellampally) and Manjira chains plus the Musi twins. Hyderabad
  //   INVERTS the usual shape of this primitive: receipts are MEASURED daily
  //   from the HMWSSB feed, and it is the entitlement column that is blank,
  //   because the governing GOs have not been obtained.
  // - commitments-hyderabad.json: 7 entries. Most carry status 'unverifiable'
  //   rather than a hedge - Hyderabad's water promises are typically announced
  //   without a dated deliverable, so there is nothing to be overdue against.
  //   The FTL notification programme is the exception and is continuously
  //   auditable, because HMDA publishes the register that records it.
  hasAllocationLedger: true,
  hasCommitments: true,
  tankerDataKind: 'utility-ledger',
  // Hyderabad's tanker data is NOT the Bangalore household-price survey. HMWSSB
  // runs the fleet itself and publishes its own ledger: monthly bookings and
  // deliveries per division/section (26 OpenCity CSVs,
  // build_hyderabad_tankers.py). Fulfilment turned out flat at 99.95%, so the
  // page leads on demand volume, ~3.0x summer seasonality and the IT-corridor
  // geography instead of on a price or a service-failure rate.
  tankerSummary:
    "HMWSSB's own tanker ledger - monthly bookings and deliveries by division and section.",
  waterBodies: {
    // OFF: reads the Supabase table `water_bodies_census` (encroachment +
    // storage-capacity fields), which is a different dataset from the Jal
    // Dharohar points we hold, and is blocked on the DB apply besides.
    censusSource: false,
    // ON: restoration-priority-hyderabad.json (14 flagship bodies,
    // compute-restoration-priority-hyderabad.ts). The scorer is Hyderabad's
    // own - its distinguishing component is LEGAL EXPOSURE read from HMDA's
    // gazetted FTL register, which no other city can compute.
    rankingTab: true,
    // OFF: needs hyderabad-ward-profiles.json -> blocked on the 300-ward
    // geometry.
    wardSearch: false,
    // OFF: needs hyderabad-water-bodies-lost.geojson. Hyderabad's lost-tank
    // literature is substantial; not yet compiled.
    lostBodies: false,
    // ON: hyderabad-lake-register.json - HMDA's gazetted register of 2,978
    // lakes with FTL notification status. A different POPULATION from the OSM
    // map layer (669 visible polygons), and the gap between the two is the
    // point: 1,626 gazetted lakes have no legally settled boundary.
    legalRegister: true,
  },
  groundwaterViews: {
    // CGWB Dynamic GWR district assessments, 2022 / 2024 / 2025, via the
    // OpenCity mirrors of the national compilations joined to the Telangana
    // Districts Map KML (build_hyderabad_gwr_blocks.py). 33/33 districts
    // matched. Telangana assesses by DISTRICT in all three editions, so the
    // series joins cleanly - no repeat of the Madurai firka-to-block change.
    //
    // Latest edition, metro districts: Hyderabad 98.32% CRITICAL (+2.3 pts
    // since 2022), Medchal-Malkajgiri 73.72% Semi-Critical (+16.7), Medak
    // 69.55% (+20.1), Siddipet 68.76%, Rangareddy 66.59% (+6.4), Vikarabad
    // 60.66% (+23.4), Sangareddy 48.13%.
    //
    // SOURCE QUIRK: the 2025 Telangana cut is MISLABELLED on OpenCity as
    // "Tamil Nadu - State of GW Extraction" (filename tg_gw_2025.csv, and its
    // districts are Adilabad, Bhadradri Kothagudem...). The build asserts the
    // district set against 2024 so a genuine TN file would fail loudly.
    exploitation: true,
    // Interpolated per-ward depth stays OFF - but NOT for the reason first
    // assumed. An early narrow-window probe suggested ~15 stations in
    // Hyderabad district; the full pull found 481 across the five districts
    // (Ranga Reddy 192, Medak 173, Hyderabad 48, Siddipet 44, Vikarabad 24),
    // so the metro core alone has 240 - essentially Delhi's density, which
    // WAS enough there to carry a per-ward card.
    //
    // Two reasons it still stays off. First and decisively, there is no
    // public 300-ward geometry to interpolate ONTO. Second, this is Deccan
    // hard rock: granite and gneiss, where water sits in weathered zones and
    // discrete fractures rather than a continuous aquifer, so a surface
    // interpolated between two wells a few km apart asserts a water table
    // that may not exist between them. Revisit the second point with
    // Telangana GWD's denser village-level piezometer network.
    depth: false,
    // Depends on ward geometry, which does not exist publicly yet.
    risk: false,
    // India-WRIS Ground Water Level API, telemetric and LIVE to 2026-06-04
    // (verified 2026-07-26) - unlike Delhi's, whose network stopped
    // 2025-09-20. NOTE the district-name trap: WRIS carries a partly
    // pre-2016 district set, so 'Ranga Reddy' and 'Medak' return data while
    // 'Medchal-Malkajgiri', 'Sangareddy' and 'Yadadri Bhuvanagiri' return
    // zero rows. Enumerate spellings empirically, and probe a WIDE date
    // window first - a narrow one is indistinguishable from "no stations".
    //
    // 481 wells landed 2026-07-26 (public/data/hyderabad-cgwb-stations.json):
    // 10,724 monthly readings, depth median 8.71 m, range -4.6..99.7 m.
    // Sign convention is derived PER STATION and the families are clean once
    // derived generically from the code prefix - CGWHYD* (122) and TSCGWB*
    // (37) are negative-down, the numeric lat/long-encoded NHN codes are
    // positive-down. Never abs(): it would erase real water-above-datum
    // readings. Delhi's classifier hardcoded its own prefixes and had to be
    // generalised for this to come out right.
    cgwbStations: true,
  },
  // Musi tank cascade, reconstructed 2026-07-26: 428 nodes, 411 edges,
  // 11 river outlets, 63 isolated tanks, max cascade depth 9. Edge
  // confidence 321 high / 81 medium / 9 low. Top convergence is Amber
  // Cheruvu with 8 inflows at cascade position 3.
  //
  // This is the only cascade on the platform with a documented catastrophic
  // failure: on 28 September 1908, 221 of the 788 tanks along the Musi
  // breached - the chain failing link by link - which is what prompted
  // Osman Sagar and Himayat Sagar.
  hasCascadeOverlay: true,
  reservoirDataSource: 'v2',
  // Feed: HMWSSB's daily "Statements of WaterLevels in Reservoirs", scraped by
  // neer-vazhvu-api/scripts/scrape_hmwssb_reservoirs.py from
  // https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx
  // Daily archive runs 01-Jan-2014 to present (~12.5 years).
  //
  // fullCapacityMcft and fullTankLevelFt below are the values the feed itself
  // published on 25-Jul-2026 (1 TMC = 1,000 Mcft). Two cautions:
  //  1. HMWSSB SILENTLY REVISED the twin reservoirs' capacity on 01-Jul-2026
  //     (Osman Sagar 3.900 -> 3.518 TMC, Himayat Sagar 2.967 -> 2.521 TMC;
  //     bisected to the exact day, all other sources unchanged). The cause is
  //     UNCONFIRMED - it lands on the water-year boundary, so it could be a
  //     re-survey, a gross-vs-live redefinition, or a correction. Do NOT
  //     describe it as siltation without a GO. A Headwaters detector watches
  //     this column.
  //  2. Levels are mixed-unit and declared per row by the source: Akkampally
  //     is metres, the rest feet. fullTankLevelFt normalises to feet.
  waterSources: [
    {
      // The Nizam-era twins on the Musi, and the reason GO 111 existed. Small
      // in volume but drawn on essentially every day in the 12-year record.
      sourceCode: 'osman_sagar',
      displayName: 'Osman Sagar',
      type: 'reservoir',
      fullCapacityMcft: 3518.0,
      fullTankLevelFt: 1790.0,
      latitude: 17.3747,
      longitude: 78.2997,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      sourceCode: 'himayat_sagar',
      displayName: 'Himayat Sagar',
      type: 'reservoir',
      fullCapacityMcft: 2521.0,
      fullTankLevelFt: 1763.5,
      latitude: 17.3136,
      longitude: 78.3572,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      // Manjira system, Sangareddy district.
      sourceCode: 'singur',
      displayName: 'Singur',
      type: 'reservoir',
      fullCapacityMcft: 29917.0,
      fullTankLevelFt: 1717.93,
      latitude: 17.7472,
      longitude: 77.9256,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      // The Manjira barrage / Manjira Water Works intake. Coordinates from
      // OSM way/146343025 "Manjira dam" (waterway=dam). Nominatim's generic
      // "Manjira" hit was a river point and was rejected. Sanity check: this
      // sits DOWNSTREAM (south-east) of Singur on the same river, which is
      // the right relationship - Singur is upstream storage, Manjira is the
      // intake. OSM dam nodes are community-traced; confirm against
      // Telangana I&CAD before using for anything but a map pin.
      sourceCode: 'manjira',
      displayName: 'Manjira',
      type: 'reservoir',
      fullCapacityMcft: 1500.0,
      fullTankLevelFt: 1651.75,
      latitude: 17.6568,
      longitude: 78.0756,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      // Akkampally Balancing Reservoir (AMR project), Nalgonda district - the
      // Krishna leg, and by far the largest single draw (1,253 of 2,659 MLD on
      // 25-Jul-2026). FTL is published in METRES (245.000 m = 803.81 ft).
      // Coordinates from OSM node/11031476789 "Akkampally Dam"
      // (waterway=dam); node/7173815473 "akkampally dam" independently sits
      // 1.3 km away at 16.7002, 79.1002, so two contributors agree on the
      // location. Nominatim's "Akkampalli" hit was a village in Anantapur,
      // Andhra Pradesh ~300 km away and was rejected. Sanity check: this is
      // ~25 km north-west of Nagarjuna Sagar, consistent with a balancing
      // reservoir on its left canal.
      sourceCode: 'akkampally',
      displayName: 'Akkampally (Krishna)',
      type: 'reservoir',
      fullCapacityMcft: 1499.0,
      fullTankLevelFt: 803.81,
      latitude: 16.6891,
      longitude: 79.0957,
      catchmentAreaSqkm: null,
      displayOrder: 5,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      // The Godavari leg. Absent from the earliest rows in the archive
      // (commissioned after 2014), which is why the report's stale
      // "Total(1 to 5)" label no longer covers the set it sums.
      sourceCode: 'yellampally',
      displayName: 'Sripada Yellampally (Godavari)',
      type: 'reservoir',
      fullCapacityMcft: 20175.0,
      fullTankLevelFt: 485.56,
      latitude: 18.8457,
      longitude: 79.3764,
      catchmentAreaSqkm: null,
      displayOrder: 6,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: true,
    },
    {
      // Nagarjuna Sagar and Srisailam are the PARENT Krishna storages upstream
      // of Akkampally. HMWSSB reports them for context and they consistently
      // show a city drawl of 0.000 MLD, so they are NOT primary drinking
      // sources - counting them would double-count the Krishna leg. They are
      // kept because their level is the real constraint on Akkampally.
      sourceCode: 'nagarjuna_sagar',
      displayName: 'Nagarjuna Sagar',
      type: 'reservoir',
      fullCapacityMcft: 312045.0,
      fullTankLevelFt: 590.0,
      latitude: 16.5417,
      longitude: 79.3183,
      catchmentAreaSqkm: null,
      displayOrder: 7,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: true,
    },
    {
      sourceCode: 'srisailam',
      displayName: 'Srisailam',
      type: 'reservoir',
      fullCapacityMcft: 215807.0,
      fullTankLevelFt: 885.0,
      latitude: 16.0868,
      longitude: 78.897,
      catchmentAreaSqkm: null,
      displayOrder: 8,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: true,
    },
  ],
  // The feed prints these labels; map them to our canonical source codes so a
  // relabelling upstream does not silently orphan a source.
  sourceNameAliases: {
    OsmanSagar: 'osman_sagar',
    HimayathSagar: 'himayat_sagar',
    'Singur(Ft./M)': 'singur',
    Manjira: 'manjira',
    'AkkamPally[Krishna](M)': 'akkampally',
    'SriPadaYellampally(Godavari)': 'yellampally',
    NagarjunSagar: 'nagarjuna_sagar',
    Srisailam: 'srisailam',
  },
  enabled: false,
};

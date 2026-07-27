import type { CityConfig } from './types';

// Kolkata is registered DISABLED through the onboarding window (the Delhi
// pattern): flipped to enabled: true on the cutover commit once data + UI land,
// with supabase/migrations/037_kolkata_seed_disabled.sql now and an enable
// migration at cutover. Until then /kolkata is reachable only via
// NEXT_PUBLIC_PREVIEW_CITIES=kolkata.
//
// SCOPE - region, not city. This is the genuine MMR case and the deciding fact
// is physical rather than administrative: the East Kolkata Wetlands treat
// 910 of Kolkata's 1,400 MLD of sewage - 65%, roughly five times what all five
// of the city's STPs manage combined - and the EKW lies OUTSIDE KMC, in North
// and South 24 Parganas. A KMC-only Kolkata would draw a boundary that excludes
// the city's single largest piece of water infrastructure. Source: KMC's own
// District Environment Plan 2021, filed under the NGT-mandated DEP process.
//
// The corporation set here is deliberately NARROW. The Kolkata Metropolitan
// Area contains multiple corporations and ~38 municipalities, but that
// structure is not yet established to primary - the 3-vs-4 corporation count is
// unresolved and KMDA's site did not yield the figures (research S10, open item
// 12). Rather than model ~38 units off an unverified structure, we model only
// the units whose WATER relationship to KMC is individually verified: the
// wetlands that treat its sewage, the intake that supplies it, and the two
// municipalities it sells bulk water to. The rest of KMA is a named gap on the
// scope card, not a silent omission. Units join as their relationships are
// verified, which is the same discipline the MMR build followed.
//
// SUPPLY MODEL - RUN-OF-RIVER. Kolkata impounds nothing. Supply is Hooghly
// abstraction at Palta plus ~110 MLD of deep tube wells. This is why the city
// needs a new hero: days-left divides live storage by draw rate, and Kolkata's
// numerator does not exist. Not "hard to compute" - undefined. There is no
// volume to run down. cauvery-pumping is equally wrong (it tells a
// lift-vs-design-capacity story; Palta is ~22 km away on the same flat delta,
// there is no lift gap) and allocation is wrong too (entitled-vs-received
// against a dam quota; Hooghly abstraction is not a quota with a receipt).
//
// So Kolkata ships heroMode 'drainage-capacity': the city's water emergency is
// drainage, not scarcity. See drainageCapacity below.
//
// FLAGGED INCONSISTENCY - do not launder. KMC's water-distribution site lists
// plants summing to 2,214.7 MLD plus ~110 MLD of tube wells = 2,324.7 MLD,
// while the SAME page describes a target of ~1,900 MLD generation in 2025 and a
// requirement of ~1,660 MLD. Either the plant figures are post-expansion design
// capacities rather than current output, or the page mixes vintages. The page
// is additionally labelled "(DRAFT)" with a "© 2013" footer. No total-capacity
// number is published anywhere in the product until this is reconciled against
// KMC's budget statements (open item 7). Per-plant capacities below are
// therefore carried as design figures with hasPublicFeed:false, never summed.
//
// CONTESTED DENOMINATOR - KMC's Environment Plan gives 4.5 million residents
// and a 6-million/day floating population; its water-distribution site frames
// demand off a "static population" of 44.96 lakh. The corporation contests its
// own denominator, so defaultConsumptionMld stays null: every LPCD figure for
// Kolkata is unstable at the source and we will not manufacture one. That
// asymmetry is a first-class honest-gap card, and it is unusual - most cities
// hide this, KMC published both halves.
//
// NRW - not found at all in the research pass (open item 6). Combined with
// near-absent domestic volumetric charging and largely unmetered connections,
// Kolkata's governance story is that water is close to free and almost entirely
// unmeasured, which makes non-revenue water and distributional equity
// structurally invisible. Named gap, not an estimate.
//
// GROUNDWATER - this inverts the assumption the research pass started with.
// Kolkata is NOT groundwater-poor: a full India-WRIS station census (2010-2026,
// paged to exhaustion) finds 23 stations in Kolkata district and 667 across the
// six KMA districts, live to 2026-06-04 - denser than Delhi's 237-station
// network, which was enough to carry a per-ward card. Howrah (quiet since
// Apr 2023) and Hooghly (Nov 2022) must render as STALE rather than being
// interpolated over.
//
// WARDS - 144 per KMC's own Environment Plan, but OpenCity's ward KML carries
// only 1-141; 142, 143 and 144 are absent, and the sole attribute is a bare
// `WARD` number with no name and no borough. Ward surfaces stay off until the
// three missing wards are recovered and a name/borough join is built.
export const KOLKATA: CityConfig = {
  cityId: 'kolkata',
  displayName: 'Kolkata',
  displayNameLocalized: { bn: 'কলকাতা' },
  stateCode: 'WB',
  timezone: 'Asia/Kolkata',
  center: { lat: 22.5726, lng: 88.3639 },
  // Wide enough to hold KMC (206.08 km²) plus the verified out-of-KMC units:
  // the EKW east of the city, Palta intake ~22 km north, Budge Budge south.
  bbox: { south: 22.35, north: 22.85, west: 88.15, east: 88.55 },
  primaryAuthority: {
    code: 'kmc_wsd',
    name: 'Kolkata Municipal Corporation, Water Supply Department',
    acronym: 'KMC',
  },
  localGovernment: {
    code: 'kmc',
    name: 'Kolkata Municipal Corporation',
    acronym: 'KMC',
    wardCount: 144,
  },
  // NO CATCHMENT ATLAS, and this says why on the page rather than leaving the
  // view mode silently absent. The atlas delineates each water body's area of
  // influence by D8 flow accumulation over a 30 m bare-earth DEM. That needs
  // terrain. Kolkata has 11 m of relief across 40 km - against Chennai's 43 m,
  // Madurai's 94 m, Bengaluru's 194 m and Mumbai's 338 m, the four cities where
  // it ships. Over a gradient that shallow, with 5,526 water bodies each
  // claiming a catchment and surface water actually moving through a combined
  // sewer network rather than over the ground, the algorithm would return
  // polygons that look authoritative and are not.
  catchmentsGapNote:
    "Kolkata has no catchment view, and that is a deliberate omission rather than a missing dataset. Catchments are delineated by tracing water downhill across a 30 m elevation model - which needs a hill. Kolkata has about 11 metres of fall across 40 kilometres of delta, against 43 m in Chennai and 338 m in Mumbai, the cities where this view ships. At that gradient the method would draw confident-looking boundaries that the ground does not support, and in any case most of Kolkata's runoff travels through a combined sewer network rather than over the surface. We would rather show no catchments than invent them.",
  placeKind: 'region',
  // Kolkata's region story is the OPPOSITE of Mumbai's. MMR is nine
  // corporations competing over one contested pool; here KMC abstracts
  // run-of-river and SELLS water onward, and the units in scope are the ones
  // whose water relationship to it is individually verified.
  regionIntro:
    "The units around the city whose water relationship to it is verified: the wetlands east of Kolkata that treat 65% of its sewage, the Hooghly intake at Palta to the north, and the two municipalities KMC sells bulk water to. Not a contested pool - a corporation that abstracts from a river and sells onward.",
  // See SCOPE above: verified water relationships only, not all of KMA.
  corporations: [
    {
      corporationId: 'kmc',
      displayName: 'Kolkata Municipal Corporation',
      displayNameLocalized: { bn: 'কলকাতা পৌরসংস্থা' },
      acronym: 'KMC',
      unitType: 'municipal_corporation',
      district: 'Kolkata',
      center: { lat: 22.5726, lng: 88.3639 },
      bbox: { south: 22.45, north: 22.65, west: 88.28, east: 88.44 },
      wardCount: 144,
      // Ward geometry is 141/144 with no names or boroughs - see WARDS above.
      // hasWardGeometry stays false until the join is built; a partial ward
      // layer that silently drops three wards is worse than none.
      servedBySourceCodes: ['hooghly_palta', 'garden_reach', 'dhapa', 'kmc_tubewells'],
      data: { hasWardGeometry: false, hasSupplyData: true, hasEquityData: false },
    },
    {
      corporationId: 'bidhannagar',
      displayName: 'Bidhannagar Municipal Corporation',
      acronym: 'BMC-Salt Lake',
      unitType: 'municipal_corporation',
      district: 'North 24 Parganas',
      center: { lat: 22.5697, lng: 88.4297 },
      bbox: { south: 22.52, north: 22.63, west: 88.38, east: 88.49 },
      wardCount: null,
      // Verified relationship: KMC sells it 90 MLD in bulk - an Allocation
      // Ledger row, and the reason it is in scope at all.
      servedBySourceCodes: ['hooghly_palta'],
      data: { hasWardGeometry: false, hasSupplyData: true, hasEquityData: false },
    },
    {
      corporationId: 'budge_budge',
      displayName: 'Budge Budge Municipality',
      acronym: 'Budge Budge',
      unitType: 'municipal_council',
      district: 'South 24 Parganas',
      center: { lat: 22.4708, lng: 88.1748 },
      bbox: { south: 22.43, north: 22.51, west: 88.14, east: 88.22 },
      wardCount: null,
      // Verified relationship: 22.7 MLD bulk purchase from KMC.
      servedBySourceCodes: ['garden_reach'],
      data: { hasWardGeometry: false, hasSupplyData: true, hasEquityData: false },
    },
  ],
  // See CONTESTED DENOMINATOR above - deliberately null.
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  // English live; Bengali advertised as coming soon until its translation pass
  // lands. The drainage-hero strings are en-only today (translations.ts).
  availableLanguages: ['en'],
  upcomingLanguages: ['bn'],
  heroMode: 'drainage-capacity',
  // Both ship with verified, primary-sourced content:
  // - allocations-kolkata.json: the two bulk sales KMC publishes (90 MLD to
  //   Bidhannagar, 22.7 MLD to Budge Budge). Unusual for this platform in that
  //   Kolkata has no entitlement document for its OWN water - run-of-river
  //   abstraction is not a quota with a receipt - so the ledger is entirely
  //   about what the city sells onward, plus five named gaps.
  // - commitments-kolkata.json: the two KEIIP plants KMC's own Environment
  //   Plan recorded at 17% and 14% complete against a March 2022 deadline, in
  //   a document filed December 2021.
  hasAllocationLedger: true,
  hasCommitments: true,
  dashboard: {
    // The EKW sewage balance sits directly under the hero. For a city whose
    // emergency is sewage and drainage rather than scarcity, "where does it
    // go" is the question immediately after "how often do the drains fail".
    // It is also the only surface that can express the platform's strongest
    // Kolkata finding: the city's largest treatment asset is a wetland
    // outside its own boundary.
    sewageBalance: true,
  },
  drainageCapacity: {
    // KMC's own words: "The main sewer network / brick sewer was laid at time
    // of British Regime and it was designed to discharge a rainfall of 6 mm.
    // per hour." This is a DESIGN PROPERTY quoted from a document, not a
    // perishable statistic - which is why it lives in config with its citation
    // rather than as a constant in the component.
    //
    // PRE-PUBLICATION GATE - CLOSED 2026-07-27, but NOT the way it was framed.
    // The gate asked whether post-KEIIP rehabilitated stretches carry a
    // different standard, and assumed a KEIIP DPR would settle it. Re-reading
    // the citation in full shows the premise was mine, not the document's:
    // KMC scopes the 6 mm/h to the British-era brick TRUNK network (180 km),
    // and never claims it for the city's drains as a whole. So there is no
    // conflict for a DPR to resolve - there was an over-broad paraphrase in
    // our hero. Fixed by `standardAppliesTo` below, which makes the headline
    // assert exactly what the citation asserts and no more.
    //
    // Re-verified live on 2026-07-27: the document still serves 200 from
    // kmcgov.in and still carries the sentence verbatim. Its PDF creation
    // date is 19 Dec 2009, consistent with its contents (latest internal
    // date 15/07/2009, reform table ending 2005-09). Sixteen years old and
    // still KMC's current public description of its own drainage - which is
    // itself part of the finding.
    //
    // What a future KEIIP/KMC-SHARP DPR would add is a standard for the NEW
    // sewers, which is a second number to show beside this one, not a
    // correction to it. Registered in Headwaters against keiip.in.
    standardMmPerHour: 6,
    standardSource: {
      publisher: 'Kolkata Municipal Corporation',
      document: 'Sewerage and Drainage',
      year: 2009,
      url: 'https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf',
    },
    standardAppliesTo: "Kolkata's main brick sewers",
    networkNote:
      'The 6 mm/h figure is KMC\'s stated design capacity for the British-era trunk network specifically: 180 km of century-old brick sewer, mostly combined, carrying sewage and stormwater in one conduit, with most pumping stations built 50 to 100 years ago. KMC does not publish a design standard for the newer areas added since, so this chart reads on the core city rather than on all 144 wards.',
    registerLink: {
      // Deliberately NOT "last week". This is static config on a page a
      // reader may open months from now, and the register itself is only as
      // current as the last successful weekly capture - if the job misses a
      // Monday, "last week" becomes a false claim about data we do not have.
      // The timeless phrasing stays true whenever it is read, and the register
      // carries its own period dates for anyone who wants the exact window.
      label: "See where the city actually floods, week by week",
      href: '/kolkata/flood-risk',
    },
  },
  groundwaterViews: {
    // IN-GRES / CGWB block assessment - standing decision applies.
    exploitation: true,
    // 667 stations across KMA is dense by platform standards, but count is not
    // coverage: confirm spatial spread before painting a continuous surface,
    // and Howrah/Hooghly have gone quiet and must not be interpolated over.
    depth: false,
    risk: false,
    // 23 stations in Kolkata district, 667 across the six KMA districts, live
    // to 2026-06-04 via the India-WRIS Ground Water Level API.
    cgwbStations: true,
  },
  reservoirDataSource: 'v2',
  // NOTE: these are per-plant DESIGN capacities carried for identity and
  // provenance. They are never summed into a published total - see FLAGGED
  // INCONSISTENCY above. None has a daily public feed: Kolkata publishes no
  // abstraction or production series at all.
  waterSources: [
    {
      // Indira Gandhi WTP at Palta, Barrackpore (North 24 Parganas) - the
      // city's main intake, ~22 km north on the Hooghly. WBPCB samples the
      // Ganga AT Palta, so raw-water quality at the intake is observable even
      // though abstraction volume is not.
      sourceCode: 'hooghly_palta',
      displayName: 'Hooghly at Palta (Indira Gandhi WTP)',
      type: 'river',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 22.7925,
      longitude: 88.3722,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        "No public daily abstraction or production figure for Palta, the intake that supplies most of Kolkata. The 1,180 MLD figure is a design capacity from a KMC page labelled draft and footered 2013.",
    },
    {
      sourceCode: 'garden_reach',
      displayName: 'Garden Reach Water Works',
      type: 'river',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 22.5484,
      longitude: 88.2921,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        "No public daily production series. 839.4 MLD is a design capacity; a further 225 MLD is described as under construction with no dated completion.",
    },
    {
      sourceCode: 'dhapa',
      displayName: 'Jai Hind Jal Prokolpo (Dhapa)',
      type: 'river',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 22.5453,
      longitude: 88.4142,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote: "No public daily production series; 136.3 MLD is a design capacity.",
    },
    {
      // ~110 MLD. Kolkata's only non-river source, and the one that ties the
      // supply story to the KMA arsenic belt.
      sourceCode: 'kmc_tubewells',
      displayName: 'KMC deep tube wells',
      type: 'borewell_field',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 22.5726,
      longitude: 88.3639,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: false,
      noFeedNote:
        "No public tube-well register or daily draw. The ~110 MLD figure is a single line on KMC's water-distribution page.",
    },
  ],
  sourceNameAliases: {
    hooghly: 'hooghly_palta',
    palta: 'hooghly_palta',
    'indira gandhi wtp': 'hooghly_palta',
    igwtp: 'hooghly_palta',
    'হুগলি': 'hooghly_palta',
    'garden reach': 'garden_reach',
    grww: 'garden_reach',
    dhapa: 'dhapa',
    'jai hind jal prokolpo': 'dhapa',
    'tube wells': 'kmc_tubewells',
    'tubewells': 'kmc_tubewells',
  },
  // Flipped at cutover, with supabase/migrations/039_kolkata_enable.sql kept in
  // step as a record (that column gates nothing today - see delhi.ts).
  enabled: false,
};

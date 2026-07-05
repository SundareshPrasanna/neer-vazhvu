import type { CityConfig } from './types';

// Mumbai is registered DISABLED through the onboarding window (M0). It is
// flipped to enabled: true on the cutover commit once M1 data + M2 UI land;
// the Supabase `cities` table must agree (027_mumbai_seed_disabled.sql now,
// an enable migration at cutover). The [cityId]/layout.tsx guard 404s any
// non-enabled city, so /mumbai is only reachable locally via
// NEXT_PUBLIC_PREVIEW_CITIES=mumbai until then.
//
// SUPPLY MODEL - Mumbai is RESERVOIR-IMPOUNDED like Chennai, NOT pumped-from-
// far like Bangalore. The 7 BMC lakes ARE the city's tap, so heroMode
// 'days-left' (storage / daily draw) is honest. BMC itself publishes a
// days-of-supply-left figure (Hydraulic Engineer lake-level page); daily
// storage rows come from the WRD Pravah bulletin scraper. The 7
// lakes: Bhatsa (largest, ~48% of supply), Upper + Middle Vaitarna, Modak
// Sagar, Tansa, Vihar, Tulsi. NOTE: Ulhas/Barvi serve Thane/Navi Mumbai, NOT
// BMC - deliberately excluded. Gargai (Dec 2025 tender, +440 MLD) is a future
// 8th source, tracked as narrative only, not a live source.
//
// isPrimaryDrinkingSource is TRUE for all 7 (unlike Bangalore/Madurai's
// irrigation-primary upstream dams) - every lake's storage is Mumbai drinking
// water. The lakes sit 30-130 km outside the city bbox (Bhatsa in Shahapur,
// Thane); like Bangalore's Cauvery reservoirs they render as source cards,
// not on the city map. fullCapacityMcft values are converted from BMC's
// published live-storage figures (million litres / 28.317) - i.e. BMC's SHARE
// of each dam, not the dam's total: Bhatsa's WRD total live capacity is 942
// Mcum but BMC's share is ~717 (Thane's own scheme + irrigation draw the
// rest). The reservoir cards show Pravah's percentage of the WRD TOTAL (the
// stored storage_pct_frl), so they stay internally consistent; the computed
// days-left estimate mixes whole-dam storage with BMC-share capacity and so
// overstates BMC's runway - which is why the hero carries a heroNote naming
// the figure as an upper bound. (It used to surface BMC's published days-left
// instead, but that arrived via a mirror feed that died in 2026; BMC's own
// portal page renders only inside a browser session, so there is no live
// published runway left to surface.)
//
// GROUNDWATER - Mumbai City + Mumbai Suburban are EXCLUDED from CGWB's Dynamic
// Ground Water Resources Assessment (no safe/critical/over-exploited category),
// so exploitation/depth/risk are all false. cgwbStations is true: the GW page
// shows the CGWB National Hydrograph Network wells transcribed from the Ground
// Water Year Book of Maharashtra - 25 wells inside Greater Mumbai (53 across
// the MMR incl. Thane/Palghar/Raigad), seasonal levels current to Jan
// 2025 (2024-25 edition, 2022-23 stitched for multi-year depth) - plus a
// per-well water-chemistry panel (EC/chloride/nitrate/fluoride, May 2022) from
// the CGWB GW-quality report. The honest story: monitored shallow groundwater
// is broadly fresh, NOT seawater-poisoned, despite the coast. Built by
// neer-vazhvu-api/scripts/build_mumbai_cgwb_stations.py. Mirrors Madurai's
// CGWB-point pattern.
//
// Ward unit is the 24 BMC administrative wards (A..T, data-rich, geometry from
// datameet BMC_Wards.geojson), NOT the 227 electoral wards (SEC PDFs, no
// GeoJSON, no per-ward data - logged as a gap).
export const MUMBAI: CityConfig = {
  cityId: 'mumbai',
  displayName: 'Mumbai',
  displayNameLocalized: { mr: 'मुंबई' },
  stateCode: 'MH',
  timezone: 'Asia/Kolkata',
  // MMR re-scope (docs/specs/mumbai-mmr.md): "mumbai" now models the Mumbai
  // Metropolitan Region, not just Greater Mumbai. placeKind:'region' + the
  // corporations[] array below carry the region structure; displayName stays
  // the short "Mumbai" for nav. The 7-lake / days-left / BMC-ward content here
  // remains valid as the BMC corporation's slice (the data-rich anchor).
  placeKind: 'region',
  center: { lat: 19.15, lng: 72.99 },
  // Regional extent: the 9 corporations (island city -> Vasai-Virar/Panvel) plus
  // the Western Ghats supply reservoirs (Bhatsa/Vaitarna, ~73.5E / ~19.85N).
  bbox: { south: 18.85, north: 20.0, west: 72.65, east: 73.7 },
  primaryAuthority: {
    code: 'bmc-he',
    name: 'BMC Hydraulic Engineer Department',
    acronym: 'BMC',
  },
  localGovernment: {
    code: 'bmc',
    name: 'Brihanmumbai Municipal Corporation',
    acronym: 'BMC',
    wardCount: 24,
  },
  // BMC draws ~3,850 MLD from the lakes against a stated need of ~4,200 MLD.
  // The days-left runway divides storage by the actual draw (3,850), matching
  // BMC's own published figure; the 350 MLD shortfall is a narrative point, not
  // the runway denominator. No desalination in Mumbai's supply.
  defaultConsumptionMld: 3850,
  // Desalination 0: neither BMC nor any MMR corporation operates a desal
  // plant. Manori (200 MLD) is a proposed project - see manori-desal in the
  // Commitments Register; the ledger tracks it as a future entitlement.
  defaultDesalinationMld: null,
  // Launch posture: English live, Marathi advertised as coming soon (the
  // switcher shows a greyed म chip). Marathi is declared-but-untranslated
  // (1 of ~1,509 keys); move 'mr' into availableLanguages in the dedicated
  // translation PR.
  availableLanguages: ['en'],
  upcomingLanguages: ['mr'],
  heroMode: 'days-left',
  // BMC's Mumbai-lakes feed already publishes "days of supply left in all lakes
  // combined", so the hero surfaces + attributes + links to it rather than
  // posing as the calculator (the what-if sliders are hidden for Mumbai).
  // Every dashboard card names its geography: the days-left hero and the
  // reservoir chart are BMC's slice; the Metropolitan Water System card is
  // the 9-corporation region. Without these badges the dashboard reads as
  // randomly switching between "Mumbai" and "MMR".
  dashboardScopes: {
    city: "Greater Mumbai · BMC's 7 lakes",
    region: 'Mumbai Metropolitan Region · 9 corporations',
  },
  // Coverage honesty for the history chart: the daily Pravah feed began
  // 4 Jul 2026 (each run also writes the same-date-last-year value, so the
  // recent windows fill forward at double speed); Bhatsa + Upper Vaitarna
  // carry 2015-2025 weekly history from CWC bulletins (series ended May
  // 2025); the smaller dams have no public archive at all.
  // Open on the full decade: the 90d/1yr windows hold only the young daily
  // feed (a handful of points) and read as broken.
  reservoirHistoryDefaultRange: 'all',
  reservoirHistoryNote:
    'Coverage: Bhatsa and Upper Vaitarna have weekly history from Feb 2015 to May 2025 ' +
    '(CWC bulletins, since discontinued). Ingestion of the WRD Pravah daily bulletin ' +
    '(mwrdpravah.in) started 4 July 2026 for all five dams; each run also records the ' +
    "bulletin's same-date-last-year value, so recent windows fill in as it runs. " +
    'Middle Vaitarna, Modak Sagar and Tansa have no public archive before that; Vihar and Tulsi have no public feed.',
  // Honesty caveat under the days-left number (see SUPPLY MODEL note above).
  heroNote:
    'Upper-bound estimate: storage counts the full live water in the five state-owned dams, ' +
    'part of which serves users beyond BMC.',
  // Link the portal's stable entry page, NOT the PDF endpoint: the PDF URL
  // intermittently serves an OFBiz error page (the scraper tolerates this;
  // a citation link must not), and the bare domain root 404s by design.
  heroNoteSource: {
    label: 'Storage data: Maharashtra WRD Pravah portal',
    url: 'https://mwrdpravah.in/damsafety/control/main',
  },
  // Shoreline-change surface: same GEE MNDWI transect pipeline as Chennai
  // (west-coast orientation), corroborated by the published record (NCCR
  // 1990-2016 district table + MSMP 2017 risk grades) instead of a
  // rate-publishing paper - none exists for Mumbai.
  hasShoreline: true,
  // The Allocation Ledger: the MMR is the richest instance of the primitive -
  // four intermediaries (MIDC/STEM/MMRDA/CIDCO), nine buyers, an oversubscribed
  // authority. ~16 arrangements compiled in allocations-mumbai.json.
  hasAllocationLedger: true,
  // Commitments register: ~19 dated commitments (WWTF commissioning dates, NGT
  // deadlines, flood-mitigation claims) with cited status histories.
  hasCommitments: true,
  groundwaterViews: {
    exploitation: false,
    // Ward depth is interpolated (IDW) from the curated Year Book wells via the
    // wards-interpolated static fallback - same method as Madurai, with a denser
    // in-city network (25 wells across 24 BMC wards vs Madurai's 21 across 100).
    depth: true,
    risk: false,
    cgwbStations: true,
  },
  waterSources: [
    {
      sourceCode: 'bhatsa',
      displayName: 'Bhatsa',
      type: 'reservoir',
      fullCapacityMcft: 25321.9,
      fullTankLevelFt: null,
      latitude: 19.55,
      longitude: 73.45,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'upper_vaitarna',
      displayName: 'Upper Vaitarna',
      type: 'reservoir',
      fullCapacityMcft: 8018.1,
      fullTankLevelFt: null,
      latitude: 19.95,
      longitude: 73.47,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'middle_vaitarna',
      displayName: 'Middle Vaitarna',
      type: 'reservoir',
      fullCapacityMcft: 6834.4,
      fullTankLevelFt: null,
      latitude: 19.83,
      longitude: 73.4,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'modak_sagar',
      displayName: 'Modak Sagar',
      type: 'reservoir',
      fullCapacityMcft: 4552.9,
      fullTankLevelFt: null,
      latitude: 19.78,
      longitude: 73.18,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'tansa',
      displayName: 'Tansa',
      type: 'reservoir',
      fullCapacityMcft: 5123.5,
      fullTankLevelFt: null,
      latitude: 19.63,
      longitude: 73.3,
      catchmentAreaSqkm: null,
      displayOrder: 5,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'tulsi',
      displayName: 'Tulsi',
      type: 'reservoir',
      fullCapacityMcft: 284.1,
      fullTankLevelFt: null,
      latitude: 19.16,
      longitude: 72.9,
      catchmentAreaSqkm: null,
      displayOrder: 6,
      isPrimaryDrinkingSource: true,
    },
    {
      sourceCode: 'vihar',
      displayName: 'Vihar',
      type: 'reservoir',
      fullCapacityMcft: 978.2,
      fullTankLevelFt: null,
      latitude: 19.14,
      longitude: 72.91,
      catchmentAreaSqkm: null,
      displayOrder: 7,
      isPrimaryDrinkingSource: true,
    },
  ],
  sourceNameAliases: {
    bhatsa: 'bhatsa',
    'भातसा': 'bhatsa',
    'upper vaitarna': 'upper_vaitarna',
    'middle vaitarna': 'middle_vaitarna',
    vaitarna: 'upper_vaitarna',
    'modak sagar': 'modak_sagar',
    modaksagar: 'modak_sagar',
    'lower vaitarna': 'modak_sagar',
    'मोडकसागर': 'modak_sagar',
    tansa: 'tansa',
    'तानसा': 'tansa',
    tulsi: 'tulsi',
    vihar: 'vihar',
  },
  // The 9 municipal corporations of the MMR (boundaries in
  // public/geojson/mumbai-corporations-2024.geojson, from OSM). The corporation
  // is the region's always-present comparable sub-unit; ward drill-down + deep
  // data are per-corporation enrichments (the `data` flags), only fully present
  // for BMC today. center/bbox are OSM-derived. servedBySourceCodes wires the
  // source -> corporation supply graph; only BMC's edges are known at P0 (the
  // 7 lakes) - the rest (Barvi/Morbe/Surya/Hetawane/Ulhas) land in P2 once those
  // sources are added to waterSources. wardCount/data for non-BMC corps stay
  // null/false until their data is sourced (shown as named gaps, not faked).
  corporations: [
    {
      corporationId: 'bmc',
      displayName: 'Greater Mumbai',
      displayNameLocalized: { mr: 'बृहन्मुंबई' },
      acronym: 'BMC',
      unitType: 'municipal_corporation',
      district: 'Mumbai City + Suburban',
      center: { lat: 19.06, lng: 72.8325 },
      bbox: { south: 18.8922, north: 19.2695, west: 72.7732, east: 72.9817 },
      wardCount: 24,
      wardsVintage: '2023',
      servedBySourceCodes: [
        'bhatsa', 'upper_vaitarna', 'middle_vaitarna', 'modak_sagar', 'tansa', 'tulsi', 'vihar',
      ],
      data: { hasWardGeometry: true, hasSupplyData: true, hasEquityData: true, hasRiskComposite: true },
    },
    {
      corporationId: 'tmc',
      displayName: 'Thane',
      acronym: 'TMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.1976, lng: 72.9893 },
      bbox: { south: 19.1316, north: 19.3002, west: 72.9104, east: 73.0771 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'kdmc',
      displayName: 'Kalyan-Dombivli',
      acronym: 'KDMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.2183, lng: 73.1322 },
      bbox: { south: 19.1422, north: 19.3118, west: 73.0612, east: 73.2399 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'nmmc',
      displayName: 'Navi Mumbai',
      acronym: 'NMMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.0637, lng: 73.0059 },
      bbox: { south: 18.9984, north: 19.1895, west: 72.9779, east: 73.0497 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'mbmc',
      displayName: 'Mira-Bhayandar',
      acronym: 'MBMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.2735, lng: 72.8202 },
      bbox: { south: 19.2307, north: 19.3283, west: 72.7786, east: 72.9376 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'vvcmc',
      displayName: 'Vasai-Virar',
      acronym: 'VVCMC',
      unitType: 'municipal_corporation',
      district: 'Palghar',
      center: { lat: 19.4226, lng: 72.8226 },
      bbox: { south: 19.287, north: 19.5275, west: 72.7442, east: 72.9625 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'bncmc',
      displayName: 'Bhiwandi-Nizampur',
      acronym: 'BNCMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.2899, lng: 73.0653 },
      bbox: { south: 19.2645, north: 19.3235, west: 73.0325, east: 73.1036 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'umc',
      displayName: 'Ulhasnagar',
      acronym: 'UMC',
      unitType: 'municipal_corporation',
      district: 'Thane',
      center: { lat: 19.22, lng: 73.1658 },
      bbox: { south: 19.1909, north: 19.2548, west: 73.146, east: 73.1794 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
    {
      corporationId: 'pmc',
      displayName: 'Panvel',
      acronym: 'PMC',
      unitType: 'municipal_corporation',
      district: 'Raigad',
      center: { lat: 19.0282, lng: 73.1005 },
      bbox: { south: 18.9684, north: 19.1146, west: 73.0437, east: 73.1489 },
      wardCount: null,
      servedBySourceCodes: [],
      data: {},
    },
  ],
  // Lake Catchment Atlas: per-water-body area-of-influence over Mumbai's ~84
  // OSM lakes >=1 ha (incl. Powai/Vihar/Tulsi), terrain-derived from FABDEM via
  // scripts/run_cascade.py --district mumbai. Unlike Madurai/Bangalore this is
  // NOT a tank-cascade story (Mumbai is reservoir-impounded), but the catchment
  // delineation + the modest local cascades (26 edges, mostly in the SGNP/Aarey
  // belt) are honest terrain output. Enables the Catchments view on
  // /mumbai/water-bodies + the catchment/cascade about-page methodology.
  hasCascadeOverlay: true,
  enabled: true,
};

import type { CityConfig } from './types';

// Delhi is registered DISABLED through the onboarding window. It is flipped to
// enabled: true on the cutover commit once data + UI land; the Supabase
// `cities` table must agree (031_delhi_seed_disabled.sql now, an enable
// migration at cutover). Until then /delhi is reachable only via
// NEXT_PUBLIC_PREVIEW_CITIES=delhi.
//
// SCOPE - standalone NCT Delhi (the Chennai model), NOT an NCR region (the
// Mumbai MMR model). The satellite cities (Gurugram/Noida/Ghaziabad/...) sit in
// three different states with three PCBs, separate utilities, and no shared
// supply or regional data spine - none of the conditions that justified the MMR
// re-scope hold. The genuinely trans-boundary Yamuna story (Hathnikund -> Munak
// -> 22 km Delhi stretch -> Okhla -> Agra) belongs to a future Yamuna basin
// surface via basinIds, not to city scope. Pages declare their scope per the
// Madurai rule: NCT for dashboard/groundwater/my-ward, Yamuna-basin context
// (labelled) for rivers/flood-risk.
//
// SUPPLY MODEL - Delhi is PUMPED-FROM-FAR like Bangalore, NOT reservoir-
// impounded like Chennai/Mumbai. The city owns no storage: ~90% of raw water
// arrives through inter-state instruments (1994 Yamuna MoU 0.724 BCM/yr via
// Wazirabad + the Munak Canal ~700-1,050 cusecs; Bhakra share via BBMB TC
// minutes; Tehri 300 cusecs / 162 MGD; Upper Ganga Canal at Muradnagar), plus
// ~10% own groundwater. 9 DJB WTPs produce ~960 MGD (~4,365 MLD) against
// ~1,400 MGD demand. A days-left hero is meaningless (no impounded runway);
// the honest hero is the supply-chain story ('cauvery-pumping' variant:
// 240 km from Bhakra, 102 km Munak lifeline, NRW 51-53% per CAG Report No. 3
// of 2025). heroMode stays 'none' until public/data/delhi-supply-overview.json
// is compiled - flip it in the same commit.
//
// NONE of the six sources has an ingestible public feed - verified 2026-07-25:
//   - Bhakra: SUPERSEDED 2026-07-26 - BBMB RESUMED daily publication. Its
//     bulletin served "as on 26-07-2026 06:00 Hrs" (Bhakra 1592.91 ft, inflow
//     40,363 / outflow 26,132 cusecs). Now scraped by
//     neer-vazhvu-api/scripts/scrape_bbmb_dams.py into
//     public/data/bbmb-dam-storage.json. hasPublicFeed stays false below only
//     until the first launchd run populates reservoir_daily_v2 - see the note
//     on the bhakra source.
//   - Tehri + Bhakra via CWC: the weekly Reservoir Storage Bulletin listing
//     ends 08.05.2025 (the series that fed Mumbai's backfill is dormant).
//   - Munak Canal flow, Wazirabad pond level, UGC flow: news-NER / RTI only.
//   - Groundwater: no DJB tube-well census exists (CAG flags its absence).
// So every source carries hasPublicFeed:false + a noFeedNote naming WHO would
// have to publish. Delhi's live daily layer is rainfall (IMD gridded history +
// Open-Meteo provisional, in the daily cron); its monthly layer is DPCC.
// That entitled-vs-opaque asymmetry is the Allocation Ledger story - Delhi is
// the strongest instance of the primitive on the platform.
//
// full_capacity is NULL for Bhakra/Tehri: Delhi's share of either dam is not a
// published capacity number (share fixed per-season in BBMB TC / UYRB minutes);
// storing whole-dam capacity would repeat the Mumbai upper-bound problem
// without Mumbai's mitigating heroNote, so we don't pretend.
//
// GROUNDWATER - CGWB assesses NCT in ~8 blocks/tehsils; Najafgarh, Mehrauli and
// Alipur are Over-Exploited (CGWB 2024; NCT extracts >100% of annual
// availability, reconfirmed in the 2025 national compilation). exploitation
// choropleth is honest once gwr-blocks-delhi lands. risk_v2_dl now ships
// (own weights, NOT Chennai's) on top of 237 CGWB observation wells pulled
// from the India-WRIS Ground Water Level API - which is reachable and was
// never the blocker; the blocker was an undocumented contract in which a
// blank districtName/agencyName returns zero rows instead of all rows.
// Interpolated per-ward depth stays off on purpose (see groundwaterViews).
// CGWA does not regulate
// Delhi groundwater (NCT NOCs are GNCTD government orders) - a narrative
// angle, not a data gap.
//
// WARD UNIT - 250 MCD wards (post-2022 unification + delimitation; NOT the
// pre-merger 272 or the commonly-cited 270). NDMC (Lutyens, ~3% of Delhi) and
// Delhi Cantonment sit outside MCD and DJB retail supply - flagged in copy,
// not modelled as corporations.
//
// NETWORK CONSTRAINT (build-time, from the 2026-07-20 audit refresh): every
// NICNET host (cpcb.nic.in, yamuna-revival.nic.in, arc.indiawris.gov.in,
// Bhuvan/NDRF) refuses non-India IPs. All such scrapers run via the India-IP
// runner path (launchd stopgap pattern), never from CI.
export const DELHI: CityConfig = {
  cityId: 'delhi',
  displayName: 'Delhi',
  displayNameLocalized: { hi: 'दिल्ली' },
  stateCode: 'DL',
  timezone: 'Asia/Kolkata',
  center: { lat: 28.61, lng: 77.21 },
  // NCT extent per the audit: 28.40-28.90 N, 76.85-77.40 E. The supply
  // reservoirs (Bhakra ~31.4N, Tehri ~30.4N) sit hundreds of km outside and
  // render as source cards, not on the city map - the Bangalore pattern.
  bbox: { south: 28.4, north: 28.9, west: 76.85, east: 77.4 },
  primaryAuthority: {
    code: 'djb',
    name: 'Delhi Jal Board',
    acronym: 'DJB',
  },
  localGovernment: {
    code: 'mcd',
    name: 'Municipal Corporation of Delhi',
    acronym: 'MCD',
    wardCount: 250,
  },
  // ~960 MGD WTP production = ~4,365 MLD (the supply side; demand is ~1,400
  // MGD / ~6,365 MLD - the ~30% structural deficit is narrative, not the
  // denominator). Sources: DJB water page + CAG Report No. 3 of 2025.
  defaultConsumptionMld: 4365,
  defaultDesalinationMld: null,
  // Launch posture mirrors Mumbai: English live, Hindi advertised as coming
  // soon (greyed हि chip) until its translation pass lands.
  availableLanguages: ['en'],
  upcomingLanguages: ['hi'],
  // delhi-supply-overview.json landed 2026-07-20 (CAG + Economic Survey
  // anchored, with hero_copy overrides replacing the Bangalore-specific
  // pump.* narrative). See SUPPLY MODEL above.
  heroMode: 'cauvery-pumping',
  // Both ship as data work in P2, then flip:
  // - allocations-delhi.json: MoU/Munak/Tehri/Bhakra/UGC instruments vs
  //   opaque realizations (audit refresh has the seed table).
  // - commitments-delhi.json: 8 pre-qualified dated promises (39-drain
  //   trapping deadline 30-Jun-2026, Mission Sahibi, Rs 860 cr DSTPs,
  //   1,250 MGD by Jun 2027, ...).
  // Seed compilations landed 2026-07-20 (5 arrangements; 8 commitments) -
  // enabled for preview; content deepens through the build.
  hasAllocationLedger: true,
  hasCommitments: true,
  groundwaterViews: {
    // District-level CGWB Dynamic GWR 2025 choropleth (11 districts +
    // non-spatial Nazul Land), values + polygons both via OpenCity - no
    // NICNET dependency (build_delhi_gwr_blocks.py). 2022 history included.
    // 2025 Over-Exploited: New Delhi 123%, Shahdara 112%, North East 106%,
    // South 103%; NCT overall 92.1%.
    exploitation: true,
    // Interpolated per-ward depth stays OFF. 237 wells over 1,483 sq km is
    // dense enough to place points honestly but not to paint a continuous
    // surface: the ridge drops from ~2 m to ~68 m over a few km, so IDW
    // between a floodplain well and a ridge well invents intermediate
    // values that no instrument saw.
    depth: false,
    // risk_v2_dl (scripts/compute-delhi-ward-risk.py): measured CGWB well
    // depth + district extraction stage + DUSIB JJ-basti household share +
    // chronic flood spots + water-body density.
    risk: true,
    // 237 CGWB observation wells via the India-WRIS Ground Water Level API
    // (build_delhi_cgwb_stations.py). Delhi's assessment choropleth resolves
    // only to 11 districts; these resolve to points.
    cgwbStations: true,
  },
  reservoirDataSource: 'v2',
  // Delhi impounds nothing. It draws a canal share, a river pond and a
  // borewell field, and its two dam entitlements (Bhakra, Tehri) sit in other
  // states' reservoirs where the storage published is the whole dam's, never
  // Delhi's slice. So there is no storage series to chart and there will not
  // be one until BBMB or THDC publish a share - which is a finding about who
  // holds the numbers, not a backlog item.
  reservoirHistoryAbsentNote:
    "Delhi owns no reservoir storage of its own, so no authority publishes a daily storage series for it. BBMB publishes Bhakra's level, inflow and outflow but not Delhi's share as a volume, and Delhi's share of the dam is set per season in BBMB Technical Committee minutes that are not public. Each source card below names who would have to publish the number.",
  waterSources: [
    {
      // The Yamuna arm: Wazirabad pond feeds Wazirabad + Chandrawal WTPs.
      // Pond level appears in news during crises only - no public feed.
      sourceCode: 'yamuna_wazirabad',
      displayName: 'Yamuna at Wazirabad',
      type: 'river',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 28.71,
      longitude: 77.23,
      catchmentAreaSqkm: null,
      displayOrder: 1,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        "No public daily gauge for the Wazirabad pond. Levels surface only in crisis reporting and Supreme Court filings.",
    },
    {
      // 102 km Munak Canal (Carrier-Lined Channel from Munak, Haryana):
      // ~700-1,050 cusecs = ~70% of raw water, feeding Haiderpur/Nangloi/
      // Bawana/Dwarka/Okhla WTPs. No public flow API - news-NER pipeline.
      sourceCode: 'munak_canal',
      displayName: 'Munak Canal (CLC)',
      type: 'flow_station',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 29.05,
      longitude: 76.98,
      catchmentAreaSqkm: null,
      displayOrder: 2,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        "No public daily flow for the 102-km Munak carrier - the single largest input to Delhi's supply. Carriage figures appear only when a shortfall reaches court (June 2024).",
    },
    {
      // Upper Ganga Canal at Muradnagar (UP) feeds Bhagirathi + Sonia Vihar
      // WTPs (~254 MGD). No public daily flow.
      sourceCode: 'upper_ganga_canal',
      displayName: 'Upper Ganga Canal',
      type: 'flow_station',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 28.78,
      longitude: 77.5,
      catchmentAreaSqkm: null,
      displayOrder: 3,
      isPrimaryDrinkingSource: true,
      hasPublicFeed: false,
      noFeedNote:
        "No public daily release on the Upper Ganga Canal leg; the channel also closes for UP's annual canal maintenance with no Delhi-visible schedule.",
    },
    {
      // Bhakra (Gobind Sagar, Sutlej) - Delhi's furthest source, ~240 km.
      // Whole-dam storage is public (BBMB daily HTML + CWC weekly); Delhi's
      // share is fixed in BBMB TC minutes and NOT published as a capacity,
      // hence full_capacity NULL (see header).
      sourceCode: 'bhakra',
      displayName: 'Bhakra (BBMB share)',
      type: 'reservoir',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 31.41,
      longitude: 76.43,
      catchmentAreaSqkm: null,
      displayOrder: 4,
      isPrimaryDrinkingSource: false,
      // CORRECTED 2026-07-26. The 2026-07-25 verification recorded BBMB as
      // frozen since 04.09.2025; it has RESUMED. The bulletin now publishes
      // daily at https://bbmb.gov.in/writereaddata/Portal/Images/pdf/res_data.pdf
      // and scrape_bbmb_dams.py parses it (level + inflow + outflow; no
      // storage, because level over FRL is not a volume ratio and Delhi's
      // share is still unpublished).
      //
      // FLIPPED TRUE 2026-07-26, once the first --supabase run had actually
      // landed a row (reservoir_daily_v2, city_id=delhi, 2026-07-26, level
      // 1592.91 ft) - so the derived delhi:reservoir:bhakra staleness check
      // has something to measure instead of alerting on an empty table.
      //
      // Delhi's FIRST raw-water feed. Every other source here is still
      // hasPublicFeed:false, and the asymmetry is the Allocation Ledger story.
      //
      // URGENT: BBMB overwrites one file daily with no archive and no dated
      // URLs. Every day the launchd scraper does not run is lost permanently.
      hasPublicFeed: true,
    },
    {
      // Tehri (Bhagirathi, THDC) - 300 cusecs / 162 MGD allocated to Delhi.
      // Reservoir storage is in the CWC weekly bulletin / WRIS; Delhi's
      // realized daily release is not public (RTI target).
      sourceCode: 'tehri',
      displayName: 'Tehri (Delhi share)',
      type: 'reservoir',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 30.38,
      longitude: 78.48,
      catchmentAreaSqkm: null,
      displayOrder: 5,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: false,
      noFeedNote:
        "THDC publishes Tehri's 300-cusec allocation to Delhi but no daily release against it; the CWC weekly bulletin that carried Tehri storage stopped in May 2025.",
    },
    {
      // ~10% of supply from DJB tube-wells + Ranney wells. No public census -
      // the CAG audit explicitly flags the register's absence.
      sourceCode: 'djb_groundwater',
      displayName: 'DJB tube-wells & Ranney wells',
      type: 'borewell_field',
      fullCapacityMcft: null,
      fullTankLevelFt: null,
      latitude: 28.61,
      longitude: 77.21,
      catchmentAreaSqkm: null,
      displayOrder: 6,
      isPrimaryDrinkingSource: false,
      hasPublicFeed: false,
      noFeedNote:
        "No public tube-well register exists - the CAG's audit records its absence as a finding.",
    },
  ],
  sourceNameAliases: {
    yamuna: 'yamuna_wazirabad',
    wazirabad: 'yamuna_wazirabad',
    'munak canal': 'munak_canal',
    munak: 'munak_canal',
    clc: 'munak_canal',
    'carrier lined channel': 'munak_canal',
    'upper ganga canal': 'upper_ganga_canal',
    ugc: 'upper_ganga_canal',
    muradnagar: 'upper_ganga_canal',
    bhakra: 'bhakra',
    'gobind sagar': 'bhakra',
    'भाखड़ा': 'bhakra',
    tehri: 'tehri',
    'टिहरी': 'tehri',
  },
  // Launch cutover 2026-07-26. THIS is the switch that matters: it gates the
  // /delhi route guard in [cityId]/layout.tsx and promotes Delhi from
  // "onboarding" to "live" on the landing status board.
  // The `cities.enabled` column in Supabase is kept in step by
  // supabase/migrations/033_delhi_enable.sql, but that column is currently
  // read by no code - it is a record, not a gate. Bengaluru shipped in June
  // 2026 and sat at enabled=FALSE there for weeks with nothing breaking.
  enabled: true,
};

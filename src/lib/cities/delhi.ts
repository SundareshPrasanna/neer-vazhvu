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
// None of the six sources has a public daily feed for DELHI'S SHARE:
//   - Bhakra + Tehri reservoir STORAGE is public (BBMB daily HTML; CWC weekly
//     bulletin / WRIS), so those two carry hasPublicFeed and can show storage
//     cards like Bangalore's upstream Cauvery dams - but Delhi's realized draw
//     is not published anywhere.
//   - Munak Canal flow, Wazirabad pond level, UGC flow: news-NER / RTI only.
//   - Groundwater: no DJB tube-well census exists (CAG flags its absence).
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
// choropleth is honest once gwr-blocks-delhi lands. Per-ward depth/risk stay
// off until a risk_v2_dl composite is built (separate config, NOT Chennai
// weights - see the audit's risk-methodology section). CGWA does not regulate
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
    // Honest-off until public/data/gwr-blocks-delhi.json + geojson land
    // (CGWB block ArcGIS is NICNET-gated - India-IP runner task). Flag ON
    // with no data renders an empty choropleth shell, which QA caught.
    exploitation: false,
    depth: false,
    risk: false,
    cgwbStations: false,
  },
  reservoirDataSource: 'v2',
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
  enabled: false,
};

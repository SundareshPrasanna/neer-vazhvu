import type { CityConfig } from './types';

// Gurugram went LIVE on 2026-08-15 as the ninth city. `enabled: true` is the
// only functional switch: the route guard in [cityId]/layout.tsx reads it, and
// the `enabled` column in the Supabase `cities` table is read by no code at all
// (043 keeps that row honest for a fresh rebuild, but it is consistency, not a
// gate).
//
// SHIPPED THIN, ON PURPOSE AND ON RECORD. Six nav routes against Hyderabad's
// thirteen. Two things are missing and neither is a bug to hunt: there is no
// Origins narrative yet, and there is no hero, because every supply figure in
// circulation for this city is press-sourced and GMDA's own GIS contradicts
// the most-quoted pair. Both are named in the exemption register rather than
// left to look like oversights. What IS here is the signature issue, sourced
// properly, and a tanker ledger no other city on the platform can match.
//
// Plan and source verification: docs/specs/gurugram-onboarding.md (local).
// Data acquisition landed in neer-vazhvu#264; this file is the config that
// points the shared surfaces at it.
//
// WHAT KIND OF CITY THIS IS, because it drives every value below. Gurugram
// has no river, no reservoir and no storage of its own. Water arrives by
// canal from the Yamuna, by borewell (GMDA maps 524 municipal tubewells),
// and by tanker. The Central Ground Water Authority declared it a dark zone
// in 2008 and extraction has continued since. So the reservoir machinery
// that anchors Chennai, Mumbai and Hyderabad has nothing to render here, and
// saying that plainly is better than a hero with no numbers behind it.
//
// AUTHORITY SPLIT. GMDA is the metropolitan authority that runs bulk supply,
// the WTPs and the tanker fleet; MCG is the municipal corporation with the
// 36 wards. primaryAuthority is therefore GMDA and localGovernment is MCG -
// the same shape as Hyderabad's HMWSSB-over-GHMC, and NOT the MMR region
// model: there is one water utility here, not nine competing ones.
//
// HERO: 'none', deliberately, and this is the honest call rather than a
// placeholder. 'cauvery-pumping' is the right eventual mode - its own
// docstring describes "pumped from a long way away + local groundwater +
// tankers", which is a literal description of Gurugram - but it renders
// engineering-document numbers from a <cityId>-supply-overview.json that
// does not exist yet. Every supply and demand figure in circulation for
// this city (570 MLD supplied, 675-700 MLD peak demand, extraction at 195%
// of recharge) is press-sourced, and the one primary contradiction found so
// far cuts against them: GMDA's own GIS publishes Chandu Budhera at 300 MLD
// and Basai at 272, against the widely-quoted 400 and 270. Shipping a hero
// on unverified numbers would be worse than shipping none.
export const GURUGRAM: CityConfig = {
  cityId: 'gurugram',
  displayName: 'Gurugram',
  displayNameLocalized: { hi: 'गुरुग्राम' },
  stateCode: 'HR',
  timezone: 'Asia/Kolkata',
  // Centre and bbox are COMPUTED from the harvested MCG ward geometry
  // (public/geojson/gurugram-wards-2026.geojson), not looked up: the wards
  // span 76.9351-77.1762 E, 28.3306-28.5415 N. Padded west and south to
  // cover the GMDA metropolitan area, because the water-body register
  // legitimately reaches to 76.66 E / 28.21 N - out past Farrukhnagar and
  // Sohna, well beyond the corporation. The map should show the water
  // system, not the municipal boundary.
  center: { lat: 28.436, lng: 77.056 },
  bbox: { south: 28.2, north: 28.56, west: 76.64, east: 77.25 },
  primaryAuthority: {
    code: 'gmda',
    name: 'Gurugram Metropolitan Development Authority',
    acronym: 'GMDA',
  },
  localGovernment: {
    code: 'mcg',
    name: 'Municipal Corporation of Gurugram',
    acronym: 'MCG',
    // 36, counted from GMDA OneMap's own MCG_Wards_Boundary layer rather
    // than taken from a news figure. The layer carries ward_no 1-36 and a
    // zone code, and publishes no ward NAME - so ward surfaces here can
    // label by number and zone only.
    wardCount: 36,
  },
  // Hindi, already in LanguageCode from Delhi - so unlike Surat's Gujarati
  // this city adds no new-language cost. Shipping English-first with hi
  // advertised as upcoming, the same posture as Kannada and Marathi.
  availableLanguages: ['en'],
  upcomingLanguages: ['hi'],
  // No reservoirs, no storage, nothing to impound. The empty array is the
  // point rather than an omission.
  waterSources: [],
  sourceNameAliases: {},
  defaultConsumptionMld: null,
  defaultDesalinationMld: null,
  // 'cauvery-pumping' - whose own docstring describes "we pump it from a long
  // way away + local groundwater + tankers", a literal description of this
  // city. Switched on 2026-08-15 once the numbers behind it were the
  // publisher's own rather than a newspaper's.
  //
  // The hero reads gurugram-supply-overview.json, built by
  // build_gurugram_supply.py, which reads GMDA's OneMap asset register AT BUILD
  // TIME rather than transcribing it - so the headline cannot drift from what
  // the authority publishes.
  //
  // WHAT IT DELIBERATELY DOES NOT SHOW: a deficit. GMDA's register puts
  // installed treatment at 572 MLD (Chandu Budhera 300, Basai 272) where the
  // press consistently says 670, and the "675-700 MLD peak demand" figure has
  // no primary source we could reach - the Final Development Plan and Social
  // Infrastructure Development Plan are scanned PDFs with no text layer. Both
  // capacity figures are on the page with their sourcing; the subtraction is
  // not, because it is exactly the number that would be quoted back at us.
  heroMode: 'cauvery-pumping',
  // Says WHY there is no storage history instead of promising one will
  // appear. Gurugram impounds nothing: there is no dam to publish a level
  // for, so this is a permanent property of the city, not a backfill gap.
  reservoirHistoryAbsentNote:
    'Gurugram impounds no water of its own. It has no reservoir and no dam, so no storage series exists to chart - here or anywhere else. Its supply is canal water from the Yamuna, groundwater from municipal tubewells, and tankers.',
  // The tanker page. THIRD kind: not Bengaluru's household price survey and
  // not Hyderabad's booking/delivery ledger. See tankerDataKind in types.ts
  // for why the three cannot share a renderer.
  tankerDataKind: 'utility-sales-ledger',
  tankerSummary:
    "GMDA's own bulk-water sales ledger - every tanker load it sold, to whom, and at what price.",
  waterBodies: {
    // OFF: needs the Supabase water_bodies_census table, which is a
    // different dataset from GMDA's register.
    censusSource: false,
    // OFF: no restoration-priority-gurugram.json yet.
    rankingTab: false,
    // OFF: needs gurugram-ward-profiles.json. The ward GEOMETRY exists (36
    // polygons) but nothing is joined to it yet.
    wardSearch: false,
    // OFF, and this one needs stating carefully rather than being read as a
    // backfill gap. GMDA's register carries its own cross-survey flags per
    // waterbody (ror/soi/wv_12/drone/ge), so 283 of 824 bodies match a 1956
    // revenue-record plot and 29 of those are absent from WorldView 2012.
    // That is a genuine lost-bodies signal AND it is the publisher's own
    // attribution rather than a spatial join of ours. It stays off only
    // until it is rendered as a derived layer; what must never ship is the
    // raw count series 640 (1956) -> 519 (1976) -> 824 (2012), which RISES
    // at the end because three survey methods have three inclusion criteria.
    lostBodies: false,
  },
  groundwaterViews: {
    // ON. IN-GRES is the canonical assessment source (standing decision), and
    // it turns out to carry Gurugram at full depth: four assessment years to
    // 2024-25, district AND block level, all current.
    //
    // This is the number the city is about. Gurugram district extracts
    // 194.59% of its annual recharge - almost exactly the "~195%" the research
    // drop asserted with no source behind it, now replaced by the primary one.
    // At block level it is worse and more specific: GURGAON_URBAN is at
    // 326.26%, the built city extracting more than three times what it takes
    // in, with Pataudi 168.48, Sohna 156.86, Farrukh Nagar 143.39 and rural
    // Gurgaon 106.91. Every one of the five is over-exploited. For context the
    // Haryana state figure is 136.75%.
    //
    // The neighbours are carried deliberately: Nuh (Mewat) semi-critical,
    // Palwal critical, Rewari and Faridabad over-exploited, Jhajjar safe. The
    // aquifer does not stop at the district line, and Jhajjar being safe is
    // what makes the rest legible as a local failure rather than a regional
    // condition.
    exploitation: true,
    // OFF, and NOT for lack of a pipeline. The India-WRIS LEVEL series for
    // Gurugram is 37 stations that stop in June 2020, and the district has no
    // WRIS telemetry at all - the two Haryana telemetry exports cover 14
    // districts and Gurugram is not one of them. So there is no current depth
    // surface to interpolate, and 37 stations across 36 wards would not carry
    // honest per-ward precision even if there were.
    depth: false,
    risk: false,
    // OFF for the same reason: the point network exists but ends June 2020.
    // Revisit if HWRA or a CGWB Year Book yields a post-2020 series.
    cgwbStations: false,
  },
  // OFF because the pipeline has not run here, NOT because Gurugram cannot
  // support it - GMDA's own GIS carries a 10-polygon Watershed_Gurugram layer
  // and a natural-flow-direction layer, and the Aravalli gives real relief to
  // delineate against. So no catchmentsGapNote: that field is for cities where
  // the view is impossible (Kolkata's 11 m of relief across 40 km of delta),
  // and claiming a reason here would be inventing one.
  //
  // Worth recording for whoever builds it: Aravalli johads and village ponds
  // are a real water heritage but they are NOT a tank cascade. No
  // chained-surplus system was engineered here the way it was in the Tamil
  // kanmoi districts or the Bengaluru kere chains, so the cascade narrative
  // must not be told about this city even once the catchment layer exists.
  hasCascadeOverlay: false,
  // Landlocked.
  hasShoreline: false,
  enabled: true,
};

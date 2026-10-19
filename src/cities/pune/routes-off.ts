import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Pune - preview-gated, city ten. The set is small on purpose: only the
  // surfaces with real artifacts behind them are on. Two of the absences
  // below are properties of what Maharashtra publishes rather than backlog.
  // RETIRED 2026-08-17. The recorded reason was that Maharashtra WRD
  // publishes Pune's statutory red and blue flood lines as 518 SCANNED PDF map
  // sheets with no vector form, so the hazard layer does not exist
  // machine-readable. That is still true and now ships as the first data gap
  // ON the page - but it was an argument about the INTERACTIVE variant, and
  // the route was being withheld on it. Pune now renders the NARRATIVE variant,
  // which needs no hazard polygons: the event register (1961 Panshet with no
  // official death toll by the state's own admission, the 2019 Ambil Odha
  // cloudburst, 25 Jul and 4 Aug 2024, 21 Aug 2025) plus PMC's own nalla
  // network, 3,075 open storm-water channels carrying 1,014 km, which was in
  // the repo's reach and rendering nowhere.
  // NARROWED 2026-08-17. The DATA now ships: public/data/pune-tankers.json,
  // 57,370 delivery rows across 411 published registers, 7 filling points,
  // 1,956 distinct vehicles, 84,886 trips. What is still missing is a
  // RENDERER, and that is a deliberate hold rather than laziness.
  //
  // src/lib/cities/types.ts states the rule: "Adding a fourth kind is cheaper
  // than bending one of these: forcing a city through the wrong panel means
  // making its required fields optional and gutting its copy, which damages
  // the city the panel was written for." Pune is exactly that case. The
  // `utility-ledger` panel is HMWSSB-shaped - it renders bookings against
  // deliveries, a fulfilment rate, and divisions and sections. Pune's register
  // has none of those: every row IS a delivery so there is nothing to fulfil,
  // and its units are filling point, prabhag and vehicle. Routing Pune through
  // that panel would mean making bookings/delivered/fulfilment optional and
  // rewriting Hyderabad's copy, which damages Hyderabad.
  //
  // So this needs a FIFTH kind, `utility-delivery-register`, with its own
  // panel. Retire this entry when that lands.
  // RETIRED 2026-08-17. It read "the data ships and the renderer does not ...
  // retire this when that panel lands", and the panel landed:
  // src/components/dashboard/tanker-delivery-register-panel.tsx behind the
  // fourth tankerDataKind, `delivery-register`. Added rather than bending
  // Hyderabad's utility-ledger panel, whose bookings-against-deliveries
  // copy and fulfilment rate would have had to be deleted for a city whose
  // register contains no bookings at all. The panel refuses three things on
  // purpose: no daily series as the headline (two thirds of rows cannot be
  // dated), no prabhag ranking (the ward column is filled on 52.8% of rows,
  // so ordering it would read recording practice as need), and no
  // recipients at all.
  allocations:
    "The instrument chain exists and is unusually well documented - MWRRA Orders 19/2018 and 01/2025, the 1 March 2013 PMC-WRD agreement, the 2 July 2021 Superintending Engineer letter for the merged villages - but the ledger's primitive is entitled-vs-RECEIVED, and no measured annual draw has been published since 2017-18. For that year the utility and the regulator disagree by 4.15 TMC (PMC's affidavit 14.56 TMC against WRD's 18.71). A ledger whose received column is eight years old and contested is worse than no ledger.",
  commitments:
    "Buildable and not built. The dated commitments are citable and sharp: JICA loan ID-P243 signed 13 January 2016 for a May 2023 completion now targeted August 2026, and the equitable-supply project's own slippage from December 2024 to December 2025 to May 2026 to 'twelve to fourteen months' as of the August 2026 ESR. Each needs primary-source verification of the attribution before it enters the register.",

  // RETIRED 2026-08-17, same day it was written. It read "needs a
  // facts-pune.json; the compilation is the work", and the compilation
  // happened. public/data/facts-pune.json ships 22 facts across all four
  // tiers, built by neer-vazhvu-api/scripts/build_pune_facts.py, which READS
  // every figure out of the already-shipped artifacts rather than transcribing
  // them a second time - so a quoted card cannot drift from the dashboard it
  // came from. Two numbers a reader would expect are deliberately absent and
  // ship as gap facts instead: litres-per-capita (PMC's own accounts exclude
  // groundwater and tankers, so the denominator does not support the claim)
  // and any measured annual draw (none published since 2017-18, and the two
  // published figures for that year differ by 4.15 TMC).
  //
  // RETIRED 2026-08-17, same day it was written. The removal condition was
  // "Origins is narrative work and gets its own pass", and the pass happened
  // in the same PR rather than a later one. Kept as a comment rather than
  // deleted because a retired exemption is the record that the gap closed
  // rather than being quietly dropped. src/cities/pune/story-en.tsx ships
  // ten chapters on the sources listed in its header, with a CC0 Rijksmuseum
  // hero and a 1911 survey plate; the 1961 Panshet death toll is stated as
  // having no official figure, per the state's own current disaster plan,
  // rather than substituting the number that circulates.
  "my-ward":
    "The 41 prabhags of the 2025 delimitation ship as named geometry (public/geojson/pune-wards-2025.geojson, all 41 joined to PMC's own election results), but no ward rows exist in the database: /api/wards?city=pune and /api/localities?city=pune both 404, so the page renders a heading, a subtitle and nothing else. Turned OFF at cutover rather than shipped empty - a live page with no content is exactly issue #279, which this same onboarding filed against Gurugram's water-bodies page. Kolkata carries this exemption for the same reason. Retire it when ward + locality rows are seeded, which needs a producer that does not exist yet; the geometry is not the blocker.",
  "lake-restoration":
    "No restoration-project register exists for Pune. There is also no official register of the city's LOST or encroached water bodies, which is the layer this surface leans on elsewhere.",
  "climate-risk": "Not built for this city.",
  shoreline: "Landlocked.",
};

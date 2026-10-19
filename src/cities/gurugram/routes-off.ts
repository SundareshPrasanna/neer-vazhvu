import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Gurugram - preview-gated, city nine. The set is deliberately small: only
  // the surfaces with data behind them are on, and the two most conspicuous
  // absences are properties of the city rather than backlog.
  rivers:
    "Gurugram has no river. Its NWMP monitoring stations are all lakes and borewells, and its surface water leaves the city as drain flow into the Najafgarh jheel and then Delhi's Najafgarh drain. There is nothing to put on a rivers page that would not be an invention.",

  // RETIRED 2026-08-15. The removal condition written into this entry was
  // "closes on IN-GRES block assessment", and that is exactly what closed it:
  // four assessment years to 2024-25, district and block level, all five
  // Gurugram blocks over-exploited and GURGAON_URBAN at 326.26% of recharge.
  // Kept as a comment rather than deleted because a retired exemption is the
  // evidence that these removal conditions are real, which is how Kolkata's
  // rainfall entry was handled above.
  "flood-risk":
    "Gurugram floods by waterlogging on a paved catchment, not by river. The inputs exist on GMDA OneMap (117 GMUC waterlogging sites, the master storm-water network, natural flow direction) and only the drain legs are harvested so far, so this is a backlog item with a known path rather than a refusal.",
  shoreline: "Landlocked.",
  "my-ward":
    "TURNED OFF 2026-08-16 after a click-through found the page rendering 296 characters: a heading, a subtitle and a link, with no ward selector, no map and no data. The 36 MCG ward polygons ARE harvested, but nothing is joined to them - /api/wards and /api/localities both 404 for this city, and there is no gurugram-ward-profiles.json. A nav entry leading to an empty page is worse than an absent one. Closes when ward-level data exists to attach to the geometry; the geometry itself is already in the corpus.",
  "lake-restoration":
    "Needs a restoration-priority-gurugram.json, which needs a scorer. The water-body register is harvested and carries ownership, area and GMDA's own cross-survey flags, so the inputs are present and the ranking is simply not built.",

  // RETIRED 2026-08-15: written, on exactly the spine this entry named - the
  // MCG limit at 1985/1996/2008/2010/2015/2020, paired with the 2008 dark-zone
  // notification. Kept as a comment because a retired exemption is the evidence
  // that these removal conditions are real.
  allocations:
    "No published entitlement instrument has been located. Gurugram's canal share of Yamuna water is governed by inter-state arrangements that GMDA does not publish, and the ledger's primitive is entitled-vs-received against a named instrument - without the paper there is no row to write.",
  commitments:
    "Buildable and not built. The dated commitments exist and are citable (the NGT's February 2026 orders on illegal extraction and rainwater harvesting, GMDA's Chandu Budhera fifth-unit target), but each needs primary-source verification before it goes in the register, and none has had it yet.",
  facts:
    "Needs a facts-gurugram.json, which needs the supply and demand numbers that are the very ones still unverified - every figure in circulation for this city is press-sourced, and GMDA's own GIS already contradicts two of them. Ships when the numbers do.",
  "climate-risk":
    "Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. Genuinely buildable and simply not built, so this is backlog rather than refusal.",
};

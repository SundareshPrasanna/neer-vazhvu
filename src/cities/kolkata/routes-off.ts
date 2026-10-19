import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Kolkata - every omission is a decision, and each has a reason on the page.
  "my-ward":
    "Ward-keyed surfaces are off until KMC wards 142-144 exist as geometry. 141 of 144 are mapped; the missing three are 18.93 km2, 9.2% of the city. KMC publishes no ward geometry through either its own portal or the newer DIGIT one, and OSM has no Kolkata ward relations at any admin_level, so this closes when someone digitises the 2012 delimitation, not by a better endpoint.",
  shoreline:
    "Not a coastal city. Kolkata is a tidal river port roughly 130 km upstream of the Bay of Bengal; the riverbank/estuary variant of this surface is a different product and is unbuilt.",
  tanker:
    "KMC runs a municipal tanker service and publishes per-trip rates, but no volumes, trips or coverage - so there is nothing to chart that would not be invented.",
  "climate-risk":
    "Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. It is genuinely buildable and simply not built yet, so this is a backlog item rather than a refusal.",
};

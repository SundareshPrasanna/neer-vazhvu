import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Visakhapatnam - three omissions, each a stated decision.
  "my-ward":
    "No ward geometry that can be published. The 98-ward boundaries in circulation are an Esri India tracing of a GVMC CAD drawing. We have not found a licence anywhere in the chain, and their zone field disagrees with GVMC's own ward list for 94 of 98 wards. The 98 wards are also superseded: GVMC notified 120 wards in 2026, and we have not found a published map of them. This closes when GVMC publishes official ward boundaries.",
  tanker:
    "The only tanker figures from GVMC that we have found are for a single day (615 trips on 11 March 2021, in an NGT filing). GVMC runs a Dial-a-Tanker booking line, but we have not found a series by day, zone or ward. One day is not a tanker record.",
  "climate-risk":
    "Buildable but not built. The sub-basin risk layer comes from HydroBASINS, which covers the north Andhra coast, so this is a backlog item rather than a refusal.",
};

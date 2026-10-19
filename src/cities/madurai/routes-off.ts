import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Madurai
  shoreline: "Landlocked.",
  "climate-risk": "Not built for this city.",
  tanker: "Not built for this city.",
};

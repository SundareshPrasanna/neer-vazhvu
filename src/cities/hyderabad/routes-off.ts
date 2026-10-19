import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Hyderabad
  "my-ward":
    "The 300-ward delimitation gazetted 25 Dec 2025 has no public geometry, and with the corporations under a Special Officer there are no sitting councillors to attach to a ward either. Returns with the ward build, following the Mumbai precedent.",
  shoreline: "Landlocked.",
  "climate-risk": "Not built for this city.",
};

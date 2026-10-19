import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Nagpur - preview-gated, city thirteen. Every other route is on; these
  // three are off by decision.
  tanker:
    "NMC publishes how many tankers it runs (37 in the 2026-27 budget speech; 78 in 2024 in the Environment Status Report 2023-24) but no delivery register, booking ledger or price survey, so there is no record of who receives water by tanker or at what price. The operator's own fleet figures appear only in the press.",
  shoreline:
    "Landlocked: Nagpur is near the centre of the country and has no coastline.",
  "climate-risk":
    "Buildable but not built. The sub-basin risk surface rests on HydroBASINS, a global product that also covers the Kanhan and Wainganga basins, so this is a backlog item rather than a refusal.",
};

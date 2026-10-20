import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  allocations:
    "No public order states Jaipur's share of Bisalpur dam. A Water Resources Department study (February 2020) describes 11.1 TMC a year for Jaipur and the villages on its pipeline, 5.1 TMC for Ajmer and about 8 TMC for irrigation, but that is a description, not an allocation order, and no order has been found. An entitled-versus-received ledger cannot be drawn without it. PHED's draw by source is on the dashboard instead.",
  tanker:
    "PHED publishes summer tanker totals for the city (230 tankers making 1,283 trips a day at the June 2025 peak) but no register by area, month or price. The totals are on the dashboard.",
  shoreline: "Jaipur is landlocked; it has no coastline.",
  "climate-risk":
    "Not built for this city. The state's only climate plan (SAPCC 1.0, 2014) gives state-wide projections, and the sub-basin risk surface Chennai uses has not been run for the Banas or the Banganga.",
};

import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Surat - the analytical unit is the zone, not the ward, and several
  // omissions follow directly from that.
  "my-ward":
    "Ward surfaces are off because \"ward\" in Surat means three incompatible things and none of them has usable geometry. There are 30 electoral wards (120 corporators), about 134 census/administrative wards in SMC's own 1961-2011 area table, and a third scheme inside SMC's GIS ward_boundary layer. That GIS layer is the authoritative one and it serves WMS only - WFS is disabled, so its geometry cannot be downloaded, only rendered. The analytical unit is instead the zone, which does carry live data, an official 2024 population and the city's own supply breakdown. This closes when SMC enables WFS or publishes ward boundaries, not by a better join.",
  shoreline:
    "Surat is genuinely coastal - Dumas, Hazira, the Tapi estuary - so this is a backlog item rather than a refusal. The shoreline surface currently reads Chennai coastal data and has not been parametrised, and shipping a map of another city's coast would be worse than shipping none.",
  tanker:
    "No tanker economy established. SMC reports 95% piped coverage and the national open-data release records tanker-served properties as NA in every year. There is nothing to chart that would not be invented.",
  allocations:
    "Surat has no published drinking-water entitlement to render. The research pass found infrastructure and treatment capacities but no sanctioned allocation instrument from Ukai or the Tapi - the ledger's whole subject is entitled-versus-received, and the entitled half does not exist in public.",
  "lake-restoration":
    "SMC restores lakes and says so - its reuse programme routes 2 MLD of treated water to lake rejuvenation - but publishes no restoration register: no project list, no dates, no budgets, no per-body status. A ranking surface needs a denominator the corporation has not published.",
  "climate-risk":
    "Buildable but not built. Chennai's sub-basin risk comes from HydroBASINS level 12, a global product that covers the lower Tapi as well, so this is a backlog item rather than a refusal.",
};

import type { RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Ahmedabad - preview-gated; each omission is a finding about what is public.
  allocations:
    "No public document states how much Narmada or Mahi water Ahmedabad is entitled to. The mechanism exists - Gujarat sanctions municipal raw water each year with a 25% band either side, under a 3 Feb 2007 resolution and its 9 Sep 2008 clarification - but AMC's sanctioned quantity is not published, and an entitled-versus-received ledger cannot be drawn without the entitled half. AMC's draw by source is on the dashboard instead.",
  tanker:
    "AMC publishes no tanker delivery register, booking ledger or price survey. The tanker documents in the research drop are AMC's own vehicle purchases (20 garden tankers of about 8,000 litres, and stainless-steel drinking-water bowsers), which say nothing about who receives water by tanker or at what price.",
  shoreline:
    "Ahmedabad is about 100 km inland from the Gulf of Khambhat; it has no coastline.",
  "climate-risk":
    "Buildable but not built. The sub-basin risk surface Chennai uses rests on HydroBASINS, a global product that also covers the Sabarmati, so this is a backlog item rather than a refusal.",
};

import { UNRECORDED, type RoutesOff } from "../../content/routes-off";

/** Why this city leaves each of these routes out. Read by the exemptions
 *  register (scripts/lib/exemptions.ts); a route left out with no reason
 *  here fails its check. */
export const ROUTES_OFF: RoutesOff = {
  // Mumbai
  // Deliberately describes the artifacts rather than naming their paths: the
  // dataset catalogue scans scripts/ for artifact paths to infer which script
  // PRODUCES a file, so a literal path in this prose made the catalogue credit
  // this register as the producer of Mumbai's ward geometry. It produces nothing.
  "my-ward": `${UNRECORDED} Mumbai holds both a 2023 ward-boundary layer and ward-keyed data (a ward risk composite and the Praja per-ward water series), so this is a product decision rather than a data gap - but no rationale for it was ever recorded in the repo, and none is invented here. Resolve by writing down the real reason or by shipping the route.`,
  "climate-risk": "Not built for this city.",
  tanker: "Not built for this city.",
};

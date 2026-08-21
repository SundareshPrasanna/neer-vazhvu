/**
 * Parity verdicts, sourced from the written per-city audits.
 *
 * WHY THIS EXISTS. `FeatureNotYetAvailable` renders a "parity: EASY|MEDIUM|
 * HARD" badge, and the prop feeding it had a docstring promising "a source URL
 * or research-memo reference". In practice each of the seven caller pages
 * passed a LITERAL, so the verdict was a property of the ROUTE and identical
 * for every city:
 *
 *     rivers/page.tsx         parityVerdict="EASY"     <- for every city
 *     groundwater/page.tsx    parityVerdict="MEDIUM"   <- for every city
 *     flood-risk/page.tsx     parityVerdict="HARD"     <- for every city
 *
 * So /gurugram/rivers advertised "parity: EASY" for a city with NO RIVER,
 * where parity with Chennai is not merely hard but undefined. Nobody had made
 * that assessment - the badge asserted a research finding that did not exist.
 *
 * Now the verdict is a property of the (city, route) PAIR and every entry
 * below traces to a row in that city's `docs/cities/<id>/parity-audit.md`.
 * Callers pass their route key; they cannot pass a verdict.
 *
 * THREE RULES.
 *   1. No audit document -> no entry here -> no badge. Silence beats a
 *      borrowed verdict.
 *   2. An audit that did not assess a route -> no entry for that route -> no
 *      badge. A city can be audited and still have unexamined corners, and
 *      those must not inherit a neighbour's grade.
 *   3. Every entry cites the audit row it came from, so a reader can check it.
 *
 * `parity-audits.test.ts` pins rule 1 against the filesystem, because the
 * first version of this file confidently listed all seven earlier cities when
 * only two had ever had an audit written - the very failure this file exists
 * to stop.
 */

/** How much work reaching Chennai-level parity would take on this route.
 *  `N/A` is not a bad grade: it means the feature cannot exist in this city. */
export type ParityVerdict = "FULL" | "EASY" | "MEDIUM" | "HARD" | "GAP" | "N/A";

/** Route key -> verdict, per city. Keys match the `src/app/[cityId]/<key>`
 *  directory names; `""` would be the dashboard, which never renders a badge. */
export const PARITY_VERDICTS: Readonly<
  Record<string, Readonly<Record<string, ParityVerdict>>>
> = {
  // docs/cities/gurugram/parity-audit.md
  gurugram: {
    // Audit S7: "Gurugram has no river." Every NWMP station in the district is
    // a lake or a borewell. Not a gap to close - a property of the city.
    rivers: "N/A",
    // Audit S8: BUILDABLE. 117 waterlogging sites, the master storm-water
    // network, flow direction and 10 watersheds are all reachable on OneMap;
    // only the drain legs are harvested. Real work, no blocker.
    "flood-risk": "MEDIUM",
    // Audit S3: BUILDABLE. Ownership, area, remark and boundary membership are
    // all present in the register; only the ranking scorer is unwritten.
    "lake-restoration": "EASY",
    // Audit S1: BLOCKED. A facts page needs the supply-and-demand numbers, and
    // every demand figure in circulation is press-sourced while GMDA's own
    // development plans are scanned PDFs with no text layer.
    facts: "HARD",
    // `climate-risk` is deliberately ABSENT: the Gurugram audit does not cover
    // it, so there is no verdict to publish. Rule 2.
  },

  // docs/cities/kolkata/parity-audit.md
  kolkata: {
    // Audit line 144: BLOCKED (weak method). HydroBASINS hybas_12 transfers
    // mechanically, but Kolkata sits on a very flat delta where DEM-based
    // catchment delineation is unreliable, and its real climate exposure is
    // cyclone and storm surge - a different framing and a different source.
    "climate-risk": "HARD",
  },
};

/** Cities with a published parity audit. Derived, so it cannot drift from the
 *  verdict table above. */
export const CITIES_WITH_PARITY_AUDIT: ReadonlySet<string> = new Set(
  Object.keys(PARITY_VERDICTS),
);

/** The audited verdict for a route, or null when none was published. Null is
 *  the common case and means "render no badge", never "assume a default". */
export function parityVerdictFor(
  cityId: string,
  routeKey: string,
): ParityVerdict | null {
  return PARITY_VERDICTS[cityId]?.[routeKey] ?? null;
}

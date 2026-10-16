import type { RouteKey } from "../lib/cities/ids";

/**
 * Prefix for an omission that is real and deliberate but whose ORIGINAL
 * rationale was never written down.
 *
 * This exists so the register cannot be silenced with filler. Its check
 * (scripts/lib/exemptions.ts) fails on an EMPTY reason, and the obvious way to
 * make that failure go away is to invent a plausible-sounding justification for
 * a decision someone else made years ago - which would be worse than the empty
 * string, because it reads as authoritative. Marking it instead keeps the gap visible, counts it separately
 * in the generated register, and says what would resolve it.
 *
 * An entry marked this way is a TODO with a name on it, not a resolved item.
 */
export const UNRECORDED = "UNRECORDED:";

/** src/cities/<id>/routes-off.ts: why the city does not ship each route it
 *  leaves out of `routes`. A route left out with no reason here is reported as
 *  UNEXPLAINED by the exemptions register and fails its check. */
export type RoutesOff = Partial<Record<RouteKey, string>>;

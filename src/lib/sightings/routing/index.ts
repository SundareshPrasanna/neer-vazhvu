/**
 * Who handles a report, and how a citizen reaches them. Bodies come from the
 * place or its state (never invented); national channels are offered after
 * them. Adding a city or district = its entry in its state's file, enforced by
 * src/lib/cities/onboarding-contract.test.ts.
 */
import type { AuthorityRole } from "../taxonomy";
import { withExpectations } from "./expectations";
import { NATIONAL_CHANNELS } from "./national";
import { STATE_ROUTING } from "./states";
import type { Authority, Channel } from "./types";

export interface RoutingTarget {
  stateCode: string;
  placeId: string;
  placeKind: "city" | "district" | "basin";
  corporationId?: string | null;
}

export interface Resolved {
  authority: Authority | null;
  /** Where the body came from, for the contract test. */
  layer: "corporation" | "place" | "state" | null;
  national: Channel[];
}

export function resolveAuthority(role: AuthorityRole, where: RoutingTarget): Resolved {
  const state = STATE_ROUTING[where.stateCode];
  const place = state?.places[where.placeId];
  const corp = where.corporationId ? place?.corporations?.[where.corporationId]?.[role] : undefined;
  const [authority, layer] = corp
    ? [corp, "corporation" as const]
    : place?.roles[role]
      ? [place.roles[role]!, "place" as const]
      : state?.roles[role]
        ? [state.roles[role]!, "state" as const]
        : [null, null];
  const national = NATIONAL_CHANNELS.filter(
    (c) => c.roles.includes(role) && (!c.urbanOnly || where.placeKind === "city"),
  );
  return {
    authority: authority && { ...authority, channels: withExpectations(authority.channels) },
    layer,
    national: withExpectations(national),
  };
}

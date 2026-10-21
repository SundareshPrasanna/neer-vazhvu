/**
 * Search terms for every place on the landing board, read from the
 * registries a place is onboarded into: a new city or district is
 * searchable by its name, local-script name, state and aliases with no edit
 * here. Server-only in practice (it reads the scope registry).
 */
import type { PlaceConfig } from "../cities/types";
import type { AtlasDistrict, AtlasStateEntry } from "../atlas/registry";
import { scopeAncestors, scopeKind, scopeName } from "../scopes";
import type { PlaceTerms } from "./search";

const STATE_KINDS = new Set(["state", "union-territory"]);

/** The state a city sits in, from its scope row (absent for Delhi, which is
 *  its own union territory). */
function cityStateNames(cityId: string): string[] {
  return scopeAncestors(cityId)
    .filter((id) => STATE_KINDS.has(scopeKind(id) ?? ""))
    .map((id) => scopeName(id)!);
}

export function cityTerms(config: PlaceConfig): PlaceTerms {
  return {
    id: `city:${config.cityId}`,
    kind: "city",
    name: config.displayName,
    terms: [
      ...Object.values(config.displayNameLocalized ?? {}),
      ...(config.landing.aliases ?? []),
      // A region (the MMR) is found by each of its corporations' names.
      ...(config.corporations ?? []).flatMap((c) => [c.displayName, ...Object.values(c.displayNameLocalized ?? {})]),
      ...cityStateNames(config.cityId),
      config.primaryAuthority.acronym,
    ],
  };
}

export function districtTerms(district: AtlasDistrict): PlaceTerms {
  return {
    id: `district:${district.scopeId}`,
    kind: "district",
    name: district.name,
    terms: [...(district.aliases ?? []), district.stateName],
  };
}

export function stateTerms(state: AtlasStateEntry): PlaceTerms {
  return { id: `state:${state.stateSlug}`, kind: "state", name: state.stateName, terms: [] };
}

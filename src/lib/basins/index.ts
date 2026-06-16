import type { BasinManifest } from "./types";
import { ARKAVATHI } from "./arkavathi";

export * from "./types";

// Basin registry. A new basin is added here once its manifest exists and its
// data has been ingested under public/data/basins/<id>/.
const BASINS: Record<string, BasinManifest> = {
  arkavathi: ARKAVATHI,
};

export function tryGetBasinManifest(basinId: string): BasinManifest | null {
  return BASINS[basinId] ?? null;
}

/** Basin ids hosted by a given city, in registry order. */
export function basinsForCity(cityId: string): BasinManifest[] {
  return Object.values(BASINS).filter((b) => b.cityIds.includes(cityId));
}

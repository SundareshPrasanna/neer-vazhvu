import type { BasinManifest } from "./types";
import { ARKAVATHI } from "./arkavathi";
import { CHENNAI_RIVERS } from "./chennai-rivers";
import { CAUVERY_KA } from "./cauvery-ka";
import { CAUVERY_TN } from "./cauvery-tn";
import { KABINI } from "./kabini";

export * from "./types";

// Basin registry. A new basin is added here once its manifest exists and its
// data has been ingested under public/data/basins/<id>/.
const BASINS: Record<string, BasinManifest> = {
  arkavathi: ARKAVATHI,
  "chennai-rivers": CHENNAI_RIVERS,
  "cauvery-ka": CAUVERY_KA,
  "cauvery-tn": CAUVERY_TN,
  kabini: KABINI,
};

export function tryGetBasinManifest(basinId: string): BasinManifest | null {
  return BASINS[basinId] ?? null;
}

/** Basin ids hosted by a given city, in registry order. */
export function basinsForCity(cityId: string): BasinManifest[] {
  return Object.values(BASINS).filter((b) => b.cityIds.includes(cityId));
}

import type { BasinManifest } from "./types";
import { ARKAVATHI } from "./arkavathi";
import { CHENNAI_RIVERS } from "./chennai-rivers";
import { CAUVERY_KA } from "./cauvery-ka";
import { CAUVERY_TN } from "./cauvery-tn";
import { DINDIGUL_RIVERS } from "./dindigul-rivers";
import { ERODE_RIVERS } from "./erode-rivers";
import { KABINI } from "./kabini";
import { KARUR_RIVERS } from "./karur-rivers";
import { KRISHNAGIRI_RIVERS } from "./krishnagiri-rivers";
import { MUMBAI_RIVERS } from "./mumbai-rivers";
import { NAMAKKAL_RIVERS } from "./namakkal-rivers";
import { PALAKKAD_RIVERS } from "./palakkad-rivers";
import { RANIPET_RIVERS } from "./ranipet-rivers";
import { SALEM_RIVERS } from "./salem-rivers";
import { THANJAVUR_RIVERS } from "./thanjavur-rivers";
import { TIRUCHIRAPPALLI_RIVERS } from "./tiruchirappalli-rivers";
import { TIRUPATHUR_RIVERS } from "./tirupathur-rivers";
import { TIRUPPUR_RIVERS } from "./tiruppur-rivers";
import { VELLORE_RIVERS } from "./vellore-rivers";

export * from "./types";

// Basin registry. A new basin is added here once its manifest exists and its
// data has been ingested under public/data/basins/<id>/.
const BASINS: Record<string, BasinManifest> = {
  arkavathi: ARKAVATHI,
  "chennai-rivers": CHENNAI_RIVERS,
  "cauvery-ka": CAUVERY_KA,
  "cauvery-tn": CAUVERY_TN,
  "dindigul-rivers": DINDIGUL_RIVERS,
  "erode-rivers": ERODE_RIVERS,
  kabini: KABINI,
  "karur-rivers": KARUR_RIVERS,
  "krishnagiri-rivers": KRISHNAGIRI_RIVERS,
  "mumbai-rivers": MUMBAI_RIVERS,
  "namakkal-rivers": NAMAKKAL_RIVERS,
  "palakkad-rivers": PALAKKAD_RIVERS,
  "ranipet-rivers": RANIPET_RIVERS,
  "salem-rivers": SALEM_RIVERS,
  "thanjavur-rivers": THANJAVUR_RIVERS,
  "tiruchirappalli-rivers": TIRUCHIRAPPALLI_RIVERS,
  "tirupathur-rivers": TIRUPATHUR_RIVERS,
  "tiruppur-rivers": TIRUPPUR_RIVERS,
  "vellore-rivers": VELLORE_RIVERS,
};

export function tryGetBasinManifest(basinId: string): BasinManifest | null {
  return BASINS[basinId] ?? null;
}

export function listBasins(): BasinManifest[] {
  return Object.values(BASINS);
}

/** Basin ids hosted by a given city, in registry order. */
export function basinsForCity(cityId: string): BasinManifest[] {
  return Object.values(BASINS).filter((b) => b.cityIds.includes(cityId));
}

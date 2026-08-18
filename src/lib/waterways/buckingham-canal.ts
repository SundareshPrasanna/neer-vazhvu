import type { WaterwayManifest } from "./types";

/**
 * The Buckingham Canal pilot, Ennore to Mahabalipuram (74.5 km, chainage 0
 * at the Ennore creek crossing). Research base and data vintages:
 * docs/research/buckingham-canal/ (local); editorial layer:
 * docs/waterways/buckingham-canal/waterway-curation.json.
 *
 * `enabled: false` until the TWIC preview review passes (DECISIONS.md W9);
 * preview builds surface it via NEXT_PUBLIC_PREVIEW_WATERWAYS.
 */
export const BUCKINGHAM_CANAL: WaterwayManifest = {
  waterwayId: "buckingham-canal",
  displayName: "The Buckingham Canal",
  shortName: "Buckingham Canal",
  stateCode: "TN",
  description:
    "Ennore to Mahabalipuram, 74.5 km, measured reach by reach: widths, " +
    "satellite record, pollution, habitat, encroachment and the paper " +
    "trail, every number with its source.",
  center: [12.93, 80.255],
  zoom: 11,
  chainageNote:
    "Chainage runs north to south: km 0 at the Ennore creek crossing, " +
    "km 74.5 at Mahabalipuram.",
  enabled: false,
};

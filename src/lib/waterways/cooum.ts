import type { WaterwayManifest } from "./types";

/**
 * The Cooum, waterway 2: origin junction near Satharai to the Bay of Bengal
 * at Chennai (62.8 km, chainage 0 at the origin). Research base and data
 * vintages: docs/research/cooum/ (local); editorial layer:
 * docs/waterways/cooum/waterway-curation.json; decisions:
 * docs/waterways/cooum/DECISIONS.md (C1-C7).
 *
 * Ships preview-gated (enabled: false); surfaces on preview builds via
 * NEXT_PUBLIC_PREVIEW_WATERWAYS=cooum.
 */
export const COOUM: WaterwayManifest = {
  waterwayId: "cooum",
  displayName: "The Cooum",
  shortName: "Cooum",
  stateCode: "TN",
  description:
    "Satharai to the Marina, 62.8 km, measured reach by reach: widths, " +
    "satellite record, the live monthly pollution series, the consent " +
    "register and the restoration programme's paper trail, every number " +
    "with its source.",
  center: [13.085, 80.065],
  zoom: 11,
  chainageNote:
    "Chainage runs west to east, the water's own direction: km 0 at the " +
    "origin junction near Satharai, km 62.8 at the Bay of Bengal mouth.",
  cityIds: ["chennai"],
  enabled: false,
};

import type { WaterwayManifest } from "./types";

/**
 * The Cooum, waterway 2: origin junction near Satharai to the Bay of Bengal
 * at Chennai (62.9 km, chainage 0 at the origin). Research base and data
 * vintages: docs/research/cooum/ (local); editorial layer:
 * docs/waterways/cooum/waterway-curation.json; decisions:
 * docs/waterways/cooum/DECISIONS.md (C1-C7).
 *
 * Enabled for production 19 Aug 2026, same-day as the preview review:
 * facts-only voice (DECISIONS C8), two freshness rounds folded (C9),
 * corpus release data#23. Joins nav registry-driven: with two Chennai
 * waterways the Explore entry now lands on the /waterways index.
 */
export const COOUM: WaterwayManifest = {
  waterwayId: "cooum",
  displayName: "The Cooum",
  shortName: "Cooum",
  stateCode: "TN",
  description:
    "Satharai to the Bay of Bengal, 62.9 km, measured reach by reach: " +
    "widths, satellite record, the monthly water-quality series, the " +
    "consent register and the restoration programme's documents, every " +
    "number with its source.",
  center: [13.085, 80.065],
  zoom: 11,
  chainageNote:
    "Chainage runs west to east: km 0 at the origin junction near " +
    "Satharai, km 62.9 at the Bay of Bengal mouth.",
  cityIds: ["chennai"],
  enabled: true,
};

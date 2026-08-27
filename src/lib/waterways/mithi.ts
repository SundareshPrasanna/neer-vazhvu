import type { WaterwayManifest } from "./types";

/**
 * The Mithi, waterway 3 and the first outside Chennai: the Vihar Lake
 * outlet to the Mahim Causeway mouth, 17.84 km, chainage 0 at Vihar.
 * Research base and data vintages: docs/research/mithi/ (local);
 * editorial layer: docs/waterways/mithi/waterway-curation.json;
 * decisions: docs/waterways/mithi/DECISIONS.md.
 *
 * Two things the page states rather than hides. Below roughly km 10 the
 * river is tidal and becomes Mahim Creek: OSM tags the whole course
 * water=river, so the tidal limit is a declared boundary and widths
 * below it are an intertidal envelope, not a channel. And the on-ground
 * photography is thin - Commons holds six usable frames, five of them
 * from one day in 2008, before the post-2005 rebuild - so the methods
 * panel carries that gap the way it carries every other one.
 *
 * Preview-gated on arrival: NEXT_PUBLIC_PREVIEW_WATERWAYS=mithi.
 */
export const MITHI: WaterwayManifest = {
  waterwayId: "mithi",
  displayName: "The Mithi",
  shortName: "Mithi",
  stateCode: "MH",
  description:
    "Vihar Lake to Mahim Creek, 17.84 km, measured reach by reach: " +
    "widths above and below the tidal limit, the satellite record, the " +
    "single monitored water-quality station, the desilting ledger and " +
    "the works programme's documents, every number with its source.",
  center: [19.095, 72.875],
  zoom: 12,
  chainageNote:
    "Chainage runs north to south: km 0 at the Vihar Lake outlet, " +
    "km 17.8 at the Mahim Causeway mouth. The river is tidal below " +
    "about km 10.",
  cityIds: ["mumbai"],
  enabled: false,
};

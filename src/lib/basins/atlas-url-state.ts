// Layer-toggle state <-> URL for the Basin Atlas.
//
// The atlas historically synced only ?river= and ?level=; layer checkboxes
// lived in ephemeral React state, so a configured map could not be shared or
// linked back to from an exported PDF. These helpers give the toggle set a
// canonical, order-independent URL form:
//
//   ?layers=<comma-joined layer keys that are ON>   (absent = manifest defaults)
//   &growth=1                                       (PRS 2020-vs-2025 overlay)
//
// The layers param lists the ON set exhaustively - every manifest layer not
// named is off - so a link renders the same map regardless of which defaults
// ship later. When the current set equals the passed defaults the param is
// omitted, keeping untouched URLs clean.

import type { BasinLayer } from "./types";

/** Toggle/state key for a layer: kind-filtered entries get their own key so
 *  two entries sharing a data family toggle independently. */
export function layerKey(l: BasinLayer): string {
  return l.kindFilter ? `${l.family}:${l.kindFilter}` : l.family;
}

/** The ?layers= value for a toggle state, or null when it matches the given
 *  defaults (param omitted - the URL stays clean until the user customises). */
export function encodeLayersParam(
  enabled: Record<string, boolean>,
  defaults: Record<string, boolean>,
): string | null {
  const on = Object.keys(enabled).filter((k) => enabled[k]).sort();
  const defOn = Object.keys(defaults).filter((k) => defaults[k]).sort();
  if (on.length === defOn.length && on.every((k, i) => k === defOn[i])) return null;
  return on.join(",");
}

/** Toggle state from a ?layers= value: named keys on, every other manifest
 *  layer off. Unknown keys are ignored (stale links survive manifest edits).
 *  null/empty param -> null (caller keeps its defaults). */
export function parseLayersParam(
  param: string | null,
  layers: BasinLayer[],
): Record<string, boolean> | null {
  if (!param) return null;
  const valid = new Set(layers.map(layerKey));
  const on = new Set(param.split(",").filter((k) => valid.has(k)));
  return Object.fromEntries([...valid].map((k) => [k, on.has(k)]));
}

/** Canonical live-map URL for a configured atlas view - the chrome-less embed
 *  page, which restores river, floor, layer set and the growth overlay in
 *  every context (the city-page overlay can't carry layer state in its own
 *  URL). Used as the "view this map live" link in the exported PDF. */
export function buildAtlasShareUrl(args: {
  origin: string;
  basinId: string;
  riverId?: string | null;
  floor?: string | null;
  layersParam?: string | null;
  growth?: boolean;
}): string {
  const p = new URLSearchParams();
  if (args.riverId) p.set("river", args.riverId);
  if (args.floor) p.set("floor", args.floor);
  if (args.layersParam) p.set("layers", args.layersParam);
  if (args.growth) p.set("growth", "1");
  const qs = p.toString();
  return `${args.origin}/embed/basins/${args.basinId}${qs ? `?${qs}` : ""}`;
}

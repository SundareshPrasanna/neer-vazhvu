// Basin Atlas types (see docs/specs/basin-atlas.md).
//
// A basin is data, not code: one BasinManifest + a set of GeoJSON files under
// public/data/basins/<basinId>/ conforming to the layer-family contract,
// produced by scripts/ingest_basin.py. Onboarding a new basin is a new
// manifest, never a new component.

/** The elevator's ordered floors - a cross-section of the basin's story,
 *  top (surface) to bottom (causes + accountability). */
export type BasinFloor = "hydrology" | "monitoring" | "pressures" | "governance";

/** How a layer is drawn; the renderer picks styling/pane from this. */
export type BasinGeomRole = "line" | "fill" | "point";

/** A child sub-basin reference on an overview-mode basin (see
 *  docs/specs/cauvery-basin-hierarchy.md). Source-system ids never appear
 *  here - scoreboardKey is an opaque join into the basin's scoreboard.json. */
export interface SubBasinRef {
  /** The source's own sub-basin code (e.g. "C5") - opaque to the UI. */
  key: string;
  name: string;
  nameLocal?: string;
  /** Joins scoreboard.json subBasins map. */
  scoreboardKey: string;
  areaKm2: number;
  /** When set, this sub-basin has its own deep-dive manifest to drill into. */
  deepDiveBasinId?: string;
  /** Depth ladder: 0 profile-only .. 4 full deep dive (the Arkavati bar). */
  depthLevel: 0 | 1 | 2 | 3 | 4;
  /** Human text naming what raises the level - the ladder is public UI. */
  unlocks?: string[];
  blurb?: string;
}

export interface BasinRiver {
  /** URL-stable id, e.g. "vrishabhavathi" (used in ?river=). */
  riverId: string;
  displayName: string;
  displayNameLocal?: string;
  /** The sub-hydrosheds (by shedId) this river drains - the click target and
   *  the scope applied to every floor when this river is selected. */
  subHydroshedIds: string[];
  /** Hex line color. */
  color: string;
  /** One-paragraph narrative shown in the panel when selected. */
  narrative?: string;
  /** Structured attribute cards (Paani Phase-1 review): rendered above the
   *  narrative. Any field left undefined renders as "Details coming soon",
   *  so partial data is publishable without prose rewrites. */
  attributes?: {
    origin?: string;
    /** Display string, e.g. "176 km (mapped course)". */
    length?: string;
    tributaries?: string;
    flowsInto?: string;
    /** The CPCB polluted-stretch identification for this river, if any. */
    pollutedStretch?: string;
    restorationInitiatives?: string;
  };
}

export interface BasinLayer {
  /** Matches the ingested file name: public/data/basins/<id>/<family>.geojson. */
  family: string;
  label: string;
  floor: BasinFloor;
  geom: BasinGeomRole;
  /** Hex color for the layer (rivers override per-river). */
  color: string;
  /** On by default within its floor. The checkbox is the single source of
   *  truth for visibility - nothing else (zoom, etc.) hides a checked layer. */
  defaultOn: boolean;
  /** Large layer: sliced per sub-hydroshed and loaded on demand (per shed when
   *  a river is selected, else the full file). Default off so it only loads
   *  when explicitly checked. */
  heavy?: boolean;
  /** Part of the persistent base skeleton - rendered (dimmed) even when its
   *  floor isn't focused, so the map keeps its bearings. */
  context?: boolean;
  /** Features carry a `kind` with sub-types worth toggling (pressures). */
  hasKinds?: boolean;
  /** Gap layer: a choropleth of treatment-gap severity per admin unit, whose
   *  click opens the cross-source gap panel (see gaps.json) instead of the
   *  generic feature panel. Features carry `gapUnit` + `severity`. */
  gap?: boolean;
  /** PRS layer: the CPCB/NGT polluted-river-stretch lines (one per survey year),
   *  whose click opens the PRS entry-point panel (see prs.json) instead of the
   *  generic feature panel. Features carry `year` + `priority` + `length_km`. */
  prs?: boolean;
}

export interface BasinManifest {
  basinId: string;
  /** Host cities, for nav + capability gating. Empty for basins reached only
   *  through the hierarchy (e.g. a parent overview like cauvery-ka). */
  cityIds: string[];
  /** Hierarchy: the basin this one sits inside (arkavathi -> cauvery-ka).
   *  Chains freely - a future interstate roll-up parents the state segments. */
  parentBasinId?: string;
  /** "sub-basins": render the overview mode (sub-basin cards + scoreboard)
   *  instead of the floor-based deep dive. */
  overviewMode?: "sub-basins";
  /** Children shown in overview mode, in display order. */
  subBasins?: SubBasinRef[];
  /** Sibling basins worth cross-linking (e.g. the other state's share of the
   *  same river). Rendered as navigation links in overview mode. */
  relatedBasins?: { basinId: string; label: string }[];
  displayName: string;
  displayNameLocal?: string;
  /** Landing blurb (plain text). */
  blurb: string;
  mapCenter: [number, number];
  mapZoom: number;
  /** Stated basin area; surfaced with its source, units noted in copy. */
  areaKm2?: number;
  areaNote?: string;
  rivers: BasinRiver[];
  layers: BasinLayer[];
  /**
   * Gap unit to auto-select when the atlas is opened straight to the
   * governance floor (the "Treatment & waste gaps" button), so the right-hand
   * detail panel is populated and discoverable rather than blank. Must match a
   * gapUnit key in gaps.json (e.g. "cooum", "ramanagara").
   */
  defaultGapUnit?: string;
  /**
   * Default map view when nothing is selected. By default the atlas frames the
   * whole basin boundary, which is right for compact basins (Chennai) but too
   * zoomed-out for large ones whose rivers span the full extent (the Arkavathi
   * runs ~120 km from Nandi Hills to Kanakapura). Set this to pin the opening
   * view on the part that matters (e.g. the Bengaluru / Vrishabhavathi cluster)
   * while the rest stays a pan away. Selecting a river still fits to it.
   */
  defaultFocus?: { center: [number, number]; zoom: number };
  /** Attribution lines rendered verbatim in "Data on this map". */
  credits: string[];
}

// ── inventory.json (emitted by the ingest pipeline) ──────────────────────────

export interface BasinInventorySource {
  file: string;
  kind: string | null;
  count: number;
  provenance: string;
}

export interface BasinInventoryFamily {
  featureCount: number;
  bytes: number;
  sliced?: boolean;
  shedKeys?: string[];
  sources: BasinInventorySource[];
}

export interface BasinInventorySkip {
  file: string;
  family: string;
  kind: string | null;
  reason: string;
}

export interface BasinInventory {
  basinId: string;
  generatedFrom: string;
  families: Record<string, BasinInventoryFamily>;
  skipped: BasinInventorySkip[];
}

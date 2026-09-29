import registry from "./rich-bodies.json";

/**
 * Registry of "rich-data" water bodies that get the deep-zoom panel
 * experience (boundary + 1km buffer + yearly imagery slider + change
 * tints + stats) instead of the standard detail panel.
 *
 * To add a body:
 *   1. Run scripts/fetch-tnswa-ramsar-polygon.ts (or fetch-rich-body-polygon.ts)
 *      to produce the polygon + buffer geojson
 *   2. Run scripts/ingest_rich_body_imagery.py for yearly chips
 *   3. Run the water-loss + built-gain tint scripts
 *   4. Run the verify_* scripts for stats
 *   5. Add the entry to rich-bodies.json (paths derive from the id)
 */
export interface RichBodyEntry {
  /** Slug used in file paths and URLs */
  id: string;
  /** OSM relation id used to detect this body from city-map clicks */
  osm_id: number;
  /** Display name (English) */
  name: string;
  /** Display name in Tamil if available */
  name_ta?: string;
  /** Display name in the city's own script where OSM carries one
   *  (Telugu for Hyderabad, Marathi for Mumbai, and so on). The overlay
   *  renders this as the subtitle under the English name; `name_ta` was
   *  serving that role back when every rich body was Tamil-speaking. */
  name_local?: string;
  /** City this body belongs to */
  city_id: string;
  /** Provenance of the primary polygon - shown in the sources modal so
   *  users see whether the boundary is gazetted legal vs OSM mapper
   *  interpretation vs satellite-derived. */
  boundary_source: string;
  /** Short credit for the panel's footer strip. Defaults to
   *  "OpenStreetMap", which is where every body's primary polygon comes
   *  from except Pallikaranai's gazetted one. The footer used to hardcode
   *  "TNSWA" - Pallikaranai's provenance printed over thirty bodies that
   *  have nothing to do with the Tamil Nadu State Wetland Authority. */
  boundary_source_label?: string;
  /** Gazetted Ramsar (or equivalent legal) boundary - the legal anchor */
  polygon_path: string;
  /** OSM-mapped ecological boundary (smaller than gazette for marshes with cutouts) */
  osm_ecological_path?: string;
  /** Legal buffer polygon (e.g. NGT 1km no-build zone) */
  buffer_path?: string;
  buffer_metres?: number;
  buffer_legal_basis?: string;
  buffer_source_url?: string;
  /** Per-year RGB chip manifest */
  imagery_manifest_path: string;
  /** Pre-computed analysis JSONs */
  analysis_paths: {
    /** TNSWA-vs-OSM set-algebra analysis. Only emitted for bodies that have
     *  BOTH a gazetted (TNSWA) and an OSM-ecological polygon, i.e. only
     *  Pallikaranai today. Optional. */
    boundary?: string;
    open_buildings: string;
    /** Newer building source (Overture Maps quarterly release).
     *  Optional - bodies onboarded before T19a may not have this yet. */
    overture_buildings?: string;
    /** JRC Global Surface Water v1.4 yearly classification (1984-2021).
     *  Series stops at JRC's upstream cutoff. */
    water_trend: string;
    /** Dynamic World water-class extension that bridges JRC's gap
     *  (2022-present). Renderer splices the two into one continuous
     *  chart. Optional - bodies onboarded before this extension may
     *  not have it yet; when absent the chart just shows JRC alone. */
    dw_water_trend?: string;
    built_trend: string;
  };
  /** Hand-curated event stamps for the timeline */
  timeline_events: TimelineEvent[];
  /** Status badges shown in the overlay header. Each body declares its
   *  own truth - we no longer assume "rich body == Ramsar". */
  status_badges?: Array<{
    label: string;
    /** Tailwind-tinted background colour */
    tone: "emerald" | "amber" | "sky" | "slate";
  }>;
  /** Whether the buffer has a legal basis (NGT order, gazetted protection).
   *  When false, the buffer is an editorial choice for cross-body visual
   *  consistency and the UI labels it as such. */
  buffer_legally_mandated?: boolean;
  /** Body-specific copy for the Sources & methodology modal. Sections not
   *  populated here render from generic defaults; body-agnostic sections
   *  (Satellite imagery era table, NICFI compliance, encroachment data
   *  sources) live in the modal component itself. */
  data_sources?: {
    /** Sources for the Boundary & legal status section of the modal */
    boundary?: ModalSourceRow[];
    /** Body-specific caveat bullets appended to the generic caveats */
    caveats?: string[];
  };
}

export interface ModalSourceRow {
  label: string;
  source: string;
  note: string;
  link?: string;
  licence?: string;
}

export interface TimelineEvent {
  year: number;
  label: string;
  label_short?: string;
  source_url?: string;
}

/** A body as stored in rich-bodies.json: every path and the 1 km radius derive from the id. */
type StoredBody = Omit<
  RichBodyEntry,
  | "id"
  | "polygon_path"
  | "osm_ecological_path"
  | "buffer_path"
  | "buffer_metres"
  | "imagery_manifest_path"
  | "analysis_paths"
  | "data_sources"
> & {
  osm_ecological?: boolean;
  boundary_analysis?: boolean;
  data_sources?: { boundary?: Array<ModalSourceRow | { editorial_buffer: string }>; caveats?: string[] };
};

const { shared, bodies } = registry as unknown as {
  /** Repeated values, referenced from a body by key */
  shared: {
    buffer_legal_basis: Record<string, string>;
    buffer_source_url: Record<string, string>;
    editorial_buffer_row: Omit<ModalSourceRow, "note">;
  };
  bodies: Record<string, StoredBody>;
};

function toEntry(
  id: string,
  { osm_ecological, boundary_analysis, data_sources, ...b }: StoredBody,
): RichBodyEntry {
  const e: RichBodyEntry = {
    id,
    ...b,
    polygon_path: `/geojson/rich-bodies/${id}.geojson`,
    buffer_path: `/geojson/rich-bodies/${id}-buffer-1000m.geojson`,
    buffer_metres: 1000,
    imagery_manifest_path: `/data/rich-bodies/${id}-imagery-manifest.json`,
    analysis_paths: {
      ...(boundary_analysis && { boundary: `/data/rich-bodies/${id}-boundary-analysis.json` }),
      open_buildings: `/data/rich-bodies/${id}-open-buildings-verification.json`,
      overture_buildings: `/data/rich-bodies/${id}-overture-buildings.json`,
      water_trend: `/data/rich-bodies/${id}-jrc-water-trend.json`,
      dw_water_trend: `/data/rich-bodies/${id}-dw-water-trend.json`,
      built_trend: `/data/rich-bodies/${id}-dynamic-world-built-trend.json`,
    },
  };
  if (osm_ecological) e.osm_ecological_path = `/geojson/rich-bodies/${id}-osm-ecological.geojson`;
  if (b.buffer_legal_basis) e.buffer_legal_basis = shared.buffer_legal_basis[b.buffer_legal_basis] ?? b.buffer_legal_basis;
  if (b.buffer_source_url) e.buffer_source_url = shared.buffer_source_url[b.buffer_source_url] ?? b.buffer_source_url;
  if (data_sources) {
    const { label, source, licence } = shared.editorial_buffer_row;
    e.data_sources = {
      ...data_sources,
      boundary: data_sources.boundary?.map((r) =>
        "editorial_buffer" in r ? { label, source, note: r.editorial_buffer, licence } : r,
      ),
    };
  }
  return e;
}

export const RICH_BODIES: Record<string, RichBodyEntry> = Object.fromEntries(
  Object.entries(bodies).map(([id, b]) => [id, toEntry(id, b)]),
);

const BY_OSM_ID = new Map(
  Object.values(RICH_BODIES).map((b) => [b.osm_id, b.id])
);

export function getRichBodyIdByOsmId(osmId: number | null | undefined): string | null {
  if (osmId == null) return null;
  return BY_OSM_ID.get(osmId) ?? null;
}

export function getRichBody(id: string): RichBodyEntry | null {
  return RICH_BODIES[id] ?? null;
}

/** Rich bodies belonging to one city.
 *
 *  The map used to fetch EVERY registry polygon on every city's page,
 *  which was invisible at 7 bodies and is a real cost at 30: a Mumbai
 *  visitor paid for Bangalore's thirteen lakes before their own map drew.
 *  Callers pass their cityId and fetch only what they can render. */
export function getRichBodiesForCity(cityId: string): RichBodyEntry[] {
  return Object.values(RICH_BODIES).filter((b) => b.city_id === cityId);
}

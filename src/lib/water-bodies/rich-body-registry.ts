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
 *   5. Add the entry here
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
  /** City this body belongs to */
  city_id: string;
  /** Provenance of the primary polygon - shown in the sources modal so
   *  users see whether the boundary is gazetted legal vs OSM mapper
   *  interpretation vs satellite-derived. */
  boundary_source: string;
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
    water_trend: string;
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

export const RICH_BODIES: Record<string, RichBodyEntry> = {
  pallikaranai: {
    id: "pallikaranai",
    osm_id: 15046539,
    name: "Pallikaranai Marsh",
    name_ta: "பள்ளிக்கரணை சதுப்புநிலப்பகுதி",
    city_id: "chennai",
    boundary_source: "Tamil Nadu State Wetland Authority (TNSWA) - gazetted Ramsar Site #2481 boundary",
    polygon_path: "/geojson/rich-bodies/pallikaranai.geojson",
    osm_ecological_path: "/geojson/rich-bodies/pallikaranai-osm-ecological.geojson",
    buffer_path: "/geojson/rich-bodies/pallikaranai-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis: "NGT order, Sept 2025: construction freeze within 1 km pending scientific zone-of-influence mapping",
    buffer_source_url: "https://www.dtnext.in/news/tamilnadu/ngt-suspends-all-construction-around-pallikaranai-marsh-as-part-of-urban-conservation-848168",
    imagery_manifest_path: "/data/rich-bodies/pallikaranai-imagery-manifest.json",
    analysis_paths: {
      boundary: "/data/rich-bodies/pallikaranai-boundary-analysis.json",
      open_buildings: "/data/rich-bodies/pallikaranai-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/pallikaranai-overture-buildings.json",
      water_trend: "/data/rich-bodies/pallikaranai-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/pallikaranai-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2007,
        label: "Declared Reserve Forest by Tamil Nadu Forest Department",
        label_short: "Reserve Forest declared",
      },
      {
        year: 2018,
        label: "Notified as Pallikaranai Marsh Bird Sanctuary",
        label_short: "Bird Sanctuary",
      },
      {
        year: 2022,
        label: "Designated as Ramsar Site #2481 (1,247.54 ha)",
        label_short: "Ramsar designation",
        source_url: "https://rsis.ramsar.org/ris/2481",
      },
      {
        year: 2025,
        label: "NGT orders 1 km construction freeze around the marsh",
        label_short: "NGT 1km buffer order",
        source_url: "https://www.dtnext.in/news/tamilnadu/ngt-suspends-all-construction-around-pallikaranai-marsh-as-part-of-urban-conservation-848168",
      },
    ],
    status_badges: [
      { label: "Ramsar Site #2481", tone: "emerald" },
      { label: "Reserve Forest", tone: "emerald" },
      { label: "NGT 1 km buffer", tone: "amber" },
    ],
    buffer_legally_mandated: true,
    data_sources: {
      boundary: [
        {
          label: "Gazetted Ramsar boundary",
          source: "Tamil Nadu State Wetland Authority (TNSWA) QGIS web map",
          note: "Authoritative legal boundary. Matches the official Ramsar Site 2481 area (1,247.54 ha) within 0.4%.",
          link: "https://tnswa.tn.gov.in/qgis_web/index.html",
          licence: "Public data from a Tamil Nadu government portal",
        },
        {
          label: "Ecological boundary (secondary)",
          source: "OpenStreetMap relation 15046539",
          note: "OSM mapper's interpretation of current marsh extent. Smaller than the gazette (~1,073 ha) because OSM mappers excluded built-up enclaves inside the legal Ramsar perimeter.",
          link: "https://www.openstreetmap.org/relation/15046539",
          licence: "ODbL",
        },
        {
          label: "1 km no-build buffer",
          source: "Computed via @turf/buffer as a Minkowski offset from the gazetted polygon",
          note: "Anchored to NGT order, Sept 2025 - construction freeze within 1 km pending scientific zone-of-influence mapping. Buffer follows the polygon edge (not a circle from a centroid).",
          link: "https://www.dtnext.in/news/tamilnadu/ngt-suspends-all-construction-around-pallikaranai-marsh-as-part-of-urban-conservation-848168",
          licence: "Derived",
        },
      ],
      caveats: [
        "The OSM ecological polygon is one observer's interpretation - the 'gap' between gazette and OSM is indicative of conversion-already-happened, not definitive proof.",
      ],
    },
  },
  sholavaram: {
    id: "sholavaram",
    osm_id: 25394523,
    name: "Sholavaram Lake",
    name_ta: "சோளவரம் ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 25394523). " +
      "Note: no public gazetted boundary - CMWSSB manages this reservoir as " +
      "drinking-water infrastructure but does not publish a GIS layer. India-WRIS " +
      "and Bhuvan WBIS host satellite-derived alternatives; integration is a " +
      "V0.1 follow-up. OSM polygon represents the visible water surface at the " +
      "time mappers drew it (mostly 2018-2022 edits).",
    polygon_path: "/geojson/rich-bodies/sholavaram.geojson",
    buffer_path: "/geojson/rich-bodies/sholavaram-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, no specific legal NGT order for Sholavaram). " +
      "Shown to visualise the urbanisation pressure on the reservoir's surroundings.",
    imagery_manifest_path: "/data/rich-bodies/sholavaram-imagery-manifest.json",
    analysis_paths: {
      boundary: "/data/rich-bodies/sholavaram-boundary-analysis.json",
      open_buildings:
        "/data/rich-bodies/sholavaram-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/sholavaram-overture-buildings.json",
      water_trend: "/data/rich-bodies/sholavaram-jrc-water-trend.json",
      built_trend:
        "/data/rich-bodies/sholavaram-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1944,
        label: "Sholavaram reservoir constructed as part of Chennai's water supply system",
        label_short: "Constructed",
      },
      {
        year: 2003,
        label: "Reservoir went dry during the historic Chennai drought; symbolic of city's water crisis",
        label_short: "2003 drought - dried up",
      },
      {
        year: 2019,
        label: "Chennai 'Day Zero' water crisis - all four city reservoirs (Sholavaram included) went near-empty",
        label_short: "2019 'Day Zero' crisis",
      },
      {
        year: 2023,
        label: "Cyclone Michaung floods - reservoir reached full pool",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "CMWSSB drinking water reservoir", tone: "sky" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap way 25394523",
          note: "OSM mappers traced the reservoir's visible water surface from satellite imagery, mostly in 2018-2022. CMWSSB manages Sholavaram as core drinking water infrastructure but does not publish a GIS layer. Bhuvan WBIS (satellite-derived) and India-WRIS (ArcGIS REST) host alternatives we plan to integrate in V0.1.",
          link: "https://www.openstreetmap.org/way/25394523",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated for Sholavaram. We use the same 1 km radius across all rich-data bodies for cross-body visual consistency. Only Pallikaranai's 1 km buffer has a legal anchor (NGT Sept 2025 order). For other bodies (including Sholavaram), the buffer is an editorial choice to visualise urbanisation pressure on the surroundings.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Reservoir water trend reading: any-water fraction rose from 51.7% (1988-92 avg) to 94.6% (2017-21 avg). The honest read is 'the reservoir is more reliably full in the modern era' (better water management + OSM polygon at full-pool extent + sparse 1980s-90s Landsat coverage over Chennai), not 'the reservoir grew 43 percentage points.'",
      ],
    },
  },
  "red-hills": {
    id: "red-hills",
    osm_id: 25394157,
    name: "Red Hills Reservoir (Puzhal)",
    name_ta: "புழல் ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 25394157). " +
      "Red Hills / Puzhal is the largest of Chennai's four drinking-water " +
      "reservoirs and is managed by CMWSSB, which does not publish a GIS " +
      "layer. OSM polygon represents the visible water surface at the time " +
      "mappers drew it. India-WRIS / Bhuvan WBIS satellite-derived " +
      "alternatives are a V0.1 follow-up.",
    polygon_path: "/geojson/rich-bodies/red-hills.geojson",
    buffer_path: "/geojson/rich-bodies/red-hills-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). " +
      "No specific NGT order for Red Hills. Shown to visualise the urban " +
      "pressure of north Chennai's IT corridor + Outer Ring Road on the reservoir's surroundings.",
    imagery_manifest_path: "/data/rich-bodies/red-hills-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/red-hills-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/red-hills-overture-buildings.json",
      water_trend: "/data/rich-bodies/red-hills-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/red-hills-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1876,
        label: "Red Hills (Puzhal) lake formalised as a drinking-water reservoir under the Madras Presidency",
        label_short: "Constructed as reservoir",
      },
      {
        year: 2015,
        label: "December 2015 Chennai floods - reservoir overflowed contributing to downstream inundation",
        label_short: "2015 Chennai floods",
      },
      {
        year: 2019,
        label: "Chennai 'Day Zero' water crisis - all four city reservoirs (Red Hills included) went near-empty",
        label_short: "2019 'Day Zero' crisis",
      },
      {
        year: 2023,
        label: "Cyclone Michaung floods - reservoir reached full pool",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "CMWSSB drinking water reservoir", tone: "sky" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap way 25394157",
          note: "OSM mappers traced the reservoir's visible water surface from satellite imagery. CMWSSB does not publish a GIS layer; Bhuvan WBIS / India-WRIS alternatives planned for V0.1.",
          link: "https://www.openstreetmap.org/way/25394157",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. Same 1 km radius used across all rich-data bodies for cross-body visual consistency.",
          licence: "Derived",
        },
      ],
    },
  },
  chembarambakkam: {
    id: "chembarambakkam",
    osm_id: 25453624,
    name: "Chembarambakkam Lake",
    name_ta: "செம்பரம்பாக்கம் ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 25453624). " +
      "Chembarambakkam is one of Chennai's four CMWSSB drinking-water " +
      "reservoirs (with Poondi, Red Hills, Cholavaram). OSM polygon " +
      "represents the visible water surface.",
    polygon_path: "/geojson/rich-bodies/chembarambakkam.geojson",
    buffer_path: "/geojson/rich-bodies/chembarambakkam-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). " +
      "No specific NGT order for Chembarambakkam. Shown to visualise the " +
      "western Chennai urban-edge pressure on the reservoir.",
    imagery_manifest_path: "/data/rich-bodies/chembarambakkam-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/chembarambakkam-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/chembarambakkam-overture-buildings.json",
      water_trend: "/data/rich-bodies/chembarambakkam-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/chembarambakkam-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1944,
        label: "Chembarambakkam dam modernised; reservoir formalised as part of Chennai's water supply system",
        label_short: "Modern dam built",
      },
      {
        year: 2015,
        label: "Chembarambakkam gate-release decision on December 1-3 2015 widely cited as a contributing factor to the catastrophic Chennai floods downstream along the Adyar river",
        label_short: "2015 floods (gate release)",
        source_url: "https://www.thehindu.com/news/cities/chennai/chembarambakkam-the-villain-of-2015-floods/article33288316.ece",
      },
      {
        year: 2019,
        label: "Chennai 'Day Zero' water crisis - all four city reservoirs (Chembarambakkam included) went near-empty",
        label_short: "2019 'Day Zero' crisis",
      },
      {
        year: 2023,
        label: "Cyclone Michaung floods - reservoir reached full pool",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "CMWSSB drinking water reservoir", tone: "sky" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap way 25453624",
          note: "OSM mappers traced the reservoir's visible water surface. CMWSSB does not publish a GIS layer.",
          link: "https://www.openstreetmap.org/way/25453624",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. Same 1 km radius used across all rich-data bodies for cross-body visual consistency.",
          licence: "Derived",
        },
      ],
    },
  },
  porur: {
    id: "porur",
    osm_id: 23633592,
    name: "Porur Lake",
    name_ta: "போரூர் ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 23633592). " +
      "Small urban lake in western Chennai, originally a temple-tank " +
      "system attributed to 18th-century Tirumalanaicker. Heavily " +
      "encroached, with periodic restoration drives.",
    polygon_path: "/geojson/rich-bodies/porur.geojson",
    buffer_path: "/geojson/rich-bodies/porur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). " +
      "No specific NGT order for Porur. Shown to visualise the dense urban " +
      "context that has encroached on this small (~29 ha) urban lake.",
    imagery_manifest_path: "/data/rich-bodies/porur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/porur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/porur-overture-buildings.json",
      water_trend: "/data/rich-bodies/porur-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/porur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2018,
        label: "Madras High Court / NGT order restoration of Porur Lake amid encroachment concerns; multiple eviction drives followed",
        label_short: "Restoration order",
      },
      {
        year: 2023,
        label: "Cyclone Michaung floods - lake reached full pool, drainage strain in surrounding neighbourhoods",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "Urban lake", tone: "slate" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 23633592",
          note: "OSM mappers traced the visible water surface. No public gazetted boundary published by GCC / TN PWD; the 2024 Madras HC-ordered TN-wide water-body website did not surface a polygon for Porur as of this writing.",
          link: "https://www.openstreetmap.org/way/23633592",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Porur is small (~29 ha). JRC water classification at 30 m has only ~320 pixels of body - per-year area readings will be noisier than for the large CMWSSB reservoirs.",
      ],
    },
  },
  velachery: {
    id: "velachery",
    osm_id: 25504265,
    name: "Velachery Lake",
    name_ta: "வேளச்சேரி ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 25504265). " +
      "Small urban lake in south Chennai, severely encroached by " +
      "Velachery's dense urbanisation and the IT corridor build-out.",
    polygon_path: "/geojson/rich-bodies/velachery.geojson",
    buffer_path: "/geojson/rich-bodies/velachery-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). " +
      "No specific NGT order for Velachery Lake. Buffer chosen for cross-body " +
      "visual consistency; the surroundings are among the most-built halos " +
      "we measure across the rich-data cohort.",
    imagery_manifest_path: "/data/rich-bodies/velachery-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/velachery-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/velachery-overture-buildings.json",
      water_trend: "/data/rich-bodies/velachery-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/velachery-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2015,
        label: "Velachery was among the worst-affected areas in the December 2015 Chennai floods - the lake's reduced extent (encroachment-driven) is widely cited as a contributing factor",
        label_short: "2015 Chennai floods",
      },
      {
        year: 2017,
        label: "Smart Cities Mission / GCC announce restoration plan for Velachery Lake",
        label_short: "Smart City restoration plan",
      },
      {
        year: 2023,
        label: "Cyclone Michaung - flood pressure on the urban lake's reduced footprint",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "Urban lake", tone: "slate" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 25504265",
          note: "OSM mappers traced the visible water surface. The historical lake extent was significantly larger - large portions are now built over (residential + the Velachery MRTS station + Phoenix MarketCity vicinity). No public gazetted boundary.",
          link: "https://www.openstreetmap.org/way/25504265",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Velachery Lake at ~20 ha (current OSM extent) is much smaller than its historical extent. The 'built-up surface in halo' reading is among the highest in our cohort (~45%) which is consistent with the surrounding Velachery / Tambaram dense urbanisation; the body itself shows encroachment pressure on the small remaining footprint.",
        "JRC 30 m water classification on a 20 ha body has only ~220 pixels - per-year readings are very noisy. Treat the trend as directional only.",
      ],
    },
  },
  perumbakkam: {
    id: "perumbakkam",
    osm_id: 30424450,
    name: "Perumbakkam Lake",
    name_ta: "பெரும்பாக்கம் ஏரி",
    city_id: "chennai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 30424450). " +
      "Peri-urban lake in south Chennai near the OMR / IT corridor.",
    polygon_path: "/geojson/rich-bodies/perumbakkam.geojson",
    buffer_path: "/geojson/rich-bodies/perumbakkam-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). " +
      "No specific NGT order for Perumbakkam. Shown to visualise the OMR / " +
      "IT-corridor build-out pressure on the lake's surroundings.",
    imagery_manifest_path: "/data/rich-bodies/perumbakkam-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/perumbakkam-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/perumbakkam-overture-buildings.json",
      water_trend: "/data/rich-bodies/perumbakkam-jrc-water-trend.json",
      built_trend: "/data/rich-bodies/perumbakkam-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2015,
        label: "December 2015 Chennai floods - peri-urban lakes including Perumbakkam overflowed contributing to downstream flooding",
        label_short: "2015 Chennai floods",
      },
      {
        year: 2023,
        label: "Cyclone Michaung floods - lake reached full pool",
        label_short: "Cyclone Michaung",
      },
    ],
    status_badges: [
      { label: "Peri-urban lake", tone: "slate" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 30424450",
          note: "OSM mappers traced the visible water surface. No public gazetted boundary.",
          link: "https://www.openstreetmap.org/way/30424450",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated.",
          licence: "Derived",
        },
      ],
    },
  },
};

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

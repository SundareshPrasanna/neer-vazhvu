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

export const RICH_BODIES: Record<string, RichBodyEntry> = {
  pallikaranai: {
    id: "pallikaranai",
    osm_id: 15046539,
    name: "Pallikaranai Marsh",
    name_ta: "பள்ளிக்கரணை சதுப்புநிலப்பகுதி",
    city_id: "chennai",
    boundary_source: "Tamil Nadu State Wetland Authority (TNSWA) - gazetted Ramsar Site #2481 boundary",
    boundary_source_label: "TNSWA gazette",
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
      dw_water_trend: "/data/rich-bodies/pallikaranai-dw-water-trend.json",
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
        "The OSM ecological polygon is one observer's interpretation - the ~233 ha gap is land inside the TNSWA boundary but not mapped as OSM wetland. The evidence cannot distinguish physical conversion from OSM under-mapping.",
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
      dw_water_trend: "/data/rich-bodies/sholavaram-dw-water-trend.json",
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
      dw_water_trend: "/data/rich-bodies/red-hills-dw-water-trend.json",
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
      dw_water_trend: "/data/rich-bodies/chembarambakkam-dw-water-trend.json",
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
      dw_water_trend: "/data/rich-bodies/porur-dw-water-trend.json",
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
      dw_water_trend: "/data/rich-bodies/velachery-dw-water-trend.json",
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
  bellandur: {
    id: "bellandur",
    osm_id: 19751547,
    name: "Bellandur Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 19751547). " +
      "Bellandur is the terminal lake of the Koramangala-Challaghatta " +
      "(K&C) valley cascade and the largest lake under BBMP at ~317 ha " +
      "(OSM extent). The Bangalore Development Authority and Karnataka " +
      "State Pollution Control Board are the relevant agencies but " +
      "neither publishes a gazetted GIS boundary; the OSM polygon traces " +
      "the visible water surface from satellite imagery.",
    polygon_path: "/geojson/rich-bodies/bellandur.geojson",
    buffer_path: "/geojson/rich-bodies/bellandur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The legal anchor " +
      "for Bellandur is the NGT's 75 m no-construction zone around the " +
      "lake edge plus 50 m around rajakaluves (storm-water drains) and " +
      "30 m around secondary drains, ordered in Forward Foundation v " +
      "State of Karnataka (NGT OA 222/2014). The 1 km halo here is the " +
      "same editorial radius used across the rich-data cohort to make " +
      "build-up density visible at a glance.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/bellandur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/bellandur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/bellandur-overture-buildings.json",
      water_trend: "/data/rich-bodies/bellandur-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/bellandur-dw-water-trend.json",
      built_trend: "/data/rich-bodies/bellandur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2015,
        label:
          "Bellandur foam crisis breaks into national coverage; toxic " +
          "surfactant foam spills onto Sarjapur Road from the lake's " +
          "downstream weir.",
        label_short: "Foam crisis enters public view",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014): 75 m buffer " +
          "around the lake, 50 m around rajakaluves, 30 m around " +
          "secondary drains; Mantri Tech Park (Espana) and Coremind " +
          "constructions halted as encroaching the buffer.",
        label_short: "NGT 75 m buffer + construction halt",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2017,
        label:
          "16 February 2017: Bellandur foam catches fire on Sarjapur " +
          "Road; international news. NGT constitutes a Bellandur-Varthur " +
          "monitoring committee chaired by retired Justice Santosh Hegde.",
        label_short: "Bellandur burns; NGT committee formed",
        source_url: "https://www.downtoearth.org.in/environment/bellandur-lake-a-story-of-toxic-froth-and-fire-57139",
      },
      {
        year: 2018,
        label:
          "January 2018: second major foam fire on Bellandur draws PMO " +
          "attention; KSPCB issues notices to BWSSB and BDA over " +
          "untreated sewage inflow.",
        label_short: "Second foam fire",
      },
      {
        year: 2020,
        label:
          "BDA's Bellandur restoration tender invites bids for desilting, " +
          "weir reconstruction, and sewage interception; rolling work " +
          "begins through the early 2020s.",
        label_short: "BDA restoration tender",
      },
      {
        year: 2024,
        label:
          "Post-monsoon foam recurs at the downstream weir; NGT and " +
          "Karnataka HC continue to monitor compliance with the 2016 " +
          "Forward Foundation order.",
        label_short: "Foam recurs; NGT compliance hearings",
      },
    ],
    status_badges: [
      { label: "K&C valley terminal lake", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
      { label: "Foam + fire events recurring", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 19751547",
          note: "OSM mappers traced the visible water surface from satellite imagery; ~317 ha. The Bangalore Development Authority owns the lake but does not publish a gazetted GIS layer. KSPCB and BWSSB hold operational data (sewage inflow, treatment) but do not publish a boundary either. The IISc Centre for Sustainable Technologies (T.V. Ramachandra) maintains independently-mapped extents used in academic work; integration is a follow-up.",
          link: "https://www.openstreetmap.org/relation/19751547",
          licence: "ODbL",
        },
        {
          label: "NGT 75 m legal buffer (not rendered)",
          source: "NGT Forward Foundation v State of Karnataka (OA 222/2014)",
          note: "The 75 m construction-free zone around the lake (plus 50 m around rajakaluves, 30 m around secondary drains) is the legal anchor; it is not rendered as a separate layer on this map because its scale is illegible at the zoom needed to read the 1 km halo's urban context.",
          link: "https://greentribunal.gov.in/",
          licence: "Public order",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. Same 1 km radius used across all rich-data bodies for cross-body visual consistency; chosen to expose Wipro Sarjapur, Embassy Tech Village, Bellandur SEZ, RGA Tech Park, and the IT-corridor density that ring the lake.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Bellandur's surface water is largely industrial-organic effluent and untreated municipal sewage from the K&C valley; the JRC 'water' classification therefore captures inflow as well as standing water, and the 'water surface' percentage should not be read as a health metric.",
        "The OSM polygon is the lake bed extent. The 'water surface in body' reading can drop below the polygon area when the lake is at low level or post-desilting; this is a measurement artefact, not encroachment.",
      ],
    },
  },
  varthur: {
    id: "varthur",
    osm_id: 19306126,
    name: "Varthur Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 19306126). " +
      "Varthur is the next lake downstream from Bellandur on the " +
      "Koramangala-Challaghatta (K&C) valley cascade and receives " +
      "Bellandur's outflow plus direct inflows from the Whitefield / " +
      "Marathahalli catchment. ~155 ha (OSM extent). Owned by the " +
      "Bangalore Development Authority; no gazetted GIS layer is " +
      "published. From Varthur the cascade discharges east towards the " +
      "Dakshina Pinakini basin.",
    polygon_path: "/geojson/rich-bodies/varthur.geojson",
    buffer_path: "/geojson/rich-bodies/varthur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). Same NGT Forward " +
      "Foundation legal regime as Bellandur (OA 222/2014 et al.): " +
      "75 m no-construction zone around the lake, 50 m around " +
      "rajakaluves, 30 m around secondary drains. The 1 km halo is the " +
      "cohort-standard editorial radius, not the legal buffer.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/varthur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/varthur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/varthur-overture-buildings.json",
      water_trend: "/data/rich-bodies/varthur-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/varthur-dw-water-trend.json",
      built_trend: "/data/rich-bodies/varthur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2015,
        label:
          "Bellandur foam crisis spills downstream into Varthur; " +
          "Whitefield residents flag froth coming over the Sarjapur-" +
          "Whitefield weir as a recurring annual event.",
        label_short: "Foam crisis arrives from Bellandur",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) covers Varthur " +
          "jointly with Bellandur: 75 m buffer around the lake, 50 m " +
          "around rajakaluves, 30 m around secondary drains.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2017,
        label:
          "Varthur Lake catches fire; surfactant foam ignites at the " +
          "downstream weir. NGT Bellandur-Varthur monitoring committee " +
          "(under retired Justice Santosh Hegde) is constituted.",
        label_short: "Varthur fire; NGT committee",
      },
      {
        year: 2018,
        label:
          "Continued foam and froth events through the year; KSPCB " +
          "and BWSSB face NGT compliance pressure on sewage interception " +
          "upstream of Varthur.",
        label_short: "Foam events recur",
      },
      {
        year: 2020,
        label:
          "BDA's Varthur restoration tender invites bids for desilting " +
          "and weir reconstruction alongside the Bellandur work.",
        label_short: "BDA restoration tender",
      },
      {
        year: 2024,
        label:
          "Foam events recur post-monsoon; Whitefield Rising and " +
          "citizen groups continue compliance monitoring with NGT.",
        label_short: "Foam recurs; citizen monitoring",
      },
    ],
    status_badges: [
      { label: "K&C valley downstream of Bellandur", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
      { label: "Foam + fire events recurring", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 19306126",
          note: "OSM mappers traced the visible water surface; ~155 ha. The Bangalore Development Authority owns the lake but does not publish a gazetted GIS layer; KSPCB and BWSSB hold operational data but do not publish a boundary. IISc Centre for Sustainable Technologies (T.V. Ramachandra) has academic boundaries that we plan to integrate as a secondary source.",
          link: "https://www.openstreetmap.org/relation/19306126",
          licence: "ODbL",
        },
        {
          label: "NGT 75 m legal buffer (not rendered)",
          source: "NGT Forward Foundation v State of Karnataka (OA 222/2014)",
          note: "Same legal regime as Bellandur. 75 m construction-free zone around the lake plus 50 m around rajakaluves and 30 m around secondary drains. Not rendered as a separate layer because the scale is illegible at the zoom needed to read the 1 km halo.",
          link: "https://greentribunal.gov.in/",
          licence: "Public order",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. Same 1 km radius as the rest of the rich-data cohort. Chosen to expose Whitefield, Brookefield, Marathahalli, and the Prestige / Brigade / Embassy tech-park density that crowds Varthur from the west.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Varthur is a sewage-receiving body downstream of Bellandur. JRC 'any water' classification therefore captures sewage inflow as well as standing water; the 'water surface' percentage is not a health metric.",
        "Because Varthur sits immediately downstream of Bellandur on the same cascade, foam and fire events at the two lakes are often described interchangeably in press coverage. They are distinct events at distinct weirs.",
      ],
    },
  },
  madivala: {
    id: "madivala",
    osm_id: 2310417,
    name: "Madivala Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 2310417). " +
      "Madivala is south Bengaluru's largest surviving kere at ~83 ha " +
      "(OSM extent) and the second-largest BBMP lake after Bellandur. " +
      "Owned and maintained jointly by BBMP and the Karnataka Forest " +
      "Department (the Madivala Tank Bed is a notified protected area " +
      "with bird sanctuary status). Neither agency publishes a gazetted " +
      "GIS layer; the OSM polygon traces the visible water surface.",
    polygon_path: "/geojson/rich-bodies/madivala.geojson",
    buffer_path: "/geojson/rich-bodies/madivala-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The general NGT " +
      "Forward Foundation regime (OA 222/2014) covers all Bengaluru " +
      "kere with a 75 m no-construction zone around the lake plus 50 m " +
      "around rajakaluves and 30 m around secondary drains; the 1 km " +
      "halo is the cohort-standard editorial radius, not the legal " +
      "buffer.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/madivala-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/madivala-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/madivala-overture-buildings.json",
      water_trend: "/data/rich-bodies/madivala-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/madivala-dw-water-trend.json",
      built_trend: "/data/rich-bodies/madivala-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2010,
        label:
          "Karnataka Forest Department designates the Madivala Tank Bed " +
          "as a protected zone with bird-sanctuary status; pelicans, " +
          "spot-billed ducks, and migratory waterfowl recorded.",
        label_short: "Bird sanctuary status",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) extends the " +
          "75 m / 50 m / 30 m buffer regime to all BBMP lakes including " +
          "Madivala; Hosur Road widening flagged for buffer compliance.",
        label_short: "NGT 75 m buffer extends to Madivala",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2018,
        label:
          "BBMP-led desilting and bund-restoration round; boating " +
          "facility reopened under Karnataka Tourism after a period " +
          "of closure.",
        label_short: "Desilting + boating reopens",
      },
      {
        year: 2023,
        label:
          "Citizen group MapleSeed and Forest Department report renewed " +
          "sewage inflow from the Bommanahalli storm-drain network; " +
          "BBMP commits to interception works.",
        label_short: "Sewage inflow flagged",
      },
    ],
    status_badges: [
      { label: "Madivala Tank Bed bird sanctuary", tone: "emerald" },
      { label: "BBMP + Karnataka Forest Dept", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 2310417",
          note: "OSM mappers traced the visible water surface; ~83 ha. The Karnataka Forest Department gazettes the Tank Bed area but does not publish a GIS layer; BBMP holds operational data but not a public polygon.",
          link: "https://www.openstreetmap.org/relation/2310417",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard 1 km radius. Chosen to expose BTM Layout, HSR Layout, Bommanahalli, Silk Board and the Hosur Road / NICE Ring Road infrastructure that crowd Madivala from three sides.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Madivala is less polluted than Bellandur or Varthur but is on a downstream branch of the same K&C valley sewer-shed; biennial KSPCB grab samples have flagged fecal coliform exceedances.",
      ],
    },
  },
  ulsoor: {
    id: "ulsoor",
    osm_id: 1857615,
    name: "Ulsoor Lake (Halasuru)",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 1857615). " +
      "Ulsoor (Halasuru in Kannada) is the heritage Cantonment-era " +
      "lake of east Bengaluru at ~38 ha (OSM extent). Attributed in " +
      "local history to Kempegowda II (~1550s), formalised under the " +
      "1809-1811 British Cantonment when the garrison was laid out " +
      "around it. Owned by BBMP today; the Indian Army's Madras " +
      "Engineer Group bounds its eastern edge.",
    polygon_path: "/geojson/rich-bodies/ulsoor.geojson",
    buffer_path: "/geojson/rich-bodies/ulsoor-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). General NGT " +
      "Forward Foundation regime (OA 222/2014) applies (75 m / 50 m " +
      "/ 30 m buffers); 1 km halo is the cohort-standard editorial " +
      "radius for visualising the dense Cantonment-and-MG-Road urban " +
      "context.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/ulsoor-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/ulsoor-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/ulsoor-overture-buildings.json",
      water_trend: "/data/rich-bodies/ulsoor-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/ulsoor-dw-water-trend.json",
      built_trend: "/data/rich-bodies/ulsoor-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1811,
        label:
          "British Cantonment laid out around the existing Kempegowda-era " +
          "Halasuru tank; the lake becomes the visual anchor for the " +
          "garrison's parade and residential layout.",
        label_short: "Cantonment laid out around lake",
      },
      {
        year: 2008,
        label:
          "Algal bloom and mass fish-kill events highlight the impact of " +
          "Cantonment Drain sewage inflow; BBMP commits to interception.",
        label_short: "Algal bloom + fish kill",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) applies the " +
          "75 m / 50 m / 30 m buffer regime to all BBMP lakes " +
          "including Ulsoor.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2019,
        label:
          "Desilting and aerator installation round under BBMP and " +
          "Karnataka Tourism; surface algae visibly reduced for the " +
          "following 18 months.",
        label_short: "Desilting + aerators installed",
      },
      {
        year: 2023,
        label:
          "Algal recurrence flagged by citizen groups; BBMP " +
          "commissions a fresh water-quality audit and reaffirms " +
          "interception commitments.",
        label_short: "Algal recurrence; quality audit",
      },
    ],
    status_badges: [
      { label: "Cantonment-era heritage lake", tone: "emerald" },
      { label: "BBMP managed", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 1857615",
          note: "OSM mappers traced the visible water surface; ~38 ha. The lake's pre-Cantonment 19th-century extent was larger; subsequent road, rail and Army-cantonment encroachments cut into the original perimeter and storm drains. No gazetted GIS layer is published by BBMP.",
          link: "https://www.openstreetmap.org/relation/1857615",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. The 1 km ring covers the Cantonment grid, MG Road, Indiranagar's western edge, and the Madras Engineer Group cantonment to the east.",
          licence: "Derived",
        },
      ],
      caveats: [
        "The Indian Army cantonment occupies a large share of the 1 km halo to the east; built-fraction readings in the halo therefore mix dense military layout with civilian urban density.",
      ],
    },
  },
  hebbal: {
    id: "hebbal",
    osm_id: 8754543,
    name: "Hebbal Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 8754543). " +
      "Hebbal is the terminal lake of the Hebbal-Nagavara cascade in " +
      "north Bengaluru at ~46 ha (OSM extent). Local history " +
      "attributes the tank to a Kempegowda-era expansion; the " +
      "post-JNNURM (2007 onwards) restoration is the better-documented " +
      "modern chapter. BBMP-managed; carries Karnataka Forest " +
      "Department bird-sanctuary designation.",
    polygon_path: "/geojson/rich-bodies/hebbal.geojson",
    buffer_path: "/geojson/rich-bodies/hebbal-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). General NGT " +
      "Forward Foundation regime (OA 222/2014) applies (75 m / 50 m " +
      "/ 30 m buffers); 1 km halo is the cohort-standard editorial " +
      "radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/hebbal-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/hebbal-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/hebbal-overture-buildings.json",
      water_trend: "/data/rich-bodies/hebbal-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/hebbal-dw-water-trend.json",
      built_trend: "/data/rich-bodies/hebbal-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2007,
        label:
          "JNNURM-funded Hebbal restoration begins; weed clearing, bund " +
          "reconstruction and a constructed wetland for inflow treatment.",
        label_short: "JNNURM restoration",
      },
      {
        year: 2010,
        label:
          "Karnataka Forest Department bird-sanctuary designation; " +
          "Painted Stork, Greater Spotted Eagle and several waterfowl " +
          "recorded as regular visitors.",
        label_short: "Bird sanctuary designation",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) buffer regime " +
          "extends to Hebbal; Manyata Tech Park and Bellary Road " +
          "widening flagged for buffer compliance.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2020,
        label:
          "BWSSB sewerage interception works upstream of Hebbal Valley " +
          "advance under the JICA Phase-3 programme; treated effluent " +
          "discharge to the cascade tightens.",
        label_short: "JICA Phase-3 interception upstream",
      },
      {
        year: 2024,
        label:
          "Post-monsoon water-quality dip flagged by citizen and " +
          "Forest Department monitoring; aerator and floating-wetland " +
          "additions planned.",
        label_short: "Post-monsoon quality dip",
      },
    ],
    status_badges: [
      { label: "Hebbal-Nagavara cascade terminus", tone: "sky" },
      { label: "Bird sanctuary status", tone: "emerald" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 8754543",
          note: "OSM mappers traced the visible water surface; ~46 ha. BBMP and Karnataka Forest Department co-manage; neither publishes a gazetted GIS layer.",
          link: "https://www.openstreetmap.org/relation/8754543",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Manyata Tech Park, the Hebbal flyover triangle, Bellary Road's airport corridor and the surrounding Kempapura / Nagavara urban edge.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Hebbal's bund and weirs were reshaped under the 2007 JNNURM restoration; the OSM polygon reflects the post-restoration extent. Pre-restoration footprint comparisons (e.g. 1990 satellite imagery) should be read with that bund-engineering context in mind.",
      ],
    },
  },
  sankey: {
    id: "sankey",
    osm_id: 6030715,
    name: "Sankey Tank",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 6030715). " +
      "Sankey is a colonial-era drinking-water tank in west Bengaluru " +
      "at ~12.5 ha (OSM extent), constructed in 1882 by Colonel " +
      "Richard Hieram Sankey of the Madras Sappers & Miners (after " +
      "whom it is named) to serve the British Cantonment + residents " +
      "of Malleswaram. Today an amenity / heritage water body managed " +
      "by BBMP.",
    polygon_path: "/geojson/rich-bodies/sankey.geojson",
    buffer_path: "/geojson/rich-bodies/sankey-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime (OA 222/2014) applies (75 m / 50 m / 30 m " +
      "buffers); 1 km halo is the cohort-standard editorial radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/sankey-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/sankey-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/sankey-overture-buildings.json",
      water_trend: "/data/rich-bodies/sankey-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/sankey-dw-water-trend.json",
      built_trend: "/data/rich-bodies/sankey-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1882,
        label:
          "Constructed by Col. Richard Hieram Sankey, Madras Sappers " +
          "& Miners, as a drinking-water tank for the British " +
          "Cantonment and Malleswaram residents.",
        label_short: "Constructed (Col. Sankey)",
      },
      {
        year: 2014,
        label:
          "Friends of Lakes Karnataka HC PIL against BBMP plans to " +
          "route a sewage trunk through Sankey's bund; court stays " +
          "the routing, BBMP reroutes around the body.",
        label_short: "Sewage-trunk PIL win",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) extends the " +
          "75 m buffer regime to all BBMP lakes including Sankey.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2019,
        label:
          "BBMP walking-track and amenity refresh; bird census " +
          "documents pelicans, herons and migratory ducks despite " +
          "the small surface area.",
        label_short: "Amenity refresh + bird census",
      },
    ],
    status_badges: [
      { label: "Colonial-era heritage (1882)", tone: "emerald" },
      { label: "BBMP managed", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 6030715",
          note: "OSM mappers traced the visible water surface; ~12.5 ha. No BBMP gazetted GIS layer.",
          link: "https://www.openstreetmap.org/relation/6030715",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Vyalikaval, Sadashivnagar, Malleswaram, Palace Grounds.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Sankey is small (~12.5 ha). JRC 30 m water classification has only ~140 pixels of body - per-year area readings are noisier than for the larger lakes in this cohort.",
      ],
    },
  },
  yelahanka: {
    id: "yelahanka",
    osm_id: 10179602,
    name: "Yelahanka Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 10179602; " +
      "1 outer ring + 3 inner-ring islands). Yelahanka is the " +
      "largest surviving north-Bengaluru kere at ~96 ha (OSM " +
      "extent). Yelahanka itself is Kempegowda's ancestral home - " +
      "Kempegowda I and his lineage (Yelahanka Nadaprabhus) " +
      "originated here. BBMP + Karnataka Forest Department " +
      "co-manage; bird-sanctuary attention.",
    polygon_path: "/geojson/rich-bodies/yelahanka.geojson",
    buffer_path: "/geojson/rich-bodies/yelahanka-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). General NGT " +
      "Forward Foundation regime applies (75 m / 50 m / 30 m); the " +
      "1 km halo is the cohort-standard editorial radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/yelahanka-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/yelahanka-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/yelahanka-overture-buildings.json",
      water_trend: "/data/rich-bodies/yelahanka-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/yelahanka-dw-water-trend.json",
      built_trend: "/data/rich-bodies/yelahanka-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) extends the " +
          "75 m / 50 m / 30 m buffer regime to all BBMP lakes " +
          "including Yelahanka.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2020,
        label:
          "Yelahanka block's CGWB GEC stage-of-development crosses " +
          "into Over-Exploited territory at 140% draft-vs-recharge; " +
          "Yelahanka named as its own assessment unit (carved out " +
          "from Bangalore (North)).",
        label_short: "Yelahanka block GEC 140%",
      },
      {
        year: 2022,
        label:
          "Bird sanctuary documentation: Sarus Crane, Greater " +
          "Flamingo, Painted Stork sightings; Forest Department " +
          "and citizen groups petition for stronger protection.",
        label_short: "Bird sanctuary docs",
      },
      {
        year: 2024,
        label:
          "CGWB GEC 2024 records Yelahanka block at 260% (draft / " +
          "recharge) - the most over-extracted unit in the Bangalore " +
          "Urban district. The lake itself is a critical recharge " +
          "asset for the surrounding aquifer.",
        label_short: "260% over-extracted block headliner",
      },
    ],
    status_badges: [
      { label: "Largest north-Bengaluru kere", tone: "sky" },
      { label: "Bird sanctuary attention", tone: "emerald" },
      { label: "Over-exploited block (260% in 2024)", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 10179602",
          note: "OSM mappers traced the visible water surface; ~96 ha across 1 outer ring + 3 inner-ring islands. No BBMP gazetted GIS layer; Karnataka Forest Department has internal mapping but does not publish it.",
          link: "https://www.openstreetmap.org/relation/10179602",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Yelahanka New Town, Jakkur, the air-force station perimeter, and the Yelahanka Satellite Town development pressure.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Yelahanka the lake is hydrologically a recharge asset for the over-exploited Yelahanka aquifer block (CGWB GEC 260% in 2024 per the round-11 extract). The lake's surface health is therefore inseparable from the block's groundwater story; the panel surfaces the block context explicitly.",
      ],
    },
  },
  kempambudhi: {
    id: "kempambudhi",
    osm_id: 38047206,
    name: "Kempambudhi Kere",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 38047206). " +
      "Kempambudhi is the family-deity tank of Kempegowda I, " +
      "founder of Bengaluru (~1550s). At ~7 ha (OSM extent) it is " +
      "a small fraction of its historical footprint; 19th-century " +
      "surveys and Harini Nagendra's Nature in the City (OUP 2016) " +
      "place its original extent at several multiples of the " +
      "present surface. Operationally a sewage-receiving body " +
      "today; heritage value remains.",
    polygon_path: "/geojson/rich-bodies/kempambudhi.geojson",
    buffer_path: "/geojson/rich-bodies/kempambudhi-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). General NGT " +
      "Forward Foundation regime applies (75 m / 50 m / 30 m); " +
      "1 km halo is the cohort-standard editorial radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/kempambudhi-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/kempambudhi-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/kempambudhi-overture-buildings.json",
      water_trend: "/data/rich-bodies/kempambudhi-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/kempambudhi-dw-water-trend.json",
      built_trend: "/data/rich-bodies/kempambudhi-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1550,
        label:
          "Kempambudhi excavated by Kempegowda I as his family-deity " +
          "tank, as Bengaluru is being founded. Among the earliest " +
          "Kempegowda-era kere along with Dharmambudhi.",
        label_short: "Excavated by Kempegowda I",
      },
      {
        year: 2010,
        label:
          "INTACH Bengaluru documents Kempambudhi's degradation: " +
          "sewage inflow from the surrounding old-Bengaluru lanes, " +
          "shrinking footprint, lost storm-drain connections.",
        label_short: "INTACH degradation report",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) extends the " +
          "75 m buffer regime to all BBMP lakes including " +
          "Kempambudhi.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2019,
        label:
          "BBMP heritage-restoration round; bund stones reset, " +
          "INTACH guides interpretive signage explaining " +
          "Kempegowda lineage.",
        label_short: "Heritage restoration round",
      },
    ],
    status_badges: [
      { label: "Kempegowda family tank (~1550)", tone: "emerald" },
      { label: "BBMP managed", tone: "sky" },
      { label: "Severely reduced (Nagendra OUP 2016)", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 38047206",
          note: "OSM mappers traced the present visible water surface; ~7 ha. The historical extent (per 19th-century survey records and Nagendra 2016) was several multiples of this; the gap is conversion-already-happened over four centuries, not a measurement artefact.",
          link: "https://www.openstreetmap.org/way/38047206",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Chamarajpet, Gavipuram, Basavanagudi, Kempegowda's pete (old city core).",
          licence: "Derived",
        },
      ],
      caveats: [
        "Kempambudhi at ~7 ha is the smallest body in the Bangalore rich-data cohort. JRC 30 m water pixels number ~80; per-year area readings are very noisy, treat as directional only.",
        "Modern Kempambudhi is operationally a sewage-receiving body; JRC 'water' classification captures that inflow, not lake-health.",
      ],
    },
  },
  hesaraghatta: {
    id: "hesaraghatta",
    osm_id: 41662659,
    name: "Hesaraghatta Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 41662659). " +
      "Hesaraghatta is the historical BWSSB drinking-water " +
      "reservoir built in 1894 by the Madras Engineering Group on " +
      "the Arkavathy river; supplied Bengaluru's first piped water " +
      "and predates Tippegondanahalli (1932) and the Cauvery " +
      "stages (1974 onwards). At ~600 ha (OSM extent at full pool) " +
      "it is the largest body in this cohort. Today operationally " +
      "near-dry: upstream urbanisation and a collapsing Arkavathy " +
      "catchment have ended its role as a drinking source.",
    polygon_path: "/geojson/rich-bodies/hesaraghatta.geojson",
    buffer_path: "/geojson/rich-bodies/hesaraghatta-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). General NGT " +
      "Forward Foundation regime applies; 1 km halo is the " +
      "cohort-standard editorial radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/hesaraghatta-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/hesaraghatta-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/hesaraghatta-overture-buildings.json",
      water_trend: "/data/rich-bodies/hesaraghatta-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/hesaraghatta-dw-water-trend.json",
      built_trend: "/data/rich-bodies/hesaraghatta-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1894,
        label:
          "Constructed by the Madras Engineering Group on the " +
          "Arkavathy river to supply Bengaluru's first piped water " +
          "system; remains the city's sole drinking source until " +
          "Tippegondanahalli (1932) and the Cauvery stages " +
          "(1974+).",
        label_short: "Constructed (Bengaluru's first piped water)",
      },
      {
        year: 1932,
        label:
          "Tippegondanahalli reservoir downstream commissioned; " +
          "Hesaraghatta's share of city supply begins to fall as " +
          "the Cauvery push begins.",
        label_short: "TG Halli commissioning shifts supply",
      },
      {
        year: 2010,
        label:
          "Hesaraghatta documented as near-dry for the first time " +
          "after a sequence of weak monsoons and collapsed " +
          "Arkavathy catchment recharge. BWSSB formally relegates " +
          "it to a back-up source.",
        label_short: "Near-dry; back-up status",
      },
      {
        year: 2021,
        label:
          "Karnataka government proposal to develop a tourism / " +
          "film-city zone on the Hesaraghatta grasslands; civil " +
          "society and conservationists push back citing the " +
          "lesser-florican grassland habitat and the Arkavathy " +
          "recharge function.",
        label_short: "Tourism / film-city pushback",
      },
      {
        year: 2024,
        label:
          "Karnataka HC and citizen petitions on grassland " +
          "conservation continue; CGWB Hesaraghatta Piezometer " +
          "monitors the surrounding aquifer.",
        label_short: "HC conservation hearings ongoing",
      },
    ],
    status_badges: [
      { label: "BWSSB historical reservoir (1894)", tone: "emerald" },
      { label: "Near-dry / back-up status", tone: "amber" },
      { label: "Hesaraghatta grassland conservation", tone: "emerald" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary (full-pool extent)",
          source: "OpenStreetMap way 41662659",
          note: "OSM mappers traced the historical full-pool extent (~600 ha). The lake has been near-dry for most of the past 15 years; satellite imagery for any modern year will show a much smaller wet surface inside this polygon.",
          link: "https://www.openstreetmap.org/way/41662659",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Hesaraghatta grasslands, the CGWB Piezometer station, the Doddabettahalli village belt.",
          licence: "Derived",
        },
      ],
      caveats: [
        "The OSM polygon is full-pool extent. The 'water surface in body' reading will look very low for any modern year - this is the lake's actual operational state (near-dry), not an encroachment or measurement artefact.",
        "The Hesaraghatta CGWB Piezometer is logged in the round-7 CGWB station file (`bangalore-cgwb-stations.json`). Click-through cross-reference would be a nice follow-up wiring task.",
      ],
    },
  },
  agara: {
    id: "agara",
    osm_id: 8469370,
    name: "Agara Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 8469370). " +
      "Agara is an upstream node on the Koramangala-Challaghatta " +
      "(K&C) valley cascade in south-east Bengaluru at ~27 ha (OSM " +
      "extent). The lake sits on the HSR Layout / Bellandur edge and " +
      "ultimately drains, via short surplus channels, toward Bellandur " +
      "downstream. BBMP-managed; Friends of Agara Lake (FOAL) is the " +
      "anchor citizen group.",
    polygon_path: "/geojson/rich-bodies/agara.geojson",
    buffer_path: "/geojson/rich-bodies/agara-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime (OA 222/2014) applies (75 m / 50 m / 30 m); " +
      "1 km halo is the cohort-standard editorial radius.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/agara-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/agara-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/agara-overture-buildings.json",
      water_trend: "/data/rich-bodies/agara-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/agara-dw-water-trend.json",
      built_trend: "/data/rich-bodies/agara-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2010,
        label:
          "BDA-led survey documents severe encroachment + sewage " +
          "inflow; Friends of Agara Lake (FOAL) constitutes itself " +
          "to push restoration.",
        label_short: "Encroachment documented; FOAL forms",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) extends the " +
          "75 m buffer regime to all BBMP lakes including Agara.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2018,
        label:
          "BDA + FOAL restoration round: desilting, bund repair, " +
          "fencing of perimeter. Bird sightings (cormorants, " +
          "spot-billed pelicans, painted storks) begin recovering.",
        label_short: "BDA + FOAL restoration",
      },
      {
        year: 2023,
        label:
          "Sewage inflow from HSR Layout drains continues to test " +
          "Agara's water quality; BBMP commits to upstream " +
          "interception.",
        label_short: "Sewage pressure continues",
      },
    ],
    status_badges: [
      { label: "K&C cascade upstream of Bellandur", tone: "sky" },
      { label: "FOAL citizen restoration", tone: "emerald" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 8469370",
          note: "OSM mappers traced the visible water surface; ~27 ha. There is a second OSM polygon (way 124797587, ~20 ha) tagged 'Agara Lake' that maps a partial / older footprint - we use the larger relation as the canonical extent.",
          link: "https://www.openstreetmap.org/relation/8469370",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers HSR Layout, Agara village, the Bellandur-feeding storm-drain corridor.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Agara is on the K&C cascade upstream of Bellandur; its surface 'water' classification includes urban runoff and partially-treated sewage that funnels through HSR's drains toward Bellandur. Not a health metric.",
      ],
    },
  },
  puttenahalli: {
    id: "puttenahalli",
    osm_id: 15989750,
    name: "Puttenahalli Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 15989750). " +
      "Puttenahalli is a small JP Nagar lake at ~8.5 ha (OSM extent) " +
      "whose restoration is widely cited as the model for citizen-led " +
      "lake rejuvenation in Bengaluru. The Puttenahalli Neighbourhood " +
      "Lake Improvement Trust (PNLIT) signed one of Karnataka's first " +
      "citizen-BBMP lake-maintenance MoUs in 2010.",
    polygon_path: "/geojson/rich-bodies/puttenahalli.geojson",
    buffer_path: "/geojson/rich-bodies/puttenahalli-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime applies; 1 km halo is cohort-standard.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/puttenahalli-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/puttenahalli-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/puttenahalli-overture-buildings.json",
      water_trend: "/data/rich-bodies/puttenahalli-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/puttenahalli-dw-water-trend.json",
      built_trend: "/data/rich-bodies/puttenahalli-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2010,
        label:
          "PNLIT signs an MoU with BBMP for lake maintenance and " +
          "restoration - one of the earliest citizen-government " +
          "lake partnerships in Karnataka.",
        label_short: "PNLIT-BBMP MoU (model citizen restoration)",
      },
      {
        year: 2012,
        label:
          "Constructed wetland inlet treatment and silt traps " +
          "installed; sewage inflow from JP Nagar drains intercepted " +
          "and partially treated before entering the lake.",
        label_short: "Inlet wetland + silt traps",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order applies; PNLIT's existing " +
          "maintenance regime already covers most compliance " +
          "obligations.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2020,
        label:
          "Bird census records >100 species over the rolling decade; " +
          "Puttenahalli cited in academic literature on participatory " +
          "urban-lake governance.",
        label_short: "100+ bird species milestone",
      },
    ],
    status_badges: [
      { label: "PNLIT model restoration", tone: "emerald" },
      { label: "BBMP-citizen MoU (2010)", tone: "emerald" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 15989750",
          note: "OSM mappers traced the visible water surface; ~8.5 ha.",
          link: "https://www.openstreetmap.org/relation/15989750",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers JP Nagar 7th Phase, Brigade Millennium, Banashankari edges.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Puttenahalli is small (~8.5 ha = ~95 JRC pixels). Per-year area readings carry meaningful pixel-noise; treat trends as directional rather than precise.",
      ],
    },
  },
  jakkur: {
    id: "jakkur",
    osm_id: 9321012,
    name: "Jakkur Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 9321012). " +
      "Jakkur is a ~50 ha (OSM extent) lake in north Bengaluru " +
      "(Yelahanka-adjacent) restored under JNNURM with a 50 MLD " +
      "polishing wetland that treats BWSSB STP discharge before it " +
      "enters the lake. Widely cited as Bengaluru's model of an " +
      "engineered-wetland urban lake.",
    polygon_path: "/geojson/rich-bodies/jakkur.geojson",
    buffer_path: "/geojson/rich-bodies/jakkur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime applies; 1 km halo is cohort-standard.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/jakkur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/jakkur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/jakkur-overture-buildings.json",
      water_trend: "/data/rich-bodies/jakkur-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/jakkur-dw-water-trend.json",
      built_trend: "/data/rich-bodies/jakkur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2008,
        label:
          "JNNURM-funded Jakkur restoration begins; BWSSB " +
          "constructs a 10-MLD STP upstream + a polishing-wetland " +
          "treatment train designed by ATREE / IISc CES " +
          "(T.V. Ramachandra).",
        label_short: "JNNURM restoration + STP + wetland",
      },
      {
        year: 2011,
        label:
          "Polishing-wetland commissioned; treated effluent enters " +
          "the lake; aquifer recharge measurably improves in the " +
          "surrounding Jakkur-Yelahanka borewell network.",
        label_short: "Polishing wetland online",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) applies. " +
          "Jakkur becomes a reference example in NGT proceedings for " +
          "how a constructed-wetland approach can comply.",
        label_short: "NGT cites Jakkur as a model",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2020,
        label:
          "BWSSB JICA Phase-3 upstream sewerage strengthening " +
          "improves STP feedstock quality; lake water clarity " +
          "improves further.",
        label_short: "JICA Phase-3 upstream STP gains",
      },
      {
        year: 2024,
        label:
          "Adani Realty / Embassy / Prestige tower-block expansion " +
          "in Jakkur's 1 km halo tests the STP-then-polish capacity; " +
          "BWSSB studies expansion options.",
        label_short: "Halo growth tests STP capacity",
      },
    ],
    status_badges: [
      { label: "Model engineered-wetland lake", tone: "emerald" },
      { label: "ATREE/IISc CES design (2011)", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 9321012",
          note: "OSM mappers traced the visible water surface; ~50 ha. BWSSB and BBMP co-manage with ATREE/IISc CES providing the wetland-design IP; no gazetted GIS layer is published.",
          link: "https://www.openstreetmap.org/relation/9321012",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Jakkur village, the Yelahanka air-force-station perimeter, and the surrounding north-Bengaluru tech park belt.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Jakkur's 'water surface' reading reflects deliberately-managed inflow (treated effluent + storm flow) - the lake is operationally a polishing pond plus amenity body, not a passively-recharged kere. Read trends in that engineered-system context.",
      ],
    },
  },
  rachenahalli: {
    id: "rachenahalli",
    osm_id: 6041559,
    name: "Rachenahalli Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 6041559). " +
      "Rachenahalli is a ~36 ha (OSM extent) lake in north Bengaluru " +
      "(Thanisandra, immediately adjacent to Manyata Tech Park) on " +
      "the Hebbal-Nagavara cascade. BBMP-managed; the Manyata side " +
      "of the halo is among the densest IT-corridor build-outs in " +
      "the cohort.",
    polygon_path: "/geojson/rich-bodies/rachenahalli.geojson",
    buffer_path: "/geojson/rich-bodies/rachenahalli-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime applies; 1 km halo is cohort-standard.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/rachenahalli-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/rachenahalli-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/rachenahalli-overture-buildings.json",
      water_trend: "/data/rich-bodies/rachenahalli-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/rachenahalli-dw-water-trend.json",
      built_trend: "/data/rich-bodies/rachenahalli-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2012,
        label:
          "BDA-led desilting + bund-reconstruction round; Manyata " +
          "Tech Park's adjacency raises Rachenahalli's profile in " +
          "BBMP planning.",
        label_short: "BDA desilting + bund repair",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) applies; " +
          "Manyata-adjacent buffer compliance flagged as a watch item.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2019,
        label:
          "Citizen group Save Rachenahalli Lake documents sewage " +
          "inflow from Thanisandra drains; BBMP commits to upstream " +
          "interception.",
        label_short: "Sewage inflow flagged",
      },
      {
        year: 2024,
        label:
          "Manyata's continued expansion and the Outer Ring Road " +
          "traffic pressure keep the lake under monitoring; BWSSB " +
          "JICA Phase-3 interception works progress upstream.",
        label_short: "Monitoring + JICA upstream gains",
      },
    ],
    status_badges: [
      { label: "Hebbal-Nagavara cascade", tone: "sky" },
      { label: "Manyata Tech Park adjacency", tone: "amber" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 6041559",
          note: "OSM mappers traced the visible water surface; ~36 ha.",
          link: "https://www.openstreetmap.org/relation/6041559",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Thanisandra, Manyata Tech Park, ORR-East frontage, Hebbal-edge.",
          licence: "Derived",
        },
      ],
    },
  },
  iblur: {
    id: "iblur",
    osm_id: 3120373,
    name: "Iblur Lake",
    city_id: "bangalore",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 3120373). " +
      "Iblur is a small ~2.4 ha (OSM extent) HSR Layout / Sarjapur " +
      "Road citizen-restoration story. Friends of Iblur Lake + BBMP " +
      "co-maintain under MoU; the body is too small to be " +
      "operationally significant for hydrology but is widely cited as " +
      "a 'win' exemplar in Bengaluru's citizen-lake landscape.",
    polygon_path: "/geojson/rich-bodies/iblur.geojson",
    buffer_path: "/geojson/rich-bodies/iblur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). NGT Forward " +
      "Foundation regime applies.",
    buffer_source_url: "https://greentribunal.gov.in/",
    imagery_manifest_path: "/data/rich-bodies/iblur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/iblur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/iblur-overture-buildings.json",
      water_trend: "/data/rich-bodies/iblur-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/iblur-dw-water-trend.json",
      built_trend: "/data/rich-bodies/iblur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2014,
        label:
          "Friends of Iblur Lake forms in response to encroachment " +
          "and dumping; BBMP MoU follows shortly after.",
        label_short: "Friends of Iblur + BBMP MoU",
      },
      {
        year: 2016,
        label:
          "NGT Forward Foundation order (OA 222/2014) applies to " +
          "all BBMP lakes including Iblur.",
        label_short: "NGT 75 m buffer order",
        source_url: "https://greentribunal.gov.in/",
      },
      {
        year: 2019,
        label:
          "BBMP + citizen-group desilting + perimeter walking-track " +
          "addition; bird sightings (egrets, herons) recorded.",
        label_short: "Desilting + walking-track",
      },
    ],
    status_badges: [
      { label: "Friends of Iblur citizen MoU", tone: "emerald" },
      { label: "BBMP managed", tone: "sky" },
      { label: "NGT 75 m buffer order", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 3120373",
          note: "OSM mappers traced the visible water surface; ~2.4 ha. Iblur is the smallest body in the Bangalore rich-data cohort.",
          link: "https://www.openstreetmap.org/relation/3120373",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers HSR Layout 1st-3rd sectors, Iblur Junction, the Sarjapur Road frontage that connects toward Bellandur.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Iblur at ~2.4 ha is the smallest body in this cohort - only ~27 JRC water-classification pixels. Per-year area readings are very noisy and should be treated as directional only. The narrative value is the citizen-restoration story, not the satellite quantification.",
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
      dw_water_trend: "/data/rich-bodies/perumbakkam-dw-water-trend.json",
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
  // ---------------------------------------------------------------- Mumbai
  powai: {
    id: "powai",
    osm_id: 8546709,
    name: "Powai Lake",
    city_id: "mumbai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 8546709). " +
      "Powai is a ~179 ha artificial lake in the Powai valley, made in " +
      "1891 by damming a tributary of the Mithi as an anti-famine " +
      "augmentation of Bombay's supply. It left the drinking-water " +
      "system within about a year, against objections to the water's " +
      "quality, and is today an amenity and habitat lake - and the " +
      "subject of live NGT proceedings over untreated sewage reaching " +
      "it.",
    polygon_path: "/geojson/rich-bodies/powai.geojson",
    buffer_path: "/geojson/rich-bodies/powai-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). No lake-specific " +
      "no-build order applies; the halo is cohort-standard so bodies " +
      "can be read against each other.",
    imagery_manifest_path: "/data/rich-bodies/powai-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/powai-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/powai-overture-buildings.json",
      water_trend: "/data/rich-bodies/powai-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/powai-dw-water-trend.json",
      built_trend: "/data/rich-bodies/powai-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1891,
        label:
          "A stream tributary of the Mithi is dammed behind two 10 m " +
          "dams to augment Bombay's supply, on the Framji Kavasji " +
          "estate that gives the lake its valley its name. It yields " +
          "about two million gallons a day.",
        label_short: "Dammed for Bombay's supply",
        source_url: "https://en.wikipedia.org/wiki/Powai_Lake",
      },
      {
        year: 1892,
        label:
          "The drinking-water supply is abandoned within about a year " +
          "of completion, against objections to the water's quality, " +
          "and Powai's water goes to irrigation instead. A restoration " +
          "attempt in 1919 does not bring it back. It has never " +
          "returned to the city's drinking-water system.",
        label_short: "Drinking supply abandoned over water quality",
        source_url: "https://en.wikipedia.org/wiki/Powai_Lake",
      },
      {
        year: 2005,
        label:
          "26 July: Santacruz records 944 mm in twenty-four hours. The " +
          "Mithi - born at the Vihar and Powai overflows that gave " +
          "Mumbai its first pipe - cannot carry it, and the Chitale " +
          "Fact-Finding Committee reports the following year on holding " +
          "ponds built over and drains never upgraded.",
        label_short: "26/7 deluge; Chitale committee",
      },
      {
        year: 2024,
        label:
          "BMC's April operational data on hyacinth removal puts weed " +
          "cover at 23-25% of the lake surface.",
        label_short: "BMC puts hyacinth at 23-25%",
      },
      {
        year: 2025,
        label:
          "NGT proceedings (OA 150/2025) address about 18 MLD of " +
          "untreated sewage entering the lake - BMC's affidavit puts it " +
          "at ~10.9 MLD. The treatment plant that would stop it is " +
          "scheduled for December 2027; an NGT-appointed committee has " +
          "proposed a Rs 5 lakh-per-inlet monthly penalty. Hyacinth " +
          "cover in the July 2025 framing is 80%, against BMC's 23-25%.",
        label_short: "NGT OA 150/2025; STP due Dec 2027",
      },
    ],
    status_badges: [
      { label: "NGT proceedings (OA 150/2025)", tone: "amber" },
      { label: "Indian marsh crocodile habitat", tone: "emerald" },
      { label: "STP scheduled Dec 2027", tone: "sky" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 8546709",
          note: "OSM mappers traced the visible water surface; ~179 ha, consistent with the 179.3 ha carried for the same relation in this city's water-bodies layer. BMC manages the lake; no gazetted GIS boundary is published.",
          link: "https://www.openstreetmap.org/relation/8546709",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers IIT Bombay, the Powai and Hiranandani built-up belt, and the Aarey-facing slope.",
          licence: "Derived",
        },
        {
          label: "Sewage load and hyacinth cover",
          source: "NGT OA 150/2025 proceedings; BMC hyacinth-removal reporting (Apr 2024)",
          note: "The two published hyacinth figures disagree by a wide margin - 23-25% (BMC operational data) against 80% (July 2025 proceedings framing). Both are reported here rather than reconciled, because no measurement method is published for either.",
          licence: "Tribunal and municipal publication, cited with attribution",
        },
      ],
      caveats: [
        "Dense water-hyacinth mats classify as vegetation rather than water in both JRC and Dynamic World. On a lake whose published weed cover ranges from a quarter to four-fifths of the surface, the water-fraction series should be read as open-water extent, not as the lake's area - a fall in the line can mean weed, not loss.",
      ],
    },
  },
  vihar: {
    id: "vihar",
    osm_id: 311633,
    name: "Vihar Lake",
    city_id: "mumbai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 311633). " +
      "Vihar is a ~478 ha reservoir inside Sanjay Gandhi National " +
      "Park, impounding the headwaters of the Mithi. It opened in 1860 " +
      "as Bombay's first impounded, gravity-fed piped supply and is " +
      "still in the system, supplying roughly 90 MLD of Mumbai's " +
      "roughly 4,000.",
    polygon_path: "/geojson/rich-bodies/vihar.geojson",
    buffer_path: "/geojson/rich-bodies/vihar-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The lake sits " +
      "inside Sanjay Gandhi National Park, whose own boundary and " +
      "eco-sensitive zone are the operative legal lines; the 1 km halo " +
      "is cohort-standard and is not one of them.",
    imagery_manifest_path: "/data/rich-bodies/vihar-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/vihar-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/vihar-overture-buildings.json",
      water_trend: "/data/rich-bodies/vihar-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/vihar-dw-water-trend.json",
      built_trend: "/data/rich-bodies/vihar-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1860,
        label:
          "The Vihar Waterworks are completed, four years after work " +
          "began in January 1856, impounding the Mithi and piping " +
          "Bombay its first stored, gravity-fed water. For the fort " +
          "and the European quarter water now arrives at a tap; for " +
          "everyone else, at the pyaav.",
        label_short: "Bombay's first piped supply",
        source_url: "https://en.wikipedia.org/wiki/Vihar_Lake",
      },
      {
        year: 1879,
        label: "Tulsi follows, in the same Salsette catchment.",
        label_short: "Tulsi added",
      },
      {
        year: 2005,
        label:
          "26 July: the Mithi, which rises at the Vihar and Powai " +
          "overflows, cannot carry 944 mm in a day and rises into the " +
          "bowl behind the Vellard.",
        label_short: "26/7: the Mithi overwhelmed",
      },
    ],
    status_badges: [
      { label: "Mumbai's first impounded supply (1860)", tone: "sky" },
      { label: "Inside Sanjay Gandhi National Park", tone: "emerald" },
      { label: "Still in the supply system", tone: "sky" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 311633",
          note: "OSM mappers traced the visible water surface; ~478 ha. BMC's Hydraulic Engineer's department operates the reservoir; no gazetted GIS boundary is published.",
          link: "https://www.openstreetmap.org/relation/311633",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. Most of this halo lies inside Sanjay Gandhi National Park, so its built-area readings are a park-edge signal rather than a city-growth one.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Vihar's halo is mostly protected forest, so the built-gain series here is not measuring the same thing as it does around an in-city lake. Read the eastern arc - the Mulund and Bhandup slope - separately from the park interior.",
      ],
    },
  },
  tulsi: {
    id: "tulsi",
    osm_id: 6244817,
    name: "Tulsi Lake",
    city_id: "mumbai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 6244817). " +
      "Tulsi is a ~114 ha reservoir inside Sanjay Gandhi National " +
      "Park, added to Bombay's supply in 1879, twenty years after " +
      "Vihar. It is the smallest and least disturbed of the three " +
      "Salsette lakes.",
    polygon_path: "/geojson/rich-bodies/tulsi.geojson",
    buffer_path: "/geojson/rich-bodies/tulsi-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). Sanjay Gandhi " +
      "National Park's boundary and eco-sensitive zone are the " +
      "operative legal lines here; the 1 km halo is cohort-standard.",
    imagery_manifest_path: "/data/rich-bodies/tulsi-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/tulsi-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/tulsi-overture-buildings.json",
      water_trend: "/data/rich-bodies/tulsi-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/tulsi-dw-water-trend.json",
      built_trend: "/data/rich-bodies/tulsi-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1879,
        label:
          "Tulsi is added to Bombay's supply, nineteen years after " +
          "Vihar and thirteen before Tansa - the last of the lakes the " +
          "city could reach without leaving Salsette.",
        label_short: "Added to Bombay's supply",
      },
      {
        year: 1892,
        label:
          "Tansa opens, a hundred-odd kilometres of iron main away. " +
          "From here on the city's new water comes from outside the " +
          "island, and the Salsette lakes become the small share.",
        label_short: "The city's intake moves out of Salsette",
      },
    ],
    status_badges: [
      { label: "In supply since 1879", tone: "sky" },
      { label: "Inside Sanjay Gandhi National Park", tone: "emerald" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap relation 6244817",
          note: "OSM mappers traced the visible water surface; ~114 ha. No gazetted GIS boundary is published.",
          link: "https://www.openstreetmap.org/relation/6244817",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated. This halo lies almost entirely inside Sanjay Gandhi National Park.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Tulsi's halo is effectively all park. Near-zero built area here is the expected reading, not a finding; the series is worth watching for change rather than level.",
      ],
    },
  },
  tansa: {
    id: "tansa",
    osm_id: 196507985,
    name: "Tansa Lake",
    city_id: "mumbai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 196507985). " +
      "Tansa is a ~1,365 ha BMC supply reservoir in Thane district, " +
      "impounded in 1892 and delivered to the city down a hundred-odd " +
      "kilometres of iron main. The main itself became a settlement " +
      "corridor, and the resettlement of the families living on it is " +
      "part of the reservoir's record.",
    polygon_path: "/geojson/rich-bodies/tansa.geojson",
    buffer_path: "/geojson/rich-bodies/tansa-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). Tansa lies inside " +
      "the Tansa Wildlife Sanctuary, whose boundary is the operative " +
      "legal line; the 1 km halo is cohort-standard.",
    imagery_manifest_path: "/data/rich-bodies/tansa-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/tansa-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/tansa-overture-buildings.json",
      water_trend: "/data/rich-bodies/tansa-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/tansa-dw-water-trend.json",
      built_trend: "/data/rich-bodies/tansa-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1892,
        label:
          "Tansa is impounded and piped to Bombay - the Tansa main, a " +
          "hundred-odd kilometres of iron, one of the engineering " +
          "marvels of Victorian India.",
        label_short: "Impounded; the Tansa main opens",
      },
      {
        year: 1957,
        label:
          "Modak Sagar on the Vaitarna follows, then Upper Vaitarna in " +
          "1973 and Bhatsa in stages to 1981. Each dam pushes the " +
          "source farther from the tap.",
        label_short: "The walk into the Ghats begins",
      },
      {
        year: 2015,
        label:
          "Tens of thousands of families had settled along the Tansa " +
          "main itself. Moved off the pipeline on security grounds, " +
          "many were resettled at Mahul - a colony ringed by " +
          "refineries that the National Green Tribunal declared unfit " +
          "for human habitation the same year.",
        label_short: "Tansa main resettlement; NGT on Mahul",
      },
    ],
    status_badges: [
      { label: "BMC supply reservoir since 1892", tone: "sky" },
      { label: "Inside Tansa Wildlife Sanctuary", tone: "emerald" },
      { label: "Tansa main resettlement (Mahul)", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap way 196507985",
          note: "OSM mappers traced the visible water surface; ~1,365 ha. This is a full-tank-ish trace rather than a gazetted FTL line - no gazetted GIS boundary is published for BMC's lakes.",
          link: "https://www.openstreetmap.org/way/196507985",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; ~4,974 ha at this reservoir's size. Mostly sanctuary and village land in Shahapur and Wada talukas.",
          licence: "Derived",
        },
      ],
      caveats: [
        "A supply reservoir's water surface is operated, not observed: it is drawn down and refilled to a schedule. Year-to-year movement in the water-fraction series reflects monsoon and BMC's draw-off decisions together, and neither can be separated from the other in satellite data alone.",
        "The single OSM way traced here is the reservoir's water surface only. The Tansa main - the corridor that carries the reservoir's public story - is not part of this polygon and is not measured by the halo.",
      ],
    },
  },
  bhatsa: {
    id: "bhatsa",
    osm_id: 7112404,
    name: "Bhatsa Reservoir",
    city_id: "mumbai",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 7112404). " +
      "Bhatsa is a ~2,242 ha reservoir in Shahapur, impounded in " +
      "stages through 1981 and today the single largest source in " +
      "Mumbai's supply - close to half of it. It is the far end of the " +
      "city's long walk into the Western Ghats.",
    polygon_path: "/geojson/rich-bodies/bhatsa.geojson",
    buffer_path: "/geojson/rich-bodies/bhatsa-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). No lake-specific " +
      "no-build order applies; the halo is cohort-standard.",
    imagery_manifest_path: "/data/rich-bodies/bhatsa-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/bhatsa-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/bhatsa-overture-buildings.json",
      water_trend: "/data/rich-bodies/bhatsa-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/bhatsa-dw-water-trend.json",
      built_trend: "/data/rich-bodies/bhatsa-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1973,
        label:
          "Upper Vaitarna is impounded. The city's intake is now " +
          "firmly in the Ghats, and the Salsette lakes that began it " +
          "are a rounding error against the total.",
        label_short: "Upper Vaitarna impounded",
      },
      {
        year: 1981,
        label:
          "Bhatsa reaches its designed impoundment after staged " +
          "construction, and becomes the largest single source in " +
          "Mumbai's supply - today close to half of it.",
        label_short: "Bhatsa fully impounded",
      },
      {
        year: 2014,
        label:
          "Middle Vaitarna is commissioned, the first new source in a " +
          "generation. Nothing since has changed Bhatsa's share.",
        label_short: "Middle Vaitarna, the last new source",
      },
    ],
    status_badges: [
      { label: "Largest single source for Mumbai", tone: "sky" },
      { label: "Impounded in stages to 1981", tone: "slate" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap relation 7112404",
          note: "OSM mappers traced the visible water surface; ~2,242 ha. No gazetted GIS boundary is published.",
          link: "https://www.openstreetmap.org/relation/7112404",
          licence: "ODbL",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; ~9,424 ha at this reservoir's size, the largest halo in the cohort. Shahapur taluka, Thane district.",
          licence: "Derived",
        },
      ],
      caveats: [
        "As with Tansa, this is an operated reservoir: the water surface moves with BMC's draw-off as much as with the monsoon, and satellite data cannot separate the two.",
        "The water-surface line rises about thirty points across the 1990s, from roughly two-thirds of the mapped extent to near-full. Landsat coverage is complete from 1990, so this is a real change in how full the reservoir ran, not a gap in the record - but it is a change in operation against a fixed OpenStreetMap outline, not evidence that the reservoir grew.",
        "Bhatsa is roughly 80 km from the city it supplies. Built-area change in its halo is a Shahapur story, not a Mumbai one - useful for catchment pressure, not for reading the city's growth.",
      ],
    },
  },
  // ------------------------------------------------------------- Hyderabad
  "hussain-sagar": {
    id: "hussain-sagar",
    osm_id: 2833155,
    name: "Hussain Sagar",
    name_local: "హుసేన్ సాగర్",
    city_id: "hyderabad",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 2833155). " +
      "Hussain Sagar is a ~455 ha tank excavated in 1562 on a " +
      "tributary of the Musi, more than two decades before Hyderabad " +
      "itself was founded - the water came first and the city " +
      "afterwards. It is the third-largest water body in the city " +
      "after the two Nizam-era reservoirs, and the most visible.",
    polygon_path: "/geojson/rich-bodies/hussain-sagar.geojson",
    buffer_path: "/geojson/rich-bodies/hussain-sagar-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). Hussain Sagar has " +
      "no lake-specific no-build order on this platform's record; the " +
      "halo is cohort-standard so bodies can be read against each other.",
    imagery_manifest_path: "/data/rich-bodies/hussain-sagar-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/hussain-sagar-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/hussain-sagar-overture-buildings.json",
      water_trend: "/data/rich-bodies/hussain-sagar-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/hussain-sagar-dw-water-trend.json",
      built_trend: "/data/rich-bodies/hussain-sagar-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1562,
        label:
          "Excavated under Ibrahim Quli Qutb Shah on a tributary of " +
          "the Musi and completed the following year - more than two " +
          "decades before Hyderabad was founded.",
        label_short: "Excavated under Ibrahim Quli Qutb Shah",
      },
      {
        year: 1908,
        label:
          "28 September: the Great Musi Flood takes roughly 59,000 " +
          "houses. Upstream, 221 of the 788 tanks strung along the " +
          "river breach in sequence. The city's answer will be two new " +
          "reservoirs rather than anything done here.",
        label_short: "The Great Musi Flood",
      },
      {
        year: 2024,
        label:
          "HYDRAA is created to protect lakes and remove " +
          "encroachments. Final FTL notifications across the region " +
          "jump to 533 in this year, against a 2017-2023 run that " +
          "peaked at 60 and twice fell to 2.",
        label_short: "HYDRAA created; notifications surge",
      },
    ],
    status_badges: [
      { label: "Excavated 1562-63", tone: "sky" },
      { label: "No entry in HMDA gazetted register", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Tank boundary",
          source: "OpenStreetMap relation 2833155",
          note: "OSM mappers traced the visible water surface; ~455 ha, consistent with the 456 ha carried for the same relation in this city's water-bodies layer.",
          link: "https://www.openstreetmap.org/relation/2833155",
          licence: "ODbL",
        },
        {
          label: "Gazetted Full Tank Level",
          source: "HMDA Lake Protection Committee gazetted lake register (in repo)",
          note: "No entry appears under this name in the register as published, so no preliminary or final FTL date can be cited for it here. That is a gap in the public record as we hold it, not a finding about the lake's protection - Hussain Sagar sits under GHMC and state-level arrangements that the HMDA register does not enumerate.",
          link: "https://lakes.hmda.gov.in/",
          licence: "Telangana government publication, cited with attribution",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; cohort-standard radius. Covers Necklace Road, Khairatabad, Secunderabad's western edge and the Tank Bund frontage.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Hussain Sagar's halo has been substantially built since well before the satellite record opens in 1984. A flat built-area line here means the change happened earlier, not that it did not happen.",
      ],
    },
  },
  "osman-sagar": {
    id: "osman-sagar",
    osm_id: 28130557,
    name: "Osman Sagar",
    name_local: "ఉస్మాన్ సాగర్",
    city_id: "hyderabad",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 28130557). At " +
      "~1,810 ha Osman Sagar is the largest water body in the city. " +
      "It impounds the Musi at Gandipet and was built as flood " +
      "control first and water supply second, on M. Visvesvaraya's " +
      "advice after the 1908 flood. Its catchment was the subject of " +
      "GO 111 from 1996 until the 2022 repeal.",
    polygon_path: "/geojson/rich-bodies/osman-sagar.geojson",
    buffer_path: "/geojson/rich-bodies/osman-sagar-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The legally " +
      "operative line here was GO 111's 10 km catchment zone, not a " +
      "1 km ring - and it was repealed in 2022. The halo is " +
      "cohort-standard and should not be read as the protected area.",
    imagery_manifest_path: "/data/rich-bodies/osman-sagar-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/osman-sagar-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/osman-sagar-overture-buildings.json",
      water_trend: "/data/rich-bodies/osman-sagar-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/osman-sagar-dw-water-trend.json",
      built_trend: "/data/rich-bodies/osman-sagar-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1908,
        label:
          "28 September: the Great Musi Flood takes roughly 59,000 " +
          "houses, and 221 of the 788 tanks along the river breach in " +
          "sequence - a cascade engineered to slow water down failing " +
          "link by link.",
        label_short: "The Great Musi Flood",
      },
      {
        year: 1909,
        label:
          "M. Visvesvaraya joins as Special Consulting Engineer on 15 " +
          "April. His brief is not to find the city more water but to " +
          "impound floods in excess of what the river channel could " +
          "carry.",
        label_short: "Visvesvaraya's flood-control brief",
      },
      {
        year: 1913,
        label: "Construction begins on the Musi at Gandipet.",
        label_short: "Construction begins",
      },
      {
        year: 1918,
        label:
          "Osman Sagar is completed. At roughly 1,810 ha it is still " +
          "the largest water body in the city more than a century on.",
        label_short: "Completed; still the city's largest",
      },
      {
        year: 1996,
        label:
          "GO 111 bars major construction across the catchments of " +
          "Osman Sagar and Himayat Sagar.",
        label_short: "GO 111 protects the catchment",
      },
      {
        year: 2019,
        label:
          "30 December: a preliminary Full Tank Level notification " +
          "issues for the reservoir (HMDA register, lake 2907). No " +
          "final notification appears in the register edition held " +
          "here, so the boundary is not yet legally settled - the " +
          "same position as 1,626 of the region's 2,978 gazetted " +
          "lakes.",
        label_short: "Preliminary FTL notified; no final yet",
        source_url: "https://lakes.hmda.gov.in/",
      },
      {
        year: 2022,
        label:
          "The Telangana cabinet repeals GO 111 across 84 villages " +
          "and about 1.32 lakh acres, on the stated ground that the " +
          "city no longer depends on the twin reservoirs. HMWSSB's " +
          "own daily draw-off shows the twins' share rising over the " +
          "years since, not falling.",
        label_short: "GO 111 repealed",
      },
      {
        year: 2026,
        label:
          "1 July: HMWSSB's published capacity-at-full-tank for Osman " +
          "Sagar changes from 3.900 to 3.518 TMC, a 9.8% reduction, " +
          "with the other sources unchanged and no accompanying " +
          "notice. The cause is not established - re-survey, a gross- " +
          "versus-live redefinition and a correction are all " +
          "consistent with what is published.",
        label_short: "Published capacity cut 9.8%, unexplained",
      },
    ],
    status_badges: [
      { label: "Largest water body in the city", tone: "sky" },
      { label: "GO 111 catchment, repealed 2022", tone: "amber" },
      { label: "FTL preliminary 2019, no final", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap way 28130557",
          note: "OSM mappers traced the visible water surface; ~1,810 ha, consistent with this city's water-bodies layer. This is an observed surface, not the gazetted FTL line.",
          link: "https://www.openstreetmap.org/way/28130557",
          licence: "ODbL",
        },
        {
          label: "Gazetted Full Tank Level",
          source: "HMDA Lake Protection Committee gazetted lake register (in repo), lake 2907",
          note: "Preliminary notification 30 December 2019; no final notification in the edition held here. The per-lake FTL and cadastral sheets behind the register are scanned raster PDFs with no extractable text, so the gazetted boundary cannot be drawn alongside the OSM one the way Pallikaranai's can.",
          link: "https://lakes.hmda.gov.in/",
          licence: "Telangana government publication, cited with attribution",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated, and materially narrower than GO 111's catchment zone. Use it to read the shoreline, not the protected area.",
          licence: "Derived",
        },
      ],
      caveats: [
        "Osman Sagar is an operated reservoir drawn down and refilled to HMWSSB's schedule, so year-to-year movement in the water-surface series mixes monsoon with draw-off decisions.",
        "The published full-tank capacity moved by -9.8% on 1 July 2026 with no stated reason. Any percentage-of-capacity reading that crosses that date is comparing against two different denominators.",
        "GO 111's zone extended well beyond this 1 km halo. Built-area change inside the halo is a shoreline reading and is not a measure of what the repeal permits.",
      ],
    },
  },
  "himayat-sagar": {
    id: "himayat-sagar",
    osm_id: 5411363,
    name: "Himayat Sagar",
    name_local: "హిమాయత్ సాగర్",
    city_id: "hyderabad",
    boundary_source:
      "OpenStreetMap community-mapped polygon (relation 5411363). " +
      "Himayat Sagar impounds the Esi, the Musi's tributary, exactly " +
      "as Osman Sagar impounds the Musi. At ~1,492 ha it is the " +
      "second-largest water body in the city and the other half of " +
      "the GO 111 twin.",
    polygon_path: "/geojson/rich-bodies/himayat-sagar.geojson",
    buffer_path: "/geojson/rich-bodies/himayat-sagar-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). As at Osman " +
      "Sagar, the legally operative line was GO 111's catchment zone " +
      "until its 2022 repeal, not a 1 km ring.",
    imagery_manifest_path: "/data/rich-bodies/himayat-sagar-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/himayat-sagar-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/himayat-sagar-overture-buildings.json",
      water_trend: "/data/rich-bodies/himayat-sagar-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/himayat-sagar-dw-water-trend.json",
      built_trend: "/data/rich-bodies/himayat-sagar-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 1908,
        label:
          "28 September: the Great Musi Flood. The reservoirs that " +
          "follow are sized to absorb a flood peak rather than to " +
          "serve a population.",
        label_short: "The Great Musi Flood",
      },
      {
        year: 1927,
        label:
          "Himayat Sagar is completed on the Esi, the second of the " +
          "twin reservoirs, after Osman Sagar's 1918 completion.",
        label_short: "Completed on the Esi",
        source_url: "https://en.wikipedia.org/wiki/Himayat_Sagar",
      },
      {
        year: 1996,
        label:
          "GO 111 bars major construction across both twin " +
          "catchments.",
        label_short: "GO 111 protects the catchment",
      },
      {
        year: 2022,
        label:
          "GO 111 is repealed across 84 villages and about 1.32 lakh " +
          "acres.",
        label_short: "GO 111 repealed",
      },
      {
        year: 2026,
        label:
          "1 July: HMWSSB's published capacity-at-full-tank for " +
          "Himayat Sagar changes from 2.967 to 2.521 TMC, a 15.0% " +
          "reduction, on the same day as Osman Sagar's and with no " +
          "accompanying notice.",
        label_short: "Published capacity cut 15.0%, unexplained",
      },
    ],
    status_badges: [
      { label: "Second-largest water body in the city", tone: "sky" },
      { label: "GO 111 catchment, repealed 2022", tone: "amber" },
      { label: "No entry in HMDA gazetted register", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Reservoir boundary",
          source: "OpenStreetMap relation 5411363",
          note: "OSM mappers traced the visible water surface; ~1,492 ha, consistent with this city's water-bodies layer.",
          link: "https://www.openstreetmap.org/relation/5411363",
          licence: "ODbL",
        },
        {
          label: "Gazetted Full Tank Level",
          source: "HMDA Lake Protection Committee gazetted lake register (in repo)",
          note: "No entry appears under this name in the register as published - the only Himayathsagar-village entry is a separate small tank (Peeram Cheruvu, lake 2933). No preliminary or final FTL date can be cited for the reservoir itself from the record we hold.",
          link: "https://lakes.hmda.gov.in/",
          licence: "Telangana government publication, cited with attribution",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated, and materially narrower than GO 111's catchment zone.",
          licence: "Derived",
        },
      ],
      caveats: [
        "An operated reservoir: the water-surface series mixes monsoon with HMWSSB's draw-off schedule.",
        "The published full-tank capacity moved by -15.0% on 1 July 2026 with no stated reason. Percentage-of-capacity readings that cross that date compare against two different denominators.",
        "OpenStreetMap carries a single 10 km way for the Esi against 244 km for the Musi, so upstream context for this reservoir is much thinner in the public map than for its twin.",
      ],
    },
  },
  "durgam-cheruvu": {
    id: "durgam-cheruvu",
    osm_id: 28131043,
    name: "Durgam Cheruvu",
    name_local: "దుర్గం చెరువు",
    city_id: "hyderabad",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 28131043). At " +
      "~37 ha Durgam Cheruvu is the smallest body in this cohort and " +
      "the most closely surrounded: a Qutb Shahi-era tank in Raidurg " +
      "that now sits between HITEC City and Jubilee Hills, with a " +
      "cable-stayed bridge across it.",
    polygon_path: "/geojson/rich-bodies/durgam-cheruvu.geojson",
    buffer_path: "/geojson/rich-bodies/durgam-cheruvu-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The operative " +
      "legal line would be the lake's Full Tank Level and its " +
      "buffer-zone sheet, which has a preliminary notification but no " +
      "final one on the register edition held here.",
    imagery_manifest_path: "/data/rich-bodies/durgam-cheruvu-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/durgam-cheruvu-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/durgam-cheruvu-overture-buildings.json",
      water_trend: "/data/rich-bodies/durgam-cheruvu-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/durgam-cheruvu-dw-water-trend.json",
      built_trend: "/data/rich-bodies/durgam-cheruvu-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2014,
        label:
          "7 June: a preliminary Full Tank Level notification issues " +
          "for the lake (HMDA register, lake 3706, Raidurg village, " +
          "Serilingampally mandal).",
        label_short: "Preliminary FTL notified",
        source_url: "https://lakes.hmda.gov.in/",
      },
      {
        year: 2020,
        label:
          "25 September: the Durgam Cheruvu cable-stayed bridge is " +
          "inaugurated across the lake - a 233 m main span built at " +
          "about Rs 184 crore, connecting Jubilee Hills to the " +
          "Mindspace side of HITEC City.",
        label_short: "Cable bridge inaugurated",
        source_url: "https://en.wikipedia.org/wiki/Durgam_Cheruvu_Bridge",
      },
      {
        year: 2024,
        label:
          "HYDRAA is set up to protect lakes and remove " +
          "encroachments. Rangareddy - the district this lake sits in, " +
          "and the ORR growth corridor - has 891 gazetted lakes, of " +
          "which 34.5% carry a final FTL notification, the second " +
          "lowest coverage of any district in the region.",
        label_short: "HYDRAA created; Rangareddy at 34.5%",
      },
      {
        year: 2026,
        label:
          "No final Full Tank Level notification appears for this " +
          "lake in the register edition held here, twelve years after " +
          "the preliminary one. Until a final notification issues " +
          "there is no legally settled boundary to measure against.",
        label_short: "Still no final FTL notification",
        source_url: "https://lakes.hmda.gov.in/",
      },
    ],
    status_badges: [
      { label: "FTL preliminary 2014, no final", tone: "amber" },
      { label: "Cable bridge across the lake (2020)", tone: "sky" },
      { label: "HITEC City halo", tone: "slate" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 28131043",
          note: "OSM mappers traced the visible water surface; ~37 ha, consistent with this city's water-bodies layer.",
          link: "https://www.openstreetmap.org/way/28131043",
          licence: "ODbL",
        },
        {
          label: "Gazetted Full Tank Level",
          source: "HMDA Lake Protection Committee gazetted lake register (in repo), lake 3706",
          note: "Preliminary notification 7 June 2014; no final notification in the edition held here. The per-lake FTL and buffer-zone sheets are scanned raster PDFs with no extractable text, so the gazetted line cannot be drawn against the OSM one.",
          link: "https://lakes.hmda.gov.in/",
          licence: "Telangana government publication, cited with attribution",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; ~683 ha. At this lake's size the halo is roughly eighteen times the water surface, so halo readings describe HITEC City rather than the lake's edge.",
          licence: "Derived",
        },
      ],
      caveats: [
        "At ~37 ha and 30 m JRC resolution the body zone holds only a few hundred pixels, so the water-surface series is noisier here than anywhere else in this cohort. Read the direction, not the individual years.",
        "The halo is roughly eighteen times the lake's own area and covers one of the fastest-built districts in India. A high built-area figure here is a statement about Madhapur and Raidurg, not about encroachment on the lake - the gazetted FTL that would let anyone make the second statement has never been finally notified.",
      ],
    },
  },
  ameenpur: {
    id: "ameenpur",
    osm_id: 115772000,
    name: "Ameenpur Lake",
    city_id: "hyderabad",
    boundary_source:
      "OpenStreetMap community-mapped polygon (way 115772000). " +
      "Ameenpur is a ~127 ha lake on the Sangareddy edge of the " +
      "metropolitan region, declared in November 2016 as India's " +
      "first Biodiversity Heritage Site on a water body - and the " +
      "first such site in an urban setting - for the migratory birds " +
      "it carries.",
    polygon_path: "/geojson/rich-bodies/ameenpur.geojson",
    buffer_path: "/geojson/rich-bodies/ameenpur-buffer-1000m.geojson",
    buffer_metres: 1000,
    buffer_legal_basis:
      "1 km context buffer (indicative, editorial). The lake's " +
      "Biodiversity Heritage Site designation carries its own " +
      "management regime under the Biological Diversity Act 2002; " +
      "the 1 km halo is cohort-standard and is not that regime's " +
      "boundary.",
    imagery_manifest_path: "/data/rich-bodies/ameenpur-imagery-manifest.json",
    analysis_paths: {
      open_buildings: "/data/rich-bodies/ameenpur-open-buildings-verification.json",
      overture_buildings: "/data/rich-bodies/ameenpur-overture-buildings.json",
      water_trend: "/data/rich-bodies/ameenpur-jrc-water-trend.json",
      dw_water_trend: "/data/rich-bodies/ameenpur-dw-water-trend.json",
      built_trend: "/data/rich-bodies/ameenpur-dynamic-world-built-trend.json",
    },
    timeline_events: [
      {
        year: 2016,
        label:
          "November: Telangana declares Ameenpur a Biodiversity " +
          "Heritage Site under the Biological Diversity Act 2002 - " +
          "the first water body in India to be designated, and the " +
          "first such site in an urban area.",
        label_short: "India's first BHS water body",
        source_url:
          "https://www.thehansindia.com/posts/index/Telangana/2016-11-06/Ameenpur-Lake-declared-Biodiversity-Heritage-Site/262605",
      },
      {
        year: 2017,
        label:
          "20 March: a preliminary Full Tank Level notification " +
          "issues for the lake (HMDA register, Pedda Cheruvu, lake " +
          "1200/34, Ameenpur village, Sangareddy).",
        label_short: "Preliminary FTL notified",
        source_url: "https://lakes.hmda.gov.in/",
      },
      {
        year: 2025,
        label:
          "Final FTL notifications across the region run at 533 in " +
          "this year and 533 the year before, clearing a backlog that " +
          "had moved by 10, 60, 2, 3 and 2 across 2017-2023. " +
          "Twenty-five other lakes in Ameenpur mandal sit in the same " +
          "register; several now carry final notifications.",
        label_short: "Region-wide notification surge",
        source_url: "https://lakes.hmda.gov.in/",
      },
      {
        year: 2026,
        label:
          "No final Full Tank Level notification appears for Ameenpur " +
          "itself in the register edition held here. The lake carries " +
          "a national biodiversity designation and a boundary that is " +
          "not yet legally settled at the same time.",
        label_short: "Still no final FTL notification",
        source_url: "https://lakes.hmda.gov.in/",
      },
    ],
    status_badges: [
      { label: "India's first BHS water body (2016)", tone: "emerald" },
      { label: "FTL preliminary 2017, no final", tone: "amber" },
    ],
    buffer_legally_mandated: false,
    data_sources: {
      boundary: [
        {
          label: "Lake boundary",
          source: "OpenStreetMap way 115772000",
          note: "OSM mappers traced the visible water surface; ~127 ha, consistent with this city's water-bodies layer.",
          link: "https://www.openstreetmap.org/way/115772000",
          licence: "ODbL",
        },
        {
          label: "Gazetted Full Tank Level",
          source: "HMDA Lake Protection Committee gazetted lake register (in repo), lake 1200/34",
          note: "The register entry is under the local name Pedda Cheruvu, Ameenpur village, Sangareddy district. Preliminary notification 20 March 2017; no final notification in the edition held here.",
          link: "https://lakes.hmda.gov.in/",
          licence: "Telangana government publication, cited with attribution",
        },
        {
          label: "Biodiversity Heritage Site designation",
          source: "Telangana designation under the Biological Diversity Act 2002, November 2016",
          note: "Reported designation; the notification itself is an outstanding fetch for this platform, so the date is carried at month rather than day precision and no site boundary is drawn from it.",
          link: "https://www.thehansindia.com/posts/index/Telangana/2016-11-06/Ameenpur-Lake-declared-Biodiversity-Heritage-Site/262605",
          licence: "Press report, cited with attribution",
        },
        {
          label: "1 km surroundings buffer (editorial)",
          source: "Computed via @turf/buffer from the OSM polygon",
          note: "Not legally mandated; ~975 ha covering Ameenpur, Ilapur and the Patancheru-Miyapur growth edge.",
          licence: "Derived",
        },
      ],
      caveats: [
        "The Biodiversity Heritage Site designation is carried here from press reporting. Until the notification itself is obtained, treat the month as reported and the site's legal boundary as unknown - it is not the polygon drawn on this map.",
        "Ameenpur is a bird lake, and shallow bird lakes read as seasonal rather than permanent water in JRC. A low permanent-water fraction here is the expected signature of the habitat, not evidence of loss.",
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

/** Rich bodies belonging to one city.
 *
 *  The map used to fetch EVERY registry polygon on every city's page,
 *  which was invisible at 7 bodies and is a real cost at 30: a Mumbai
 *  visitor paid for Bangalore's thirteen lakes before their own map drew.
 *  Callers pass their cityId and fetch only what they can render. */
export function getRichBodiesForCity(cityId: string): RichBodyEntry[] {
  return Object.values(RICH_BODIES).filter((b) => b.city_id === cityId);
}

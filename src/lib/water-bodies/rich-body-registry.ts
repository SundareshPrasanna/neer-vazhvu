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
        source_url: "https://www.thehindu.com/news/national/karnataka/foam-from-bellandur-lake-catches-fire/article17319080.ece",
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

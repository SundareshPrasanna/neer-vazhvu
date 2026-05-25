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

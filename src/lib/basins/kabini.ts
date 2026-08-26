import type { BasinManifest } from "./types";

// Kabini basin - sub-basin C2 of the Karnataka Cauvery, the first consumer of
// the station-readings contract (docs/specs/flow-stations-contract.md).
// Data assembled by scripts/build_kabini_sources.py + ingest_basin.py from the
// cauvery-ka overview ingest (KWRIS) and Paani Earth's Cauvery basin GIS
// packages (Aug 2026); flow series attached by build_basin_flow_readings.py
// from the India-WRIS Dataset API.
//
// Sub-hydroshed ids are India-WRIS watershed codes (wsconc). WRIS publishes
// them without names, so the code is the label - unlike the Arkavathi, whose
// sheds came named from the partner package.
export const KABINI: BasinManifest = {
  basinId: "kabini",
  // Reached through the Cauvery hierarchy, not city nav.
  cityIds: [],
  parentBasinId: "cauvery-ka",
  displayName: "Kabini Basin",
  displayNameLocal: "ಕಬಿನಿ ಜಲಾನಯನ",
  blurb:
    "The Cauvery's Wayanad-fed southern arm: impounded at the Kabini dam, joined by the Nugu, Taraka and Gundal, and carrying a CPCB polluted stretch that now runs the length of its Karnataka course before it meets the Cauvery at T. Narasipura. Tap a station for its flow and quality record.",
  mapCenter: [12.05, 76.35],
  mapZoom: 10,
  areaKm2: 4883,
  areaNote:
    "Karnataka portion of the Kabini sub-basin (C2), per Karnataka WRD's basin decomposition (KWRIS). The full watershed is 1.45x this polygon: the headwaters rise in Wayanad, Kerala, and that reach is drawn as context so the river does not appear to begin at the state line. Everything else on this map stops at the Karnataka boundary.",
  // Open the DEP view on Mysuru by default (54.6% of the district is in-basin
  // and it carries the Kabini-side ULB cards).
  defaultGapUnit: "mysuru",
  rivers: [
    {
      riverId: "kabini",
      displayName: "Kabini",
      displayNameLocal: "ಕಬಿನಿ",
      subHydroshedIds: [
        "C05CAM14",
        "C05CAM15",
        "C05CAM16",
        "C05CAM17",
        "C05CAM18",
        "C05CAM19",
        "C05CAM21",
        "C05CAM22",
      ],
      color: "#2563eb",
      narrative:
        "The mainstem. Rises in the Wayanad hills of Kerala, enters Karnataka at the Kabini reservoir (Beechanahalli), gathers the Nugu and Taraka, and flows past Nanjangud to join the Cauvery at T. Narasipura. In 2018 CPCB's polluted stretch here was the short reach below Nanjangud - about 9 km on KSPCB's own action plan, 12 km as mapped; by 2025 it ran 104 km, from Saragur to the T. Narasipura water-supply intake, effectively the whole Karnataka course.",
      attributes: {
        origin: "Wayanad hills, Kerala (Pakramthalam range)",
        length: "About 105 km in Karnataka (KSPCB action plan); 155 km of mapped centreline inside the sub-basin",
        tributaries: "Nugu, Taraka, Gundal, Hebbal Halla",
        flowsInto: "Cauvery at T. Narasipura (Triveni Sangama)",
        pollutedStretch:
          "Saragur village downstream to the T. Narasipura water-supply intake - Priority V, 104 km (CPCB, October 2025)",
        restorationInitiatives:
          "KSPCB action plan under NGT OA 673/2018; tracked stretch-wise until the Sep 2025 MPR, after which PRS-wise reporting stopped",
      },
    },
    {
      riverId: "gundal",
      displayName: "Gundal",
      displayNameLocal: "ಗುಂಡಾಲ್",
      subHydroshedIds: ["C05CAM20"],
      color: "#2563eb",
      narrative:
        "The Kabini's eastern tributary, draining the Gundlupet and Chamarajanagara side of the basin through the Nalluru Amanikere and Kamarahalli tanks before joining the mainstem. Not one of the 13 NWMP stations or 3 flow gauges on this map falls in its catchment, and no public record we hold measures its water quality separately.",
      attributes: {
        length: "83 km of mapped centreline inside the sub-basin",
        flowsInto: "Kabini",
        pollutedStretch: "Not classified by CPCB",
      },
    },
  ],
  // Palette discipline follows the Arkavathi: structural context neutral,
  // the water family one blue/cyan set separated by form, each floor's
  // thematic layers a distinct bright hue.
  layers: [
    // ── Floor 1: Hydrology ──
    // The full watershed, Karnataka and Kerala together, drawn muted behind
    // the bold C2 frame. 31% of this basin is in Kerala; clipping it away made
    // the river look as though it began at the state line.
    { family: "context-boundary", label: "Full basin, both states", floor: "hydrology", geom: "fill", color: "#64748b", defaultOn: true, context: true },
    { family: "context-rivers", label: "Kabini above the state line", floor: "hydrology", geom: "line", color: "#38bdf8", defaultOn: true, context: true },
    { family: "boundary", label: "Basin boundary (Karnataka)", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "Sub-catchments (WRIS watersheds)", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    // FABDEM 30 m hypsometric bands - the Nagarahole/Bandipur ghat edge at
    // 1,486 m down to the Cauvery confluence at 634 m. Default OFF: a reading
    // aid, and ~1 MB that should only load when asked for.
    { family: "elevation-bands", label: "Terrain (elevation bands)", floor: "hydrology", geom: "fill", color: "#b45309", defaultOn: false, elevation: true },
    { family: "rivers", label: "Kabini & Gundal", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    // Both CPCB editions - the 2018 reach below Nanjangud and the 2025 one
    // that runs the length of the river - so the growth toggle has something
    // to compare. Default OFF, as on the Arkavathi: the stretch renders while
    // the PRS panel is open, or when switched on explicitly.
    { family: "prs", label: "Polluted stretch (PRS)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false, prs: true },
    { family: "waterbodies-major", label: "Major waterbodies (named)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
    { family: "waterbodies-minor", label: "Other waterbodies", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
    { family: "drainage", label: "Drainage network", floor: "hydrology", geom: "line", color: "#3b82f6", defaultOn: false, heavy: true },

    // The outfalls the October 2020 progress report itemises, on a stretch
    // whose action plan states there are no drains discharging into the river.
    // Amber, matching the Arkavathi's polluting-drains layer.
    { family: "prs-drains", label: "Polluting drain outfalls (MPR, Oct 2020)", floor: "hydrology", geom: "point", color: "#eab308", defaultOn: true, hasKinds: true, kindFilter: "drain-inlet" },
    { family: "prs-drains", label: "Drains reaching them", floor: "hydrology", geom: "line", color: "#ca8a04", defaultOn: false, kindFilter: "drain-line" },

    // ── Floor 2: Monitoring - the station-readings pilot ──
    { family: "flow-stations", label: "CWC monitoring points (tap for readings)", floor: "monitoring", geom: "point", color: "#0e7490", defaultOn: true, readings: true },
    // readings: the 5 river-table stations carry CPCB annual BOD/DO/FC trend
    // packs (build_basin_wq_param_packs.py); lake stations stay location-only.
    { family: "monitoring-points", label: "KSPCB monitoring points (tap for readings)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true, readings: true },

    // ── Floor 3: Pressures ──
    { family: "pressures-industrial", label: "KIADB industrial areas", floor: "pressures", geom: "fill", color: "#dc2626", defaultOn: true, hasKinds: true, kindFilter: "industrial-area" },
    { family: "pressures-industrial", label: "KIADB industrial area points", floor: "pressures", geom: "point", color: "#9d174d", defaultOn: true, kindFilter: "industrial-area-point" },
    // Large units sitting outside any notified estate - invisible in a
    // KIADB-only view, and both of them on the stretch.
    { family: "pressures-industrial", label: "Industries outside estates", floor: "pressures", geom: "fill", color: "#7f1d1d", defaultOn: true, kindFilter: "industry-outside-estate" },
    // Estates OUTSIDE the basin boundary that drain toward it (Paani Earth's
    // selection). Kept apart from the in-basin estates so the map never blurs
    // "in the basin" into "draining into it".
    { family: "pressures-industrial", label: "Industrial areas outside the basin", floor: "pressures", geom: "fill", color: "#f472b6", defaultOn: false, kindFilter: "industrial-area-outside-basin" },
    { family: "pressures-quarries", label: "Quarries (OSM-mapped)", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: false, hasKinds: true },
    { family: "forests", label: "Notified forests", floor: "pressures", geom: "fill", color: "#16a34a", defaultOn: false },
    { family: "protected-areas", label: "Protected areas (Nagarahole & Bandipur fringes)", floor: "pressures", geom: "fill", color: "#15803d", defaultOn: false },

    // ── Floor 4: Governance & infrastructure ──
    { family: "gaps", label: "District Environment Plan (DEP) Snapshot", floor: "governance", geom: "fill", color: "#dc2626", defaultOn: true, gap: true },
    { family: "infrastructure", label: "Sewage treatment plants", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true, hasKinds: true, kindFilter: "stp" },
    // Default OFF per Paani's review: the impoundments they mark already read
    // as waterbodies. The layers stay because the WRIS register carries height,
    // gross storage, year and purpose that a waterbody polygon does not.
    { family: "infrastructure", label: "Dams & reservoirs", floor: "governance", geom: "point", color: "#7e22ce", defaultOn: false, kindFilter: "dam" },
    { family: "infrastructure", label: "Anicuts & weirs", floor: "governance", geom: "point", color: "#c084fc", defaultOn: false, kindFilter: "barrage" },
    { family: "command-areas", label: "Irrigation command areas", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false },
    // District stays neutral, always-on context; the finer levels are opt-in
    // and take cool hues so they never collide with the warm gap choropleth.
    { family: "admin-district", label: "Districts", floor: "governance", geom: "fill", color: "#94a3b8", defaultOn: true, context: true },
    { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#7570b3", defaultOn: false },
    { family: "admin-town", label: "Urban Local Bodies (ULBs)", floor: "governance", geom: "fill", color: "#e7298a", defaultOn: false },
  ],
  collaboration: {
    label: "Developed in collaboration with",
    name: "Paani Earth Foundation",
    logo: "/partners/paani-earth-foundation.png",
    url: "https://paani.earth",
    sub: "Cauvery basin spatial data and review",
  },
  credits: [
    "Basin boundary: Karnataka WRD basin decomposition (KWRIS), sub-basin C2, carried over from the Cauvery (Karnataka) atlas ingest. Every layer here is clipped to it, so the atlas is the Karnataka portion of the Kabini; the Wayanad (Kerala) headwaters are not mapped.",
    "Sub-catchments, river centrelines, drainage network, major waterbodies, dams and anicuts: India-WRIS, via Paani Earth Foundation's Cauvery hydrology GeoPackage (August 2026). WRIS publishes watersheds with codes and no names, so sub-catchments are labelled by code.",
    "Dams: India-WRIS National Register of Large Dams, extract dated 14 April 2026. It disagrees with the older CWC MLRD list on completion year for four minor tanks (Hebballa, Kamarahalli, Kalikatte, Karimuddenahalli); the newer register's years are the ones shown.",
    "Minor irrigation tanks: Karnataka GIS tank inventory (KGIS TIS), via Paani Earth's Cauvery package.",
    "Polluted river stretch: CPCB, Polluted River Stretches for Restoration of Water Quality 2025 (October 2025); geometry digitised by Paani Earth. Only the 2025 stretch is drawn - the package's 2018 and 2020 lines map about 3 km of a stretch KSPCB's own action plan describes as roughly 9 km, so the earlier epochs are reported in the panel from the documents instead.",
    "Industrial areas (KIADB), notified forests and protected areas: Karnataka GIS (KGIS), via Paani Earth's Cauvery package, filtered to the Kabini boundary. Estates shown as outside the basin, and the two large units outside any estate, are Paani Earth's own selection of works that drain toward the stretch.",
    "Quarries: digitised from OpenStreetMap (© OpenStreetMap contributors, ODbL), via Paani Earth's Cauvery package.",
    "Irrigation command areas: India-WRIS, via Paani Earth's Cauvery package.",
    "Administrative boundaries (districts, taluks, ULBs): Karnataka GIS (KGIS), via Paani Earth's Admin GeoPackage, clipped to the basin.",
    "CWC flow gauges + readings: India-WRIS Dataset API (CWC hydrological observations). Discharge is published in arrears; the telemetric level feed has been frozen at the source since 04 Jun 2026.",
    "KSPCB water-quality monitoring points: station list validated and extended by Paani Earth (August 2026 review), wider than the NWMP subset alone; parameter trends from CPCB's annual Water Quality of Rivers tables.",
    "Polluted river stretch, both editions: CPCB, Polluted River Stretches for Restoration of Water Quality 2025 (October 2025). The 2018 reach was redrawn by Paani Earth against the monitoring station locations and delivered in the August 2026 review; the mapped course measures 12.2 km against the 'about 9 Kms' KSPCB's action plan states.",
    "Polluting drain outfalls and the drains reaching them: mapped by Paani Earth from the NMCG monthly progress report of October 2020, which itemises the drains without coordinates, onto the India-WRIS drainage network.",
    "Sewage treatment plants: NMCG progress report (January 2025) against the CPCB 2021 STP inventory, compiled by Paani Earth. Coordinates for the Gundlupet plants are flagged by the compiler as needing validation.",
    "Terrain: FABDEM V1-2 (Hawker et al. 2022, University of Bristol - Copernicus GLO-30 with forests and buildings removed), via Google Earth Engine; CC BY-NC-SA 4.0. Classified into elevation bands at ~30 m resolution and clipped to the basin boundary, simplified for basin-scale display.",
  ],
};

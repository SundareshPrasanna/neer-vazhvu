import type { BasinManifest } from "./types";

// Arkavathi basin - the reference implementation of the Basin Atlas contract,
// co-built with Paani Earth Foundation (June 2026). Data ingested from
// docs/paani_data/ via scripts/ingest_basin.py; see docs/specs/basin-atlas.md.
//
// Sub-hydroshed ids are India-WRIS wsconc codes (note CO5CAM33 carries a
// letter O in the source, preserved verbatim). Each named river maps to the
// shed(s) it drains - that mapping is the click-scope when the river is
// selected.
export const ARKAVATHI: BasinManifest = {
  basinId: "arkavathi",
  cityIds: ["bangalore"],
  displayName: "Arkavathi Basin",
  displayNameLocal: "ಅರ್ಕಾವತಿ ಜಲಾನಯನ",
  blurb:
    "The Arkavathi and its tributaries - Vrishabhavathi, Kumudavathi and Suvarnamukhi - drain Bengaluru's west and north into the Cauvery. Once the city's first piped-water source (Hesaraghatta 1894, TG Halli 1933), the basin now carries the wastewater, solid waste and industrial effluent of a metropolis. Click a river to follow its story through the basin.",
  // Basin spans roughly Chikkaballapura (north) to the Cauvery confluence
  // (south); centre near Bengaluru's western edge at a basin-wide zoom.
  mapCenter: [12.9, 77.45],
  mapZoom: 10,
  areaKm2: 4161,
  areaNote: "Basin boundary area as supplied by Paani Earth (India-WRIS derived).",
  rivers: [
    {
      riverId: "arkavathi",
      displayName: "Arkavathi",
      displayNameLocal: "ಅರ್ಕಾವತಿ",
      subHydroshedIds: ["C05CAM31", "C05CAM32", "CO5CAM33", "C05CAM36"],
      color: "#2563eb",
      narrative:
        "The mainstem. Rises near Nandi Hills, impounded at Hesaraghatta and Thippagondanahalli, and joins the Cauvery below Kanakapura. Both reservoirs are effectively dead as freshwater sources after decades of upstream urbanisation; CPCB lengthened and worsened the Hesaraghatta-Kanakapura stretch to Priority I in 2022.",
    },
    {
      riverId: "vrishabhavathi",
      displayName: "Vrishabhavathi",
      displayNameLocal: "ವೃಷಭಾವತಿ",
      subHydroshedIds: ["C05CAM34"],
      color: "#d97706",
      narrative:
        "The foam-and-fire river. Flows south-west out of central Bengaluru through the Vrishabhavathi valley, carrying the untreated overflow of the V-Valley STPs plus industrial effluent, into Byramangala reservoir before joining the Arkavathi. ATREE found heavy metals in fodder, milk and vegetables in villages along it.",
    },
    {
      riverId: "kumudavathi",
      displayName: "Kumudavathi",
      displayNameLocal: "ಕುಮುದಾವತಿ",
      subHydroshedIds: ["C05CAM30"],
      color: "#0d9488",
      narrative:
        "North-western tributary of the Arkavathi, draining toward Thippagondanahalli reservoir. Its catchment recharge has been a focus of revival efforts.",
    },
    {
      riverId: "suvarnamukhi",
      displayName: "Suvarnamukhi",
      displayNameLocal: "ಸುವರ್ಣಮುಖಿ",
      subHydroshedIds: ["C05CAM35"],
      color: "#7c3aed",
      narrative:
        "A smaller tributary stream in the basin's system. Shed mapping is provisional pending confirmation with Paani Earth.",
    },
  ],
  layers: [
    // ── Floor 1: Hydrology (surface) ──
    { family: "boundary", label: "Basin boundary", floor: "hydrology", geom: "fill", color: "#0f766e", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "Sub-catchments", floor: "hydrology", geom: "fill", color: "#0ea5e9", defaultOn: true, context: true },
    { family: "rivers", label: "Rivers", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    { family: "waterbodies-major", label: "Tanks & reservoirs (named)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true, minZoom: 11 },
    { family: "waterbodies-minor", label: "Other waterbodies", floor: "hydrology", geom: "fill", color: "#38bdf8", defaultOn: false, minZoom: 13, heavy: true },
    { family: "drainage", label: "Drainage network", floor: "hydrology", geom: "line", color: "#3b82f6", defaultOn: false, minZoom: 13, heavy: true },

    // ── Floor 2: Monitoring & evidence ──
    { family: "monitoring-points", label: "Monitoring points", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },
    { family: "evidence-points", label: "Pollution evidence", floor: "monitoring", geom: "point", color: "#e11d48", defaultOn: true },

    // ── Floor 3: Pressures ──
    { family: "pressures", label: "Industry, quarries & waste", floor: "pressures", geom: "fill", color: "#b91c1c", defaultOn: true, hasKinds: true },

    // ── Floor 4: Governance & response ──
    { family: "infrastructure", label: "Treatment plants (STPs)", floor: "governance", geom: "point", color: "#0891b2", defaultOn: true },
    { family: "command-areas", label: "Irrigation command areas", floor: "governance", geom: "fill", color: "#ca8a04", defaultOn: false },
    { family: "admin-district", label: "Districts", floor: "governance", geom: "fill", color: "#64748b", defaultOn: true, context: true },
    { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#94a3b8", defaultOn: false, minZoom: 11 },
    { family: "admin-town", label: "Towns", floor: "governance", geom: "fill", color: "#a78bfa", defaultOn: false, minZoom: 11 },
    { family: "admin-gp", label: "Gram panchayats", floor: "governance", geom: "fill", color: "#cbd5e1", defaultOn: false, minZoom: 13, heavy: true },
  ],
  credits: [
    "Spatial data: Paani Earth Foundation - Arkavathi River Basin GIS package (Feb 2026).",
    "Monitoring points: KSPCB, CPCB, CWC, Dept. of Mines & Geology, ATREE and others, compiled by Paani Earth.",
    "Pollution evidence: Arkavathi Horata Samithi and RTI filings (lab analyses hosted on paani.earth).",
    "Boundaries: Karnataka GIS (KGIS); sub-watersheds & command areas: India-WRIS.",
  ],
};

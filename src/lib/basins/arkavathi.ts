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
  // (south); a basin-wide initial view. The atlas then frames to content - the
  // whole basin (all rivers) by default, or the clicked river. No fixed focus:
  // the basin is ~120 km tall, so pinning a tight Bengaluru view would hide the
  // Arkavathi when you select it.
  mapCenter: [12.9, 77.45],
  mapZoom: 10,
  areaKm2: 4161,
  areaNote: "Basin boundary area as supplied by Paani Earth (India-WRIS derived).",
  // Open the gap view on Ramanagara by default so the detail panel is populated.
  defaultGapUnit: "ramanagara",
  rivers: [
    {
      riverId: "arkavathi",
      displayName: "Arkavathi",
      displayNameLocal: "ಅರ್ಕಾವತಿ",
      subHydroshedIds: ["C05CAM31", "C05CAM32", "CO5CAM33", "C05CAM36"],
      color: "#2563eb",
      // Rivers share one blue; the selected river is emphasised by weight, not
      // hue (keeps the map from becoming a rainbow of hard-to-tell lines).
      narrative:
        "The mainstem. Rises near Nandi Hills, impounded at Hesaraghatta and Thippagondanahalli, and joins the Cauvery below Kanakapura. Both reservoirs are effectively dead as freshwater sources after decades of upstream urbanisation; CPCB lengthened and worsened the Hesaraghatta-Kanakapura stretch to Priority I in 2022.",
    },
    {
      riverId: "vrishabhavathi",
      displayName: "Vrishabhavathi",
      displayNameLocal: "ವೃಷಭಾವತಿ",
      subHydroshedIds: ["C05CAM34"],
      color: "#2563eb",
      narrative:
        "The foam-and-fire river. Flows south-west out of central Bengaluru through the Vrishabhavathi valley, carrying the untreated overflow of the V-Valley STPs plus industrial effluent, into Byramangala reservoir before joining the Arkavathi. ATREE found heavy metals in fodder, milk and vegetables in villages along it.",
    },
    {
      riverId: "kumudavathi",
      displayName: "Kumudavathi",
      displayNameLocal: "ಕುಮುದಾವತಿ",
      subHydroshedIds: ["C05CAM30"],
      color: "#2563eb",
      narrative:
        "North-western tributary of the Arkavathi, draining toward Thippagondanahalli reservoir. Its catchment recharge has been a focus of revival efforts.",
    },
    {
      riverId: "suvarnamukhi",
      displayName: "Suvarnamukhi",
      displayNameLocal: "ಸುವರ್ಣಮುಖಿ",
      subHydroshedIds: ["C05CAM35"],
      color: "#2563eb",
      narrative:
        "A smaller tributary stream in the basin's system. Shed mapping is provisional pending confirmation with Paani Earth.",
    },
  ],
  // Palette discipline (so simultaneously-visible layers stay distinct):
  //  - structural context (boundary, sub-catchments, admin) = neutral, rendered
  //    theme-aware so it recedes and never competes with the data;
  //  - water (rivers, tanks, drainage) = one blue/cyan family, separated by form;
  //  - each floor's thematic layers get their own distinct, bright hue.
  layers: [
    // ── Floor 1: Hydrology (surface) - water family ──
    { family: "boundary", label: "Basin boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "Sub-catchments", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    // Water family - all mid-tone so they hold contrast on both the light OSM
    // base and the darkened (dark-mode) base; separated by hue + form.
    { family: "rivers", label: "Rivers", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    { family: "waterbodies-major", label: "Tanks & reservoirs (named)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
    { family: "waterbodies-minor", label: "Other waterbodies", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
    { family: "drainage", label: "Drainage network", floor: "hydrology", geom: "line", color: "#3b82f6", defaultOn: false, heavy: true },

    // ── Floor 2: Monitoring & evidence ──
    { family: "monitoring-points", label: "Monitoring points", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },
    { family: "evidence-points", label: "Pollution evidence", floor: "monitoring", geom: "point", color: "#f43f5e", defaultOn: true },

    // ── Floor 3: Pressures (warm ramp) ──
    { family: "pressures", label: "Industry, quarries & waste", floor: "pressures", geom: "fill", color: "#dc2626", defaultOn: true, hasKinds: true },

    // ── Floor 4: Gaps & response ──
    // Treatment-gap intelligence (cross-source; panel content in gaps.json).
    // Demo: Ramanagara. More units are a data-only addition.
    { family: "gaps", label: "Treatment & waste gaps", floor: "governance", geom: "fill", color: "#dc2626", defaultOn: true, gap: true },
    { family: "infrastructure", label: "Treatment plants (STPs)", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true },
    // Faecal sludge (septage) plants - the treatment route for unsewered towns,
    // a distinct cyan from the purple STPs; the current three are planned/at-tender.
    { family: "fstp", label: "Faecal sludge plants (FSTP)", floor: "governance", geom: "point", color: "#0891b2", defaultOn: true },
    { family: "command-areas", label: "Irrigation command areas", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false },
    // District stays neutral (always-on context); the opt-in finer levels get
    // distinct colors + dash patterns so several can be told apart at once.
    { family: "admin-district", label: "Districts", floor: "governance", geom: "fill", color: "#94a3b8", defaultOn: true, context: true },
    { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#2dd4bf", defaultOn: false },
    { family: "admin-town", label: "Towns", floor: "governance", geom: "fill", color: "#f472b6", defaultOn: false },
    { family: "admin-gp", label: "Gram panchayats", floor: "governance", geom: "fill", color: "#fb923c", defaultOn: false, heavy: true },
  ],
  credits: [
    "Spatial data: Paani Earth Foundation - Arkavathi River Basin GIS package (Feb 2026).",
    "Monitoring points: KSPCB, CPCB, CWC, Dept. of Mines & Geology, ATREE and others, compiled by Paani Earth.",
    "Pollution evidence: Arkavathi Horata Samithi and RTI filings (lab analyses hosted on paani.earth).",
    "Treatment plants (STP/FSTP): BWSSB, KUWS&DB, BDA and KUIDFC, compiled by Paani Earth; locations confirmed against satellite imagery.",
    "Major industries: KSPCB 17-category polluting-industry list (geocoded).",
    "Boundaries: Karnataka GIS (KGIS); sub-watersheds & command areas: India-WRIS.",
  ],
};

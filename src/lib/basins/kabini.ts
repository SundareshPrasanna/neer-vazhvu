import type { BasinManifest } from "./types";

// Kabini basin - sub-basin C2 of the Karnataka Cauvery, the first consumer of
// the station-readings contract (docs/specs/flow-stations-contract.md).
// Data assembled by scripts/build_kabini_sources.py + ingest_basin.py from the
// cauvery-ka overview ingest (KWRIS) and Paani Earth's Cauvery basin GIS
// package (Aug 2026); flow series attached by build_basin_flow_readings.py
// from the India-WRIS Dataset API.
export const KABINI: BasinManifest = {
  basinId: "kabini",
  // Reached through the Cauvery hierarchy, not city nav.
  cityIds: [],
  parentBasinId: "cauvery-ka",
  displayName: "Kabini Basin",
  displayNameLocal: "ಕಬಿನಿ ಜಲಾನಯನ",
  blurb:
    "The Cauvery's Wayanad-fed southern arm: impounded at the Kabini dam, joined by the Nugu and Gundal, and carrying a CPCB polluted stretch below Nanjangud's industrial belt before meeting the Cauvery at T. Narasipura. Tap a station for its flow and quality record.",
  mapCenter: [12.05, 76.35],
  mapZoom: 10,
  areaKm2: 4883,
  areaNote:
    "Karnataka portion of the Kabini sub-basin (C2), per Karnataka WRD's basin decomposition (KWRIS). The headwaters rise in Wayanad, Kerala - that reach is not yet mapped here.",
  // Open the DEP view on Mysuru by default (54.6% of the district is in-basin
  // and it carries the Kabini-side ULB cards).
  defaultGapUnit: "mysuru",
  rivers: [
    {
      riverId: "kabini",
      displayName: "Kabini",
      displayNameLocal: "ಕಬಿನಿ",
      subHydroshedIds: ["C2"],
      color: "#2563eb",
      narrative:
        "Rises in the Wayanad hills of Kerala, enters Karnataka at the Kabini reservoir (Beechanahalli), and flows past Nanjangud to join the Cauvery at T. Narasipura. The reach below Nanjangud is a CPCB-identified polluted stretch; its restoration accountability is tracked on the Cauvery overview's Kabini matrix.",
      attributes: {
        origin: "Wayanad hills, Kerala (Pakramthalam range)",
        flowsInto: "Cauvery at T. Narasipura (Triveni Sangama)",
        pollutedStretch: "Kabini (Kapila) below Nanjangud - CPCB Priority IV",
        restorationInitiatives:
          "KSPCB action plan under NGT OA 673/2018; tracked stretch-wise until the Sep 2025 MPR, after which PRS-wise reporting stopped",
      },
    },
  ],
  layers: [
    // ── Floor 1: Hydrology ──
    { family: "boundary", label: "Basin boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "rivers", label: "Kabini & main tributaries", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },

    // ── Floor 2: Monitoring - the station-readings pilot ──
    { family: "flow-stations", label: "CWC flow gauges (tap for readings)", floor: "monitoring", geom: "point", color: "#0d9488", defaultOn: true, readings: true },
    { family: "monitoring-points", label: "NWMP water-quality stations", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },

    // ── Floor 3: Pressures ──
    { family: "pressures-industrial", label: "KIADB industrial areas", floor: "pressures", geom: "fill", color: "#dc2626", defaultOn: true, hasKinds: true, kindFilter: "industrial-area" },
    { family: "pressures-industrial", label: "KIADB industrial area points", floor: "pressures", geom: "point", color: "#9d174d", defaultOn: true, kindFilter: "industrial-area-point" },
    { family: "pressures-quarries", label: "Quarries (OSM-mapped)", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: false, hasKinds: true },
    { family: "forests", label: "Notified forests", floor: "pressures", geom: "fill", color: "#16a34a", defaultOn: false },
    { family: "protected-areas", label: "Protected areas (Nagarahole & Bandipur fringes)", floor: "pressures", geom: "fill", color: "#15803d", defaultOn: false },

    // ── Floor 4: Governance & infrastructure ──
    { family: "gaps", label: "District Environment Plan (DEP) Snapshot", floor: "governance", geom: "fill", color: "#dc2626", defaultOn: true, gap: true },
    { family: "infrastructure", label: "Dams & reservoirs", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true },
    { family: "command-areas", label: "Irrigation command areas", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false },
  ],
  collaboration: {
    label: "Developed in collaboration with",
    name: "Paani Earth Foundation",
    logo: "/partners/paani-earth-foundation.png",
    url: "https://paani.earth",
    sub: "Cauvery basin spatial data and review",
  },
  credits: [
    "Basin boundary and stream segments: Karnataka WRD basin decomposition (KWRIS), sub-basin C2, carried over from the Cauvery (Karnataka) atlas ingest.",
    "Industrial areas (KIADB), notified forests and protected areas: Karnataka GIS (KGIS), via Paani Earth Foundation's Cauvery basin GIS package (Aug 2026), filtered to the Kabini boundary.",
    "Quarries: digitised from OpenStreetMap (© OpenStreetMap contributors, ODbL), via Paani Earth's Cauvery package.",
    "Irrigation command areas: India-WRIS, via Paani Earth's Cauvery package.",
    "Dams: CWC dam register, via Paani Earth's Cauvery package.",
    "CWC flow gauges + readings: India-WRIS Dataset API (CWC hydrological observations). Discharge is published in arrears; the telemetric level feed has been frozen at the source since 04 Jun 2026.",
    "NWMP water-quality stations: CPCB NWMP station registry (WRIS), via Paani Earth's Cauvery package.",
  ],
};

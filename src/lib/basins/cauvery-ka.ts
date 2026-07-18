import type { BasinManifest } from "./types";

// Cauvery Basin (Karnataka) - the first OVERVIEW-mode basin: the hierarchy
// level above the deep-dive atlas (docs/specs/cauvery-basin-hierarchy.md).
// Data ingested from the KWRIS open GeoServer via
// scripts/ingest_basin_overview.py + scripts/basin-sources/cauvery-ka.json.
//
// Scope is the Karnataka portion of the Cauvery, on Karnataka WRD's own
// basin decomposition (9 sub-basins). The Tamil Nadu reach and the delta are
// outside this atlas - stated on the surface, never implied away.
//
// Depth ladder: Arkavati (C5) is the L4 north star - the level of depth every
// sub-basin is measured against. Each unlock names the work that raises a
// sub-basin's level; the ladder is public UI, not internal roadmap.
export const CAUVERY_KA: BasinManifest = {
  basinId: "cauvery-ka",
  // Reached through the hierarchy (Arkavati's "part of" link, embeds, demos) -
  // not attached to a city page.
  cityIds: [],
  overviewMode: "sub-basins",
  displayName: "Cauvery Basin (Karnataka)",
  displayNameLocal: "ಕಾವೇರಿ ಜಲಾನಯನ (ಕರ್ನಾಟಕ)",
  blurb:
    "Karnataka's share of the Cauvery: 34,899 sq km across nine sub-basins, from the Kodagu headwaters to the Tamil Nadu border below Kanakapura. Bengaluru draws its river water from here (KRS, Hemavathi, Kabini, Harangi) and returns its wastewater here (the Arkavathi). Tap a sub-basin to see its state; the Arkavathi carries the full deep dive.",
  mapCenter: [12.6, 76.6],
  mapZoom: 8,
  areaKm2: 34899,
  areaNote:
    "Karnataka portion only, per Karnataka WRD's basin decomposition (KWRIS). The Cauvery continues into Tamil Nadu; that reach and the delta are outside this atlas.",
  rivers: [],
  layers: [
    // Overview mode renders its own surface (M2); these declarations drive
    // data fetching + the DataOnThisMap inventory with the existing plumbing.
    { family: "boundary", label: "Basin boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-basins", label: "Sub-basins", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "streams", label: "Streams (CWC-attributed)", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    { family: "tanks", label: "MI tanks (named)", floor: "hydrology", geom: "point", color: "#0284c7", defaultOn: false },
    { family: "reservoirs", label: "Reservoirs", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true },
    { family: "prs-stretches", label: "Polluted stretches (CPCB)", floor: "monitoring", geom: "line", color: "#b91c1c", defaultOn: false },
    { family: "wq-stations", label: "Water-quality stations (KSPCB)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: false },
  ],
  subBasins: [
    {
      key: "C1",
      name: "Upper Cauvery",
      scoreboardKey: "24",
      areaKm2: 10974,
      depthLevel: 2,
      blurb: "The headwaters and the big reservoirs - Harangi, Hemavathi and KRS. Where Bengaluru's river water actually comes from.",
      unlocks: [
        "Not yet mapped here: industries, quarries and waste sites along the reach",
        "Restoration accountability (plans vs progress reports) not yet compiled for this reach",
      ],
    },
    {
      key: "C2",
      name: "Kabini",
      scoreboardKey: "25",
      areaKm2: 4883,
      depthLevel: 2,
      blurb: "The Wayanad-fed southern arm, impounded at Kabini dam; carries a CPCB polluted stretch below Nanjangud.",
      unlocks: [
        "Not yet mapped here: the Nanjangud industrial belt's pressures (industries, waste sites)",
        "Restoration accountability for this stretch is tracked below; independent lab evidence not yet available",
      ],
    },
    {
      key: "C3",
      name: "Suvarnavati",
      scoreboardKey: "230",
      areaKm2: 1303,
      depthLevel: 2,
      unlocks: [
        "Not yet mapped here: industries, quarries and waste sites",
      ],
    },
    {
      key: "C4",
      name: "Shimsha",
      scoreboardKey: "231",
      areaKm2: 8733,
      depthLevel: 2,
      blurb: "The basin's largest tank country (222 MI tanks) and a CPCB Priority-IV polluted stretch.",
      unlocks: [
        "Not yet mapped here: pressures on the tank cascades (industries, quarries, waste sites)",
        "Restoration accountability for this stretch is tracked below; independent lab evidence not yet available",
      ],
    },
    {
      key: "C5",
      // Display spelling follows the accountability documents we cite
      // (CPCB, KSPCB, NMCG, Paani Earth: "Arkavathi"). KWRIS's sub-basin
      // register spells it "Arkavati" - that stays verbatim as the ingest
      // join key only.
      name: "Arkavathi",
      nameLocal: "ಅರ್ಕಾವತಿ",
      scoreboardKey: "232",
      areaKm2: 4158,
      deepDiveBasinId: "arkavathi",
      depthLevel: 4,
      blurb: "Bengaluru's river, and the most fully mapped part of this atlas: water quality, independent lab evidence, industrial pressures, governance and restoration tracking - built with Paani Earth Foundation.",
    },
    {
      key: "C6",
      name: "Middle Cauvery",
      scoreboardKey: "233",
      areaKm2: 2637,
      depthLevel: 2,
      blurb: "The mainstem reach around Srirangapatna and Ranganathittu, between the KRS and the Arkavathi confluence.",
      unlocks: ["Not yet mapped here: pressures along the Srirangapatna reach"],
    },
    {
      key: "C7",
      name: "Palar",
      scoreboardKey: "234",
      areaKm2: 2045,
      depthLevel: 1,
      unlocks: [
        "No KSPCB water-quality station is reported in this sub-basin - a gap in the state monitoring network itself",
      ],
    },
    {
      key: "C8",
      name: "Chinnar",
      scoreboardKey: "235",
      areaKm2: 17,
      depthLevel: 0,
      blurb: "A 17 sq km sliver at the state border.",
      unlocks: ["Karnataka's water portal publishes no metrics for this sliver"],
    },
    {
      key: "C9",
      name: "Bhavani",
      scoreboardKey: "236",
      areaKm2: 240,
      depthLevel: 1,
      unlocks: [
        "No KSPCB water-quality station is reported in this sub-basin",
      ],
    },
  ],
  credits: [
    "Boundaries, sub-basins, tanks, stations, reservoirs, streams: KWRIS / ACIWRM open GeoServer (water.karnataka.gov.in), Karnataka Water Resources Department.",
    "Sub-basin rainfall deviation and groundwater level: KWRIS geomGIS sub-basin views (KSNDMC/IMD basis; period under verification).",
    "Polluted river stretches: CPCB classification as published on KWRIS (earlier vintage; the Arkavathi is Priority I in CPCB's October 2025 report, mirrored on this site).",
    "Live reservoir storage: KWRIS reservoir_landing daily feed.",
  ],
};

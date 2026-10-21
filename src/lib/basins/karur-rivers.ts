import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Karur district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/karur-rivers/, built by scripts/build_karur_rivers_basin.py. The basin id is "karur-rivers";
// the district's own scope is "tn-karur". Scaffolded by scripts/new_district_basin.py: each TODO is research.
export const KARUR_RIVERS: BasinManifest = {
  basinId: "karur-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Karur district: rivers, groundwater and industry",
  displayNameLocal: "கரூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb: "TODO: the district in one map, from the first build's numbers (see krishnagiri-rivers.ts).",
  mapCenter: [10.84, 78.13],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 2896,
  areaNote: "Computed from the TNGIS district boundary. The catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  // TODO: a card per river in the config's RIVER_NAMES. The catchments its subHydroshedIds can name, sq km in the district: SB113 Amaravathi 1,428;
  // SB128 Pungar (upper Coleroon) 1,122; SB126 Noyel 213; SB119 Ponnaniyar 130.
  rivers: [],
  layers: [
    // Structural context
    ...districtFrame("Karur", TN_WRD_CATCHMENTS, "Rivers"),
    CWC_CANALS,
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a storage reading from the state dashboard", "Reservoir with no public reading"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow and water quality (CWC gauge)", "CWC gauge: river flow and water quality (tap for charts)"),
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    // TODO: keep the red sectors the first build finds (the inventory's industries kinds).
    tnpcbIndustries(
      [
        { value: "red-textile", label: "Red: textile processing (bleaching, dyeing, printing)", color: "#be123c" },
        { value: "red-stone", label: "Red: stone, granite and M-sand (cutting, polishing, crushing)", color: "#9f1239" },
        { value: "red-engineering", label: "Red: engineering, fabrication and metal (furnaces, forging, casting)", color: "#881337" },
        { value: "red-metal-treatment", label: "Red: metal surface treatment (pickling, plating, anodising)", color: "#e11d48" },
      ],
      "Orange category",
    ),
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    // TODO: keep the kinds the first build finds (the inventory's treatment-plants kinds).
    treatmentPlants([
      { value: "cetp", label: "Common effluent treatment plant", color: "#7e22ce" },
      { value: "stp", label: "Sewage treatment plant", color: "#4f46e5" },
      { value: "tsdf", label: "Common hazardous-waste treatment, storage and disposal facility (TSDF)", color: "#6b21a8" },
    ]),
    cwcCommandAreas([]), // TODO: one row per command-areas kind the first build writes
    ...TN_ADMIN,
  ],
  credits: ["TODO: one line per source, with the first build's counts (see krishnagiri-rivers.ts)."],
};

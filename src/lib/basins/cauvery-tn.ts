import type { BasinManifest } from "./types";

// Cauvery Basin (Tamil Nadu) - the second overview-mode basin, and the proof
// that the hierarchy is portable: same output contract, same component, a new
// adapter config (docs/specs/cauvery-basin-hierarchy.md §6, Appendix B).
// Data from the TNGIS open GeoServer via scripts/basin-sources/cauvery-tn.json.
//
// Scope is the Tamil Nadu portion of the Cauvery on TN WRD's own decomposition
// (18 sub-basins, ~47,500 sq km, incl. the Delta). Karnataka's reach lives in
// cauvery-ka; the two link to each other below - the interstate roll-up
// composes state segments, it never pretends one seamless dataset.
//
// Depth: sub-basins are L1 (hydrology scoped: named tanks + channels);
// 123 and 129 are L2 - CPCB stretch findings plus full restoration
// accountability matrices (accountability-123/129.json, reconstructed from
// TNPCB action plans, stretch WQ series and NGT case records);
// plus CPCB's October 2025 polluted-stretch findings placed at CPCB's own
// monitoring locations (scripts/build_basin_prs_points.py - TNGIS streams
// carry no river names, so stretch lines cannot be drawn honestly yet).
// TNWRIS/TNPCB station-level data remains the named unlock.
export const CAUVERY_TN: BasinManifest = {
  basinId: "cauvery-tn",
  cityIds: [],
  overviewMode: "sub-basins",
  parentBasinId: undefined,
  displayName: "Cauvery Basin (Tamil Nadu)",
  displayNameLocal: "காவிரி படுகை (தமிழ்நாடு)",
  blurb:
    "Tamil Nadu's share of the Cauvery: ~47,500 sq km across eighteen sub-basins, from the Nilgiris and the Mettur reservoir to the Delta. This side of the basin is newly mapped: named tanks and river channels from Tamil Nadu's own open GIS, with CPCB's October 2025 polluted-stretch findings placed on the sub-basins they touch. Station-level water-quality layers are not on this atlas yet.",
  mapCenter: [11.15, 78.3],
  mapZoom: 8,
  areaKm2: 47477,
  areaNote:
    "Tamil Nadu portion only, per TN WRD's sub-basin decomposition (TNGIS). The Karnataka reach is its own atlas - linked below; the Cauvery water-sharing story spans both.",
  relatedBasins: [
    { basinId: "cauvery-ka", label: "Karnataka side of the Cauvery" },
  ],
  rivers: [],
  layers: [
    { family: "sub-basins", label: "Sub-basins", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "streams", label: "River channels (TNGIS)", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    { family: "tanks", label: "Named tanks", floor: "hydrology", geom: "point", color: "#0284c7", defaultOn: false },
    { family: "prs-stretches", label: "Polluted stretches (CPCB, Oct 2025)", floor: "monitoring", geom: "point", color: "#b91c1c", defaultOn: true },
    { family: "reservoirs", label: "Reservoirs (TN WRD register)", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true },
  ],
  subBasins: [
    { key: "115", name: "Chinnar", scoreboardKey: "115", areaKm2: 1750, depthLevel: 1, blurb: "The TN side of the border sliver Karnataka maps as its C8.", unlocks: ["No TN water-quality or monitoring layers ingested yet - TNWRIS / TNPCB recon pending"] },
    { key: "117", name: "Dodda Halla", scoreboardKey: "117", areaKm2: 836, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "123", name: "Mettur Reservoir to Noyyal confluence", scoreboardKey: "123", areaKm2: 5405, depthLevel: 2, blurb: "The mainstem reach below Mettur (Stanley Reservoir) - the state's water-sharing barometer. Carries the start of the CPCB Priority-II mainstem stretch (Erode to Pichavaram) and the Priority-I Sarabanga location at Edapadi. The Sarabanga's restoration accountability is tracked below: none of the 2019 action plan's four committed works has a public completion record.", unlocks: ["Live Mettur storage feed not yet wired (tnsmart)", "TNPCB's stretch-wise water-quality series stops at December 2023 - later readings exist only in CPCB's October 2025 annexures"] },
    { key: "127", name: "Palar Dodda Halla", scoreboardKey: "127", areaKm2: 1293, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "124", name: "Moyar", scoreboardKey: "124", areaKm2: 2067, depthLevel: 1, blurb: "Nilgiris slopes and the Moyar gorge, upstream of Bhavanisagar.", unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "114", name: "Upper Bhavani", scoreboardKey: "114", areaKm2: 1807, depthLevel: 1, blurb: "Holds CPCB's Bhavani polluted location at Sirumugai (Priority V) - Sirumugai falls in this polygon on TN WRD's own decomposition.", unlocks: ["Station-level water-quality readings (TNPCB) not yet ingested"] },
    { key: "120", name: "Lower Bhavani", scoreboardKey: "120", areaKm2: 2403, depthLevel: 1, blurb: "Bhavanisagar to the Cauvery confluence at Bhavani. CPCB's Bhavani polluted location (Sirumugai) sits just upstream in the Upper Bhavani sub-basin.", unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "126", name: "Noyyal", scoreboardKey: "126", areaKm2: 3536, depthLevel: 1, blurb: "Coimbatore and Tiruppur's river, long synonymous with dyeing-industry pollution - yet the Noyyal does not appear anywhere in CPCB's October 2025 assessment, which covered 13 TN rivers. That absence is itself a monitoring question.", unlocks: ["The Noyyal is not in CPCB's 2025 NWMP assessment - TNPCB's own Noyyal record is the obvious next rung"] },
    { key: "113", name: "Amaravathi", scoreboardKey: "113", areaKm2: 9254, depthLevel: 1, blurb: "The basin's largest TN sub-basin, from the Anaimalais through Karur - and its densest dam country: 10 WRD reservoirs including the Amaravathi dam itself.", unlocks: ["The Amaravathi is absent from CPCB's October 2025 assessment; CPCB names only the 9 non-complying rivers of 13 monitored in TN, so whether the Amaravathi is monitored at all is not public", "Station-level water-quality readings (TNPCB) not yet ingested"] },
    { key: "112", name: "Ayiaar", scoreboardKey: "112", areaKm2: 1327, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "125", name: "Nandiyar - Kulaiyar", scoreboardKey: "125", areaKm2: 1532, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "128", name: "Pungar (upper Coleroon)", scoreboardKey: "128", areaKm2: 1309, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "119", name: "Ponnaniyar", scoreboardKey: "119", areaKm2: 1799, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "129", name: "Tirumanimuttar", scoreboardKey: "129", areaKm2: 2477, depthLevel: 2, blurb: "Salem and Namakkal's drain to the Cauvery, carrying CPCB's Priority-I Thirumanimutharu location at Salem. Restoration accountability is tracked below: Salem's 98 MLD of STP capacity was built years before the 2019 plan, and the sewer network to feed it was still incomplete in July 2026.", unlocks: ["TNPCB's stretch-wise water-quality series stops at December 2023 - later readings exist only in CPCB's October 2025 annexures and NGT records"] },
    { key: "118", name: "Karaipottanar", scoreboardKey: "118", areaKm2: 1001, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "122", name: "Marudaiyar", scoreboardKey: "122", areaKm2: 877, depthLevel: 1, unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "121", name: "Lower Coleroon", scoreboardKey: "121", areaKm2: 1501, depthLevel: 1, blurb: "The flood carrier past Srirangam to the sea.", unlocks: ["No TN water-quality or monitoring layers ingested yet"] },
    { key: "116", name: "Cauvery Delta", scoreboardKey: "116", areaKm2: 7303, depthLevel: 1, blurb: "The rice bowl - Thanjavur, Tiruvarur, Nagapattinam - where the river becomes a thousand channels.", unlocks: ["No TN water-quality or monitoring layers ingested yet", "Delta canal network and irrigation status are their own future story"] },
  ],
  credits: [
    "Sub-basins, tanks and river channels: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency / Survey & Settlement.",
    "Named tanks shown as centre points: 2,527 named tanks within the TN Cauvery; the wider register maps ~42,000 waterspreads, most unnamed.",
    "Polluted stretches: CPCB, Polluted River Stretches in India, October 2025 (mirrored on this site) - placed at CPCB's monitoring locations; TNGIS channels carry no river names, so stretch lines are not drawn.",
    "Reservoirs: TN WRD reservoir register via TNGIS (25 within the basin, shown at waterspread centre points) - no live storage feed joined yet.",
    "No station-level water-quality or accountability layers are on this atlas yet - TNWRIS / TNPCB sources are the next step and the gaps are stated per sub-basin.",
  ],
};

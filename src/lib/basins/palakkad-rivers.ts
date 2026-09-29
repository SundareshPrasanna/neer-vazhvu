import type { BasinManifest } from "./types";

// Palakkad district's rivers, reservoirs, wetlands and groundwater: the first
// Kerala district map, on the Erode pattern. The district (the union of its
// local bodies in KSREC's layer) is the frame; the river basins of KSREC's
// watershed atlas, cut to it, are the catchments a river selection scopes to.
// Data under public/data/basins/palakkad-rivers/, built by
// scripts/build_palakkad_rivers_basin.py (config for the district basin engine).
//
// The basin id is "palakkad-rivers"; the district's own scope is "kl-palakkad".
// No named industrial register is public for Kerala, so the pressures floor
// carries quarries only and the credits say so.
export const PALAKKAD_RIVERS: BasinManifest = {
  basinId: "palakkad-rivers",
  cityIds: [],
  displayName: "Palakkad district: rivers, reservoirs, wetlands and groundwater",
  displayNameLocal: "പാലക്കാട് ജില്ല: നദികൾ, അണക്കെട്ടുകൾ, തണ്ണീർത്തടങ്ങൾ, ഭൂഗർഭജലം",
  blurb:
    "Palakkad district in one map: the Bharathapuzha and its tributaries, the Bhavani through Attappadi, eight reservoirs read from the Kerala SDMA dam bulletin since 2020, 142 monitored wells, nine river water-quality stations KSPCB samples every month, KSREC's wetland, paddy and flood-extent layers, and the district's 88 Grama Panchayats in 13 development blocks. On 29 September 2026 Walayar held 3% of its live capacity, Meenkara 10% and Chulliyar 0%, against Malampuzha's 49%. KSREC classes 4,037 ha of the district's paddy parcels of 1 ha and more as 'Reclaimed' and 3,363 ha as 'Fallow'. Click a river to scope every layer to its basin.",
  mapCenter: [10.8, 76.55],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 4476,
  areaNote: "Computed from the union of the district's local-body boundaries in KSREC's layer. The catchments are the river basins of KSREC's watershed atlas cut to that boundary; each continues outside the district.",
  relatedBasins: [{ basinId: "erode-rivers", label: "Erode district, where the Bhavani runs next" }],
  rivers: [
    {
      riverId: "bharathapuzha",
      displayName: "Bharathapuzha",
      displayNameLocal: "ഭാരതപ്പുഴ",
      subHydroshedIds: ["RB20"],
      color: "#1e3a8a",
      narrative:
        "Its basin covers 3,179 sq km of the district, 71% of it (KSREC watershed atlas). Seven of the eight reservoirs the Kerala SDMA bulletin reads here are in it: Malampuzha, Walayar, Meenkara, Chulliyar, Pothundy, Mangalam and Kanjirappuzha. CWC gauges its flow at Mankara and Pudur (records from 1985) and Kumbidi (from 1979).",
      attributes: { length: "107 km inside or along the district (OpenStreetMap mapped course)." },
    },
    {
      riverId: "gayathri",
      displayName: "Gayathripuzha",
      displayNameLocal: "ഗായത്രിപ്പുഴ",
      subHydroshedIds: ["RB20"],
      color: "#2563eb",
      narrative: "A Bharathapuzha tributary; selecting it scopes the map to the Bharathapuzha basin. CWC's Gayathri project (Meenkara and Chulliyar dams) maps a command area of 11,583 ha in the district.",
      attributes: { length: "58 km inside the district (OpenStreetMap mapped course)." },
    },
    {
      riverId: "kannadipuzha",
      displayName: "Kannadipuzha",
      displayNameLocal: "കണ്ണാടിപ്പുഴ",
      subHydroshedIds: ["RB20"],
      color: "#0e7490",
      narrative: "A Bharathapuzha tributary; selecting it scopes the map to the Bharathapuzha basin.",
      attributes: { length: "26 km as OpenStreetMap names it; other reaches may be mapped under another name." },
    },
    {
      riverId: "kunthipuzha",
      displayName: "Kunthipuzha",
      displayNameLocal: "കുന്തിപ്പുഴ",
      subHydroshedIds: ["RB20"],
      color: "#0d9488",
      narrative: "A Bharathapuzha tributary; CWC gauges its flow at Pulamanthole, with a record from 1986.",
      attributes: { length: "99 km inside or along the district (OpenStreetMap mapped course)." },
    },
    {
      riverId: "bhavani",
      displayName: "Bhavani",
      displayNameLocal: "ഭവാനി",
      subHydroshedIds: ["RB22"],
      color: "#7c3aed",
      narrative:
        "Its basin covers 605 sq km of the district, 14% of it, through Attappadi. The Siruvani reservoir, which the Kerala SDMA bulletin prints as 'Inter state waters', is in this basin. Downstream the Bhavani crosses Erode district; see the Erode map.",
      attributes: { length: "69 km inside or along the district (OpenStreetMap mapped course)." },
    },
    {
      riverId: "parambikulam",
      displayName: "Parambikulam",
      displayNameLocal: "പറമ്പിക്കുളം",
      subHydroshedIds: ["RB16"],
      color: "#d97706",
      narrative:
        "In the Chalakudy basin, which covers 439 sq km of the district. The Parambikulam, Thunakkadavu and Peruvaripallam dams here are not in the Kerala SDMA irrigation bulletin, so the map carries no reading for them.",
      attributes: { length: "28 km inside the district (OpenStreetMap mapped course)." },
    },
  ],
  layers: [
    // Structural context
    { family: "boundary", label: "Palakkad district boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "River basins (KSREC watershed atlas)", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "rivers", label: "Rivers", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    {
      family: "canals", label: "Canal network (CWC)", floor: "hydrology", geom: "line", color: "#0891b2", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "main", label: "Main and branch canals", color: "#0e7490" },
          { value: "distributary", label: "Distributaries", color: "#06b6d4" },
          { value: "minor", label: "Minors and sub-minors", color: "#67e8f9" },
        ],
      },
    },
    { family: "reservoirs", label: "Reservoirs (Kerala SDMA dam bulletin)", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true, readings: true,
      legendRows: [
        { sym: "dot", color: "#0891b2", label: "Reservoir with a level and storage chart (tap)" },
        { sym: "ring", color: "#0891b2", label: "Reservoir not in the Kerala bulletin (no reading)" },
      ] },
    {
      family: "wetlands", label: "Wetlands (KSREC)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true, heavy: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "Tanks/Ponds", label: "Tanks and ponds", color: "#0284c7" },
          { value: "River/Stream", label: "Rivers and streams", color: "#1d4ed8" },
          { value: "Reservoir", label: "Reservoirs", color: "#0e7490" },
          { value: "Waterlogged", label: "Waterlogged", color: "#0d9488" },
          { value: "Mangroves", label: "Mangroves", color: "#15803d" },
        ],
      },
    },
    {
      family: "paddy", label: "Paddy wetlands by status (KSREC)", floor: "hydrology", geom: "fill", color: "#65a30d", defaultOn: false, heavy: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "Paddy", label: "Paddy", color: "#65a30d" },
          { value: "Fallow", label: "Fallow", color: "#ca8a04" },
          { value: "Reclaimed", label: "Reclaimed", color: "#b91c1c" },
          { value: "Waterlogged", label: "Waterlogged", color: "#0d9488" },
          { value: "Puncha", label: "Puncha", color: "#4d7c0f" },
          { value: "Minor", label: "Minor", color: "#a3a3a3" },
        ],
      },
    },
    { family: "watersheds", label: "Watersheds (KSREC watershed atlas)", floor: "hydrology", geom: "fill", color: "#4f46e5", defaultOn: false, outline: true, heavy: true },

    // Monitoring & evidence
    { family: "gauging-stations", label: "River flow (CWC gauges)", floor: "monitoring", geom: "point", color: "#0f766e", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#0f766e", label: "CWC gauge: river flow (tap for charts)" }] },
    { family: "monitoring-points", label: "River water quality (KSPCB monthly samples)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#059669", label: "KSPCB water-quality station (tap for charts)" }] },
    {
      family: "groundwater-wells", label: "Groundwater wells (depth to water)", floor: "monitoring", geom: "point", color: "#0369a1", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "state-manual", label: "Kerala Ground Water Department wells, read monthly, 2000 to April 2026", color: "#0369a1" },
          { value: "state-telemetry", label: "Kerala Ground Water Department telemetry, readings to September 2026", color: "#0e7490" },
          { value: "cgwb-telemetry", label: "CGWB telemetry, readings to June 2026", color: "#64748b" },
        ],
      },
    },

    // Hazards and pressures
    {
      family: "flood-zones", label: "Flood extent by return period (KSREC)", floor: "pressures", geom: "fill", color: "#1d4ed8", defaultOn: false, heavy: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "10-year", label: "10-year flood", color: "#1e3a8a" },
          { value: "25-year", label: "25-year flood", color: "#1d4ed8", defaultOff: true },
          { value: "50-year", label: "50-year flood", color: "#2563eb", defaultOff: true },
          { value: "100-year", label: "100-year flood", color: "#3b82f6" },
          { value: "200-year", label: "200-year flood", color: "#60a5fa", defaultOff: true },
          { value: "500-year", label: "500-year flood", color: "#93c5fd", defaultOff: true },
        ],
      },
    },
    { family: "quarries", label: "Quarries (OpenStreetMap, via KSREC)", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: false },

    // Governance: irrigation commands and the admin layers
    {
      family: "command-areas", label: "Canal command areas (CWC)", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false, outline: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "malampuzha", label: "Malampuzha", color: "#15803d" },
          { value: "chitturpuzha", label: "Chitturpuzha", color: "#65a30d" },
          { value: "kanhirapuzha", label: "Kanhirapuzha", color: "#4d7c0f" },
          { value: "gayathri-stage-i-meenakara-dam-stage-ii-chulliyra-dam", label: "Gayathri (Meenkara and Chulliyar dams)", color: "#0d9488" },
          { value: "pothundi", label: "Pothundi", color: "#0891b2" },
          { value: "mangalam", label: "Mangalam", color: "#7c3aed" },
          { value: "walayar", label: "Walayar", color: "#1e3a8a" },
        ],
      },
    },
    { family: "admin-block", label: "Development blocks", floor: "governance", geom: "fill", color: "#1b9e77", defaultOn: false },
    { family: "admin-gp", label: "Grama Panchayats", floor: "governance", geom: "fill", color: "#66a61e", defaultOn: false },
    { family: "admin-ulb", label: "Municipalities", floor: "governance", geom: "fill", color: "#7570b3", defaultOn: false },
  ],
  credits: [
    "District frame, river basins, watersheds, wetlands, paddy, flood extents, quarries and the Grama Panchayat, block and municipality boundaries: KSREC GeoServer (ksrec.in), Kerala State Remote Sensing and Environment Centre. KSREC states no licence; its layers are shown with attribution. The district is the union of its local bodies' boundaries; development blocks are the union of their Grama Panchayats; municipalities are not part of any block.",
    "River basins are those of KSREC's Kerala watershed atlas, whose watershed codes open with the basin number, cut to the district: Bharathapuzha (3,179 sq km in the district), Bhavani (605), Chalakudy (439), Kadalundi (122) and Kanjiramukku (70); slivers of the Chaliyar, Keecheri and Karuvannur basins under 5 sq km are left out.",
    "Wetlands: KSREC's wetland layer without its paddy class, parts under 0.1 ha left out. Paddy: KSREC's paddy layer, by the status KSREC records for each parcel as printed (Paddy, Fallow, Reclaimed, Waterlogged, Puncha, Minor); parcels under 1 ha left out, so the areas stated are for parcels of 1 ha and more.",
    "Flood extents: KSREC's flood layer by local body; its 'Year' field carries 10, 25, 50, 100, 200 and 500, the return periods of the Kerala SDMA flood-hazard maps.",
    "Quarries: OpenStreetMap contributors (ODbL), as KSREC's quarry layer carries them; not a lease register.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km; a river's mapped length is where OpenStreetMap names it.",
    "Reservoirs: Kerala State Disaster Management Authority daily irrigation-reservoir bulletins, the first bulletin of each month from August 2020 and the latest, read against each reservoir's full reservoir level as the bulletins print it. Positions are OpenStreetMap dam features. Moolathara regulator is in the bulletin but has no mapped position yet and is not drawn.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC).",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Kerala: Kerala Ground Water Department wells read monthly (2000 to April 2026) and telemetry, and CGWB telemetry (2026). Depth is in metres below ground level; stuck sensors, sentinel values and readings outside a physical envelope are dropped.",
    "River flow at Kumbidi, Mankara, Pudur and Pulamanthole: Central Water Commission manual daily discharge, from the National Water Data Portal, shown as monthly means. CWC's Kottathara gauge in Attappadi is not drawn: the portal does not print its river and its position is 3.2 km from the mapped Bhavani.",
    "River water quality: Kerala State Pollution Control Board's monthly NWMP data (kspcb.kerala.gov.in/nwmp), read from its monthly PDF reports from August 2025: the nine monthly river stations the reports place in Palakkad, at the positions the March 2026 report prints. A sample below the laboratory's detection limit is plotted at the limit. The criterion lines are CPCB's outdoor bathing criteria, drawn for reference; each station's use class, as KSPCB assigns it, heads its chart panel. KSPCB's state programme (SWMP) samples ten more sites in the district but prints no coordinates for them, so they are not drawn yet.",
    "No known public source gives a named register of Kerala's industrial units with their pollution category; the pressures floor carries quarries and flood extents only.",
  ],
};

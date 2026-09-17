import type { BasinManifest } from "./types";

// Erode district's rivers, canals, groundwater and industry - a district-scoped
// Basin Atlas instance on the Chennai-rivers / Mumbai-rivers pattern. The
// district boundary is the frame; TN WRD's sub-basins, clipped to it, are the
// catchments a river selection scopes to. Data under
// public/data/basins/erode-rivers/, built by scripts/build_erode_rivers_basin.py.
//
// The basin id is "erode-rivers", not "erode": the NVDM scope registry already
// holds "tn-erode" as the district scope, and this is a basin-kind scope. It
// has no city, so it is reached from the district Atlas page
// (src/lib/atlas/registry.ts) and lives at /embed/basins/erode-rivers.
//
// Industry, wells, groundwater category, canals, command areas and treatment
// plants are classed layers: one toggle each, coloured by `kind`, with legend
// chips the reader switches on or off (some start off, e.g. orange and green units).
const CPCB_CAUVERY =
  "CPCB, October 2025: Priority II from Erode (near Virapalayam) to Pichavaram; maximum BOD 24 mg/l on the 2022-23 classification basis. Station 1320 at Erode read 3.2 mg/l in 2024. The 2018 list carried Mettur to Mayiladuthurai as Priority I.";

export const ERODE_RIVERS: BasinManifest = {
  basinId: "erode-rivers",
  cityIds: [],
  displayName: "Erode district: rivers, groundwater and industry",
  displayNameLocal: "ஈரோடு மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Erode district in one map: the Cauvery, Bhavani, Noyyal and Moyar, the two canals that carry their water across the district, the six reservoirs in or on the edge of it, groundwater extraction by taluk, and the industrial units on Tamil Nadu's own register. Nambiyur and Perundurai taluks extract more groundwater than is recharged (171% and 104%, 2024-2025). The register places 333 red-category textile processing units and 26 tanneries in the district, most of them in Erode and Perundurai taluks. CPCB's October 2025 list starts the polluted stretch of the Cauvery at Erode. Click a river to scope every layer to its catchment.",
  mapCenter: [11.45, 77.4],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 5756,
  areaNote: "Computed from the TNGIS district boundary. The six catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB123", "SB127"],
      color: "#1e3a8a", // never red: red is the polluted stretch drawn on this same line
      narrative:
        "The Cauvery is the district's eastern line: about 97 km of its mapped course runs along or inside the boundary, 3.6 km of it above the Mettur reservoir and 93 km below it. TNPCB's 2023 stations on this reach read class B at worst at Komarapalayam and Pallipalayam and class A all year at Seerampalayam; the series stops at December 2023. The register places 658 industrial units in its two catchments here, more than half of the district's 1,255.",
      attributes: {
        origin: "Talakaveri, on the Brahmagiri range of the Western Ghats in Karnataka (CWC). It enters Erode district at Ammapettai, Bhavani taluk (TNPCB Bhavani action plan, p.8).",
        length: "97 km along or inside the district (OSM mapped course). Whole river: about 800 km (CWC); TNPCB's action plan gives about 760 km (p.73) and about 765 km (p.138).",
        tributaries: "In Erode district the Bhavani joins it; the Noyyal and the Amaravathi join in Karur district (TNPCB Cauvery action plan, pp.10-11).",
        flowsInto: "Bay of Bengal at Poombuhar (TNPCB Cauvery action plan, p.11)",
        pollutedStretch: CPCB_CAUVERY,
        restorationInitiatives:
          "Nadanthaai Vaazhi Cauvery (WRD), announced 20.07.2019: the National River Conservation Directorate has approved Rs.934.301 crore, shared 60:40, and the revised project report and the State's share are 'under consideration of the Government' (WRD policy note 2025-26, pp.87-89). Erode Corporation's underground sewerage scheme, Rs.209.22 crore with a 50.55 MLD plant (TNPCB Cauvery action plan, p.64), reported operational since September 2020.",
      },
    },
    {
      riverId: "bhavani",
      displayName: "Bhavani",
      displayNameLocal: "பவானி",
      subHydroshedIds: ["SB120", "SB114"],
      color: "#2563eb",
      narrative:
        "The Bhavani crosses the district for about 114 km, through the Bhavanisagar reservoir to the Cauvery at Bhavani town. TNPCB's three 2023 stations here (Bhavanisagar, Sathyamangalam, Bhavani town) read class A in every month reported; the series stops at December 2023. Its lower catchment is the largest in the district, 2,225 sq km, 39% of the district.",
      attributes: {
        origin: "The Western Ghats. TNPCB's action plan places the source in the Nilgiris district, the river then passing through Silent Valley (p.7); CGWB's Erode brochure gives the Silent Valley range of Kerala (p.5).",
        length: "114 km inside or along the district (OSM mapped course). TNPCB gives about 91 km in Erode district and 217 km in all (Bhavani action plan, p.7).",
        tributaries: "Moyar (CGWB Erode brochure, p.5); Siruvani and Kundah (Erode district website); Coonoor (TNPCB Bhavani action plan, p.7)",
        flowsInto: "Cauvery at Kooduthurai, Bhavani (TNPCB Bhavani action plan, p.7)",
        pollutedStretch:
          "CPCB, October 2025: Priority V at Sirumugai, upstream in Coimbatore district; maximum BOD 3.3 mg/l on the 2022-23 basis, 2.9 mg/l in 2024. No location inside Erode district is listed. TNPCB's 2019 action plan covered Sirumugai to Kalingarayan, 60 km, Priority IV (p.10).",
        restorationInitiatives:
          "TNPCB's 2019 action plan lists sewerage schemes for Erode Corporation (Rs.209.22 crore) and Sathyamangalam (Rs.54.26 crore) (pp.68-71). Bhavanisagar dam rehabilitation, Rs.19.89 crore, tenders called (WRD policy note 2025-26, p.72).",
      },
    },
    {
      riverId: "noyyal",
      displayName: "Noyyal",
      displayNameLocal: "நொய்யல்",
      subHydroshedIds: ["SB126"],
      color: "#d97706",
      narrative:
        "The Noyyal runs about 65 km along the district's southern edge to the Cauvery, past the Orathupalayam reservoir. It does not appear in CPCB's October 2025 assessment, which covered 13 Tamil Nadu rivers, and TNPCB's 2023 stretch series has no Noyyal station in this district. The register places 232 industrial units in this catchment.",
      attributes: {
        origin: "Vellingiri hills in the Western Ghats (TNPCB Cauvery action plan, p.138)",
        length: "65 km along or inside the district (OSM mapped course); 182.137 km in all (Cauvery River Atlas, prepared for the National River Conservation Directorate, p.65).",
        tributaries: "None is named in the WRD or TNPCB documents read. The Cauvery River Atlas's diagram of the main stem shows the Chinnar and the Nallar among the streams joining it (p.66).",
        flowsInto: "Cauvery at Noyyal village, Karur district (TNPCB Cauvery action plan, p.138)",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives:
          "Extension, Renovation and Modernisation of the Noyyal River System (WRD): G.O.(Ms) No.209 of 22.11.2019, Rs.230 crore of State funds in three packages; physical progress 100% and Rs.226.87 crore spent at 31.03.2023 (WRD presentation); recorded as completed (WRD policy note 2025-26, p.28).",
      },
    },
    {
      riverId: "moyar",
      displayName: "Moyar",
      displayNameLocal: "மோயார்",
      subHydroshedIds: ["SB124"],
      color: "#0d9488",
      narrative:
        "The Moyar runs about 47 km along the district's western edge into the Bhavanisagar reservoir. Inside the district this catchment has no TNPCB water-quality station and no unit on the industry register.",
      attributes: {
        origin: "The surplus of the Pykara reservoir flows north as the Pykara river and 'then flows towards east in the name of river Moyar' (TWAD Board, Nilgiris page).",
        length: "47 km along or inside the district (OSM mapped course). No known public government document states the river's whole length.",
        tributaries: "Sigur and Pykara are its major streams (CGWB Nilgiris brochure, p.5)",
        flowsInto: "The Bhavani: the Bhavanisagar dam is 'just below the confluence of River Moyar and River Bhavani' (WRD, Bhavani sub-basin page)",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Moyar in the WRD, TNPCB or district documents read.",
      },
    },
    {
      riverId: "lower-bhavani-project-canal",
      displayName: "Lower Bhavani Project Canal",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative:
        "The main canal from the Bhavanisagar reservoir: CWC's canal network maps 165 km of it inside the district, and 782 km of the whole Lower Bhavani network here once its 52 distributaries and 136 minors are counted. CWC maps 118,445 ha of its command area inside the district. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "Bhavanisagar dam (Erode District Statistical Handbook 2023-24, p.53)",
        length: "165 km of main canal inside the district (CWC canal network). WRD gives the canal as mile 0/0 to mile 124/2-560 (PWD policy note 2014-15, p.70).",
        tributaries: "Not applicable to a canal. Its ayacut is 2,07,000 acres (PWD policy note 2014-15, p.70); the modernisation scheme counts 2,47,247 acres benefited (WRD policy note 2025-26, p.30).",
        flowsInto: "Its last reach, mile 118/5 to 124/2-560, is in Kangayam taluk (WRD announcements 2022-23, p.3). No known public document states where it ends.",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches.",
        restorationInitiatives:
          "Modernisation of the Lower Bhavani Project system: G.O.(Ms) No.276 of 09.11.2020, Rs.933.10 crore in six packages (WRD policy note 2024-25, p.115); revised sanction of Rs.706.15 crore for Packages I to IV, and 95% complete (WRD policy note 2025-26, p.30).",
      },
    },
    {
      riverId: "kalingarayan-canal",
      displayName: "Kalingarayan Canal",
      subHydroshedIds: [],
      color: "#7c3aed",
      narrative:
        "CWC's canal network maps the channel for 91 km, from the Kalingarayan Anicut on the Bhavani to within a kilometre of the Cauvery near the Noyyal confluence, all of it inside the district and beside the Cauvery. The register places 18 of the district's 26 tanneries and 102 of its 333 red-category textile processing units within 2 km of it. TNPCB's two real-time stations on the canal, above and below Erode, sit on this line, and the Kona Vaikkal outfall named in the 2019 action plan enters it at Erode.",
      attributes: {
        origin: "Kalingarayan Anicut on the Bhavani (TNPCB Bhavani action plan, p.7; PWD policy note 2014-15, p.72)",
        length: "91 km, all inside the district (CWC canal network); 90 km in TNPCB's Bhavani action plan (p.7).",
        tributaries: "Not applicable to a canal. Its ayacut is about 15,750 acres (PWD policy note 2014-15, p.72).",
        flowsInto: "No known public government document states it. ICID's heritage listing, a non-government source, says it 'finally confluences in river Noyyal'.",
        pollutedStretch: "Not on CPCB's list, which covers river stretches. TNPCB's 2019 Cauvery action plan records untreated sewage entering the canal through Kona Vaikkal (pp.38, 50).",
        restorationInitiatives:
          "Rehabilitation by reach: mile 3/3 to 9/7, Rs.50 crore, completed, with retaining walls for pollution mitigation, and mile 0/0 to 3/3, Rs.41 crore (PWD policy note 2014-15, pp.71-72); the anicut, Rs.7.80 crore (2016-17, p.135); mile 9/7 to 12/5, Rs.36.75 crore (2017-18, p.133). Its package of the Lower Bhavani modernisation is recorded as completed (WRD policy note 2025-26, p.30).",
      },
    },
  ],
  layers: [
    // Structural context
    { family: "boundary", label: "Erode district boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "Sub-basin catchments (TN WRD)", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "rivers", label: "Rivers and canals", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    // The stretch renders while its panel is open ("Explore the polluted stretch") or when toggled on; clicking it opens prs.json.
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false, prs: true },
    { family: "prs-drains", label: "Sewage outfalls (TNPCB action plan, 2019)", floor: "hydrology", geom: "point", color: "#eab308", defaultOn: true },
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
    { family: "reservoirs", label: "Reservoirs (TN WRD register)", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true, readings: true,
      legendRows: [
        { sym: "dot", color: "#0891b2", label: "Reservoir with a CWC level chart (tap)" },
        { sym: "ring", color: "#0891b2", label: "Reservoir (no public level series)" },
      ] },
    { family: "waterbodies-major", label: "Tanks and water bodies (named or 5 ha and above)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
    { family: "waterbodies-minor", label: "Smaller water bodies and stream parcels", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
    { family: "tanks", label: "Named tanks (centre points)", floor: "hydrology", geom: "point", color: "#0284c7", defaultOn: false },
    { family: "watersheds", label: "Watersheds", floor: "hydrology", geom: "fill", color: "#4f46e5", defaultOn: false, outline: true },
    { family: "sub-watersheds", label: "Sub-watersheds", floor: "hydrology", geom: "fill", color: "#6366f1", defaultOn: false, outline: true },
    { family: "mini-watersheds", label: "Mini-watersheds", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: false, outline: true },
    { family: "micro-watersheds", label: "Micro-watersheds", floor: "hydrology", geom: "fill", color: "#a5b4fc", defaultOn: false, outline: true, heavy: true },

    // Monitoring & evidence
    { family: "gauging-stations", label: "River flow and water quality (CWC gauges)", floor: "monitoring", geom: "point", color: "#0f766e", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#0f766e", label: "CWC gauge: river flow and water quality (tap for charts)" }] },
    { family: "realtime-stations", label: "Real-time sensor stations (TNPCB)", floor: "monitoring", geom: "point", color: "#be185d", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#be185d", label: "TNPCB real-time sensor station (tap for charts)" }] },
    { family: "monitoring-points", label: "Water-quality stations (TNPCB, 2023)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },

    {
      family: "groundwater-wells", label: "Groundwater wells (depth to water)", floor: "monitoring", geom: "point", color: "#0369a1", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "cgwb-telemetry", label: "CGWB telemetry, readings to September 2026", color: "#0369a1" },
          { value: "state-telemetry", label: "Tamil Nadu state telemetry, readings to September 2026", color: "#0e7490" },
          { value: "cgwb-manual", label: "CGWB manual wells, readings 2021 to 2024", color: "#64748b", defaultOff: true },
        ],
      },
    },

    // Pressures: one register, one toggle per TNPCB category and sector
    {
      family: "industries", label: "Industrial units (TNPCB category and sector)", floor: "pressures", geom: "point", color: "#be123c", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "red-textile", label: "Red: textile processing", color: "#be123c" },
          { value: "red-tannery", label: "Red: tanneries", color: "#7c2d12" },
          { value: "red-paper", label: "Red: pulp and paper", color: "#a16207" },
          { value: "red-chemicals", label: "Red: basic chemicals", color: "#7e22ce" },
          { value: "red-other", label: "Red: other units", color: "#dc2626" },
          { value: "red-quarry-mining", label: "Red: quarries and mining", color: "#78716c", defaultOff: true },
          { value: "orange", label: "Orange category", color: "#f97316", defaultOff: true },
          { value: "green-white", label: "Green and white category", color: "#16a34a", defaultOff: true },
        ],
      },
    },
    { family: "industrial-estates", label: "SIPCOT Perundurai estates", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: false },
    { family: "cepi-area", label: "CEPI severely polluted area: outer frame (TNPCB plan, 2020)", floor: "pressures", geom: "fill", color: "#9f1239", defaultOn: false, outline: true },

    // Governance: groundwater category by taluk, treatment, admin
    {
      family: "groundwater-taluks", label: "Groundwater category by taluk (IN-GRES, 2024-2025)", floor: "governance", geom: "fill", color: "#f59e0b", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "over-exploited", label: "Over-exploited (extraction above 100% of recharge)", color: "#b91c1c" },
          { value: "critical", label: "Critical (90 to 100%)", color: "#ea580c" },
          { value: "semi-critical", label: "Semi-critical (70 to 90%)", color: "#f59e0b" },
          { value: "safe", label: "Safe (70% and below)", color: "#16a34a" },
        ],
      },
    },
    {
      family: "treatment-plants", label: "Treatment plants", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "cetp-operating", label: "Common effluent treatment plants: operating", color: "#7e22ce" },
          { value: "cetp-proposed", label: "Common effluent treatment plants: proposed, funding awaited", color: "#d8b4fe" },
          { value: "stp", label: "Sewage treatment plants", color: "#4f46e5" },
        ],
      },
    },
    {
      family: "command-areas", label: "Canal command areas (CWC)", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false, outline: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "lower-bhavani", label: "Lower Bhavani Project", color: "#15803d" },
          { value: "kodivery-anicut-system", label: "Kodivery anicut system (Thadappally and Arakkankottai)", color: "#65a30d" },
          { value: "kalingarayan-anicut-system", label: "Kalingarayan anicut system", color: "#7c3aed" },
          { value: "mettur-canal-system", label: "Mettur canal system", color: "#1e3a8a" },
        ],
      },
    },
    { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#7570b3", defaultOn: false },
    { family: "admin-block", label: "Blocks", floor: "governance", geom: "fill", color: "#1b9e77", defaultOn: false },
    { family: "admin-gp", label: "Village panchayats", floor: "governance", geom: "fill", color: "#66a61e", defaultOn: false, heavy: true },
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,683 outlines in the district. The register prints a class (Kuttai, Kulam, Odai, Stream) far more often than a name, so most outlines are unnamed; area is computed from each outline. Village panchayats cover 2,589 of the district's 5,756 sq km: town panchayats, municipalities, the corporation and reserve forest are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Cauvery, which is the district line, stays on the map.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC). Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure. Three unnamed lines CWC files under the Kalingarayan system lie east of the district and are left out.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code.",
    "SIPCOT estates: SIPCOT GIS (sipcotgis.tn.gov.in), industrial complex outlines for Perundurai DTA and SEZ.",
    "Treatment plants: positions from the industry register. Eight of the ten common effluent treatment plants on it are the companies formed for PROPOSED zero-liquid-discharge plants: their capacity, member units, cost and the 75% central and 25% State-or-units shares are as tabulated by the Tamil Nadu Department of Textiles (proposal of 13.03.2023). The two operating plants at Perundurai carry TNPCB's 2020 list figures.",
    "CEPI frame: a polygon through the eight reference points in Table 1.1 of TNPCB's 2020 CEPI action plan for the Erode cluster. It encloses 55.3 sq km against the plan's 45.25 sq km core zone, so it is an outer frame, not the boundary.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: CGWB and Tamil Nadu state telemetry stations (six-hourly, 2026) and CGWB manual quarterly readings (2021 to 2025). Depth is in metres below ground level; each well shows its latest reading and date. Stations are placed by their coordinates, so wells the portal tags as Erode but which lie outside the present district are left out.",
    "Reservoir levels (Bhavanisagar and Mettur): Central Water Commission daily 08:00 levels, from the National Water Data Portal, shown as monthly means in metres above sea level.",
    "River flow and water quality at the four gauges on the district line (Kodumudi and Urachikottai on the Cauvery, Savandapur on the Bhavani, Elunuthimangalam on the Noyyal): Central Water Commission, from the National Water Data Portal (NWIC). Flow is CWC's manual daily discharge, shown as monthly means; water quality is the annual mean of CWC's samples. At Kodumudi the portal prints five months of 2019 and 2020 in cusecs; those months are left out, not converted.",
    "Real-time sensor stations: TNPCB's real-time water quality monitoring dashboard, two stations on the Kalingarayan canal and one on the Noyyal below the Orathupalayam dam, as monthly means. These are sensor readings, not laboratory results.",
    "Water-quality stations: TNPCB stretch-wise monthly reports, January to December 2023, the last year published. Classes are the worst monthly use-based class of 2023. Station points are town centres; no official coordinates are published.",
    "Polluted stretch: CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version), drawn on the mapped course of the Cauvery inside the district. The five outfalls and the stretch panel come from TNPCB's 2019 action plan for the Cauvery, the state's monthly progress reports to NMCG and the Municipal Administration and Water Supply Department's policy notes, each cited by page.",
    "No known public source gives Erode a district environment plan, industrial water intake, or online effluent monitoring readings.",
  ],
};

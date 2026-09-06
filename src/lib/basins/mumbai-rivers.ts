import type { BasinManifest } from "./types";

// Mumbai's rivers and lakes - a city-scoped Basin Atlas instance on the
// Chennai-rivers pattern: the four rivers of Salsette island that drain the
// city (Mithi, Dahisar, Poisar, Oshiwara) and the seven lakes 30-130 km
// outside it that supply it. Data under public/data/basins/mumbai-rivers/,
// built by scripts/build_mumbai_rivers_basin.py from artifacts the city
// dashboard already carries plus a FABDEM catchment derivation
// (scripts/derive_mumbai_subbasins_fabdem.py). Gap panel content in gaps.json.
//
// The basin id is "mumbai-rivers", not "mumbai": the NVDM scope registry
// already holds "mumbai" as the MMR region scope, and one id cannot be two
// scope kinds. The embed lives at /embed/basins/mumbai-rivers.
//
// City rivers carry a FABDEM-derived shed each, so clicking one scopes every
// floor to its catchment. The supply rivers (Vaitarna, Bhatsa, Tansa) carry
// their dam catchments as sheds. The Ulhas is drawn for context (the eastern
// corridor's river, outside Greater Mumbai) with no shed of its own.
export const MUMBAI_RIVERS: BasinManifest = {
  basinId: "mumbai-rivers",
  cityIds: ["mumbai"],
  displayName: "Mumbai's rivers and lakes",
  displayNameLocal: "मुंबईच्या नद्या आणि तलाव",
  blurb:
    "Mumbai's water in one map: the four rivers of Salsette island that drain the city (the Mithi, Dahisar, Poisar and Oshiwara) and the seven lakes 30 to 130 km outside it that supply it (Bhatsa, Upper and Middle Vaitarna, Modak Sagar, Tansa, Vihar and Tulsi). CPCB's October 2025 assessment puts the Mithi at Mahim at a maximum BOD of 210 mg/l, the highest of any polluted river stretch in India; the other three city rivers are not monitored as rivers at all. Click a river to open its treatment-and-waste gap view.",
  mapCenter: [19.1, 72.9],
  mapZoom: 11,
  // Open on the whole system - city boundary plus the river and supply-lake
  // catchments - not on Greater Mumbai alone: the lakes are the point.
  defaultFitFamilies: ["boundary", "sub-hydrosheds"],
  // Open the gap view on the Mithi by default - the best-evidenced river - so
  // the right-hand panel is populated, not blank (the Chennai/Cooum pattern).
  defaultGapUnit: "mithi",
  rivers: [
    {
      riverId: "mithi",
      displayName: "Mithi",
      displayNameLocal: "मिठी नदी",
      subHydroshedIds: ["MITHI"],
      color: "#dc2626",
      narrative:
        "Mumbai's principal river rises from the Vihar and Powai lake overflows in the Sanjay Gandhi National Park and runs about 18 km south-west through Saki Naka, Kurla, Dharavi and Mahim to the Arabian Sea at Mahim Creek. Walled and channelised along most of its length, it carries largely untreated sewage and industrial effluent, and it was the river that overflowed in the 26 July 2005 deluge. In CPCB's October 2025 assessment the Mithi at Mahim records a maximum BOD of 210 mg/l, the worst of every polluted river stretch in India; MPCB's own annual averages at the same station rose from 45 mg/l in 2018-19 to 53 in 2023-24.",
      attributes: {
        origin: "Vihar and Powai lake overflows, Sanjay Gandhi National Park",
        length: "18 km (OSM mapped course; MPCB gives 17.84 km)",
        flowsInto: "Mahim Creek, Arabian Sea",
        pollutedStretch:
          "CPCB, October 2025: Priority I at station 2168 (near the road bridge, Mahim), maximum BOD 210 mg/l in 2022-23 and 80 mg/l in 2024. The 2018 list gave the stretch as Powai to Dharavi, also Priority I.",
        restorationInitiatives:
          "Mithi River Development and Protection Authority (2005): widening 94% and retaining walls 95% complete at 30 April 2025 (BMC ESR 2024-25). Powai Lake restoration, Rs 66 crore (2025): an 8 MLD STP not to be commissioned before 11 December 2027 (NGT OA 150/2025).",
      },
    },
    {
      riverId: "dahisar",
      displayName: "Dahisar",
      displayNameLocal: "दहिसर नदी",
      subHydroshedIds: ["DAHISAR"],
      color: "#d97706",
      narrative:
        "Rises from Tulsi Lake in the Sanjay Gandhi National Park and flows about 12 km west through Dahisar to the Manori Creek. Through built-up Dahisar it is a sewage-fed channel. It does not appear in CPCB's October 2025 national list of polluted stretches, and MPCB reports no water-quality station on it: absence from the list is absence from monitoring, not evidence of clean water.",
      attributes: {
        origin: "Tulsi Lake, Sanjay Gandhi National Park",
        length: "15 km (OSM mapped course; MPCB gives 12 km)",
        flowsInto: "Manori Creek (Gorai)",
        pollutedStretch: "Not in CPCB's October 2025 national list; no MPCB or CPCB station on the river.",
      },
    },
    {
      riverId: "poisar",
      displayName: "Poisar",
      displayNameLocal: "पोयसर नदी",
      subHydroshedIds: ["POISAR"],
      color: "#7c3aed",
      narrative:
        "Originates in the Sanjay Gandhi National Park and runs about 7 km through Kandivali to the Marve Creek, largely as a storm-water and sewage channel through the built-up suburb. The 6 MLD Charkop plant near Marve Creek is the only treatment works in its catchment. Not in CPCB's October 2025 list and not monitored as a river.",
      attributes: {
        origin: "Sanjay Gandhi National Park",
        length: "6 km (OSM mapped course; MPCB gives 7 km)",
        flowsInto: "Marve Creek",
        pollutedStretch: "Not in CPCB's October 2025 national list; no MPCB or CPCB station on the river.",
      },
    },
    {
      riverId: "oshiwara",
      displayName: "Oshiwara",
      displayNameLocal: "ओशिवरा नदी",
      subHydroshedIds: ["OSHIWARA"],
      color: "#0891b2",
      narrative:
        "Rises near the Aarey Milk Colony and the Sanjay Gandhi National Park and flows through Goregaon and Jogeshwari to the Malad Creek, heavily encroached and sewage-fed through its urban course. Malad Creek also takes the outflow of the Malad (280 MLD) and Versova (180 MLD) sewage plants; Malad's 2023 outlet BOD of 140.6 mg/l against an inlet of 144.2 means the plant barely treats. Not in CPCB's October 2025 list and not monitored as a river.",
      attributes: {
        origin: "Aarey Milk Colony and the Sanjay Gandhi National Park",
        length: "15 km (OSM mapped course; MPCB gives 7 km)",
        flowsInto: "Malad Creek",
        pollutedStretch: "Not in CPCB's October 2025 national list; no MPCB or CPCB station on the river.",
      },
    },
    {
      riverId: "vaitarna",
      displayName: "Vaitarna",
      displayNameLocal: "वैतरणा नदी",
      subHydroshedIds: ["VAITARNA"],
      color: "#2563eb",
      narrative:
        "The Vaitarna system carries three of Mumbai's seven lakes: Upper Vaitarna (331 Mcum live capacity), Middle Vaitarna (194 Mcum, Mumbai's newest source, 2014) and Modak Sagar, the Lower Vaitarna (129 Mcum). The dams sit 100 km and more north-east of the city in Palghar and Nashik districts; water reaches Bhandup by gravity. Below the dams CPCB lists the river at Priority V, the least severe class, at one location near the Gandhare road bridge in Wada.",
      attributes: {
        origin: "Western Ghats, Trimbakeshwar (Nashik)",
        length: "154 km (OSM mapped course within the region)",
        flowsInto: "Arabian Sea at Datiwara Creek (Palghar)",
        pollutedStretch: "CPCB, October 2025: Priority V at one location, near the road bridge at Gandhare (Wada, Palghar); maximum BOD 4 mg/l in 2022-23 and 2024.",
      },
    },
    {
      riverId: "bhatsa",
      displayName: "Bhatsa",
      displayNameLocal: "भातसा नदी",
      subHydroshedIds: ["BHATSA"],
      color: "#2563eb",
      narrative:
        "Bhatsa dam at Shahapur in Thane district is Mumbai's largest single source, about 48 percent of the city's supply. The dam's live capacity on the state's books is 942 Mcum; BMC's share is about 717 Mcum, the rest going to Thane's own scheme and to irrigation, which is why the scoreboard's percentages must be read against the share and not the dam. Below the dam CPCB lists the river from Satnel to the Pise dam at Priority V.",
      attributes: {
        origin: "Western Ghats above Shahapur (Thane)",
        length: "53 km (OSM mapped course)",
        flowsInto: "Ulhas River above Bhiwandi",
        pollutedStretch: "CPCB, October 2025: Priority V from Satnel (Shahapur) to downstream of the Pise dam; maximum BOD 5 mg/l in 2022-23, 3 to 3.8 mg/l at the three stations in 2024.",
      },
    },
    {
      riverId: "tansa",
      displayName: "Tansa",
      displayNameLocal: "तानसा नदी",
      subHydroshedIds: ["TANSA"],
      color: "#2563eb",
      narrative:
        "Tansa Lake (1892) was Bombay's third source after Vihar and Tulsi and remains one of the seven, with 173 Mcum of live capacity on the state's books. The lake and its catchment sit inside the Tansa Wildlife Sanctuary in Thane and Palghar; the proposed Gargai dam, Mumbai's eighth source, would submerge about 2,100 acres of the same sanctuary. Below the lake CPCB lists the river at Priority V at one location near Dakewali in Wada.",
      attributes: {
        origin: "Tansa Wildlife Sanctuary (Thane and Palghar)",
        length: "60 km (OSM mapped course)",
        flowsInto: "Vaitarna River",
        pollutedStretch: "CPCB, October 2025: Priority V at one location, near the road bridge at Dakewali (Wada, Palghar); maximum BOD 4 mg/l in 2022-23, 6 mg/l in 2024.",
      },
    },
    {
      riverId: "ulhas",
      displayName: "Ulhas",
      displayNameLocal: "उल्हास नदी",
      // The eastern corridor's river, outside Greater Mumbai: drawn for
      // context, with its CPCB stretch and stations, but no shed of its own.
      subHydroshedIds: [],
      color: "#0f766e",
      narrative:
        "The Ulhas drains the eastern corridor of the region, past Badlapur, Ulhasnagar and Kalyan to the creek at Thane, and supplies Thane, Kalyan and Navi Mumbai through the Barvi dam and MIDC, not BMC. CPCB lists it from the Badlapur water works to the NRC bund at Mohane as Priority V; its tributary the Kalu is Priority I at Atale (maximum BOD 42 mg/l), and the Waldhuni brings Ulhasnagar's industrial effluent.",
      attributes: {
        origin: "Western Ghats above Karjat (Raigad)",
        length: "146 km (OSM mapped course)",
        flowsInto: "Ulhas Creek, Thane",
        pollutedStretch: "CPCB, October 2025: Priority V from upstream of the Badlapur water works to upstream of the NRC bund, Mohane (Kalyan); maximum BOD 5 mg/l in 2022-23. The Kalu at Atale (Kalyan) is Priority I, maximum BOD 42 mg/l.",
      },
    },
    {
      riverId: "kalu",
      displayName: "Kalu",
      displayNameLocal: "काळू नदी",
      subHydroshedIds: [],
      color: "#0f766e",
      narrative:
        "The Kalu comes down from the Malshej ghat through Murbad to join the Ulhas near Kalyan, about 104 km on OSM's mapped course. CPCB's October 2025 list carries it at Priority I at one location, Atale village in Kalyan taluka (station 1092), with a maximum BOD of 42 mg/l in 2022-23 and 30 mg/l in 2024, the same class it held in 2018. Below Atale it meets the Ulhas, whose own stretch is Priority V.",
      attributes: {
        origin: "Malshej ghat, Western Ghats (Thane)",
        length: "104 km (OSM mapped course)",
        flowsInto: "Ulhas River near Kalyan",
        pollutedStretch: "CPCB, October 2025: Priority I at one location, Atale village (Kalyan, Thane), station 1092; maximum BOD 42 mg/l in 2022-23, 30 mg/l in 2024. Same class as in 2018 (along Atale village).",
      },
    },
    {
      riverId: "waldhuni",
      displayName: "Waldhuni",
      displayNameLocal: "वालधुनी नदी",
      subHydroshedIds: [],
      color: "#0f766e",
      narrative:
        "An 8 km tributary of the Ulhas through Ulhasnagar, and the channel that brings the town's industrial effluent into the river above Kalyan. MPCB's Kalyan regional office has treated it as the Ulhas corridor's polluted arm since its 2004-05 environment status report; it does not appear as its own entry in CPCB's October 2025 national list.",
      attributes: {
        origin: "Ambernath (Thane)",
        length: "8 km (OSM mapped course)",
        flowsInto: "Ulhas River at Ulhasnagar",
        pollutedStretch: "Not a separate entry in CPCB's October 2025 list; the Ulhas stretch it joins (Badlapur water works to the NRC bund) is Priority V.",
      },
    },
    {
      riverId: "surya",
      displayName: "Surya",
      displayNameLocal: "सूर्या नदी",
      subHydroshedIds: [],
      color: "#2563eb",
      narrative:
        "The western corridor's source river: the Dhamni dam (276 Mcum live capacity on the state's books) and the Kawdas weir below it supply Vasai-Virar and Mira-Bhayandar, not BMC. CPCB lists the river from the MIDC pumping station at Palghar to the Vasai-Virar intake at Priority IV, a class worse than in 2018.",
      attributes: {
        origin: "Western Ghats above Dhamni (Vikramgad, Palghar)",
        length: "85 km (OSM mapped course)",
        flowsInto: "Vaitarna estuary (Palghar)",
        pollutedStretch: "CPCB, October 2025: Priority IV from the MIDC pumping station (Palghar) to the Vasai-Virar water intake; maximum BOD 7 mg/l in 2022-23, 4 to 6 mg/l at the three stations in 2024; deteriorated from Priority V in 2018.",
      },
    },
  ],
  layers: [
    // Structural context
    { family: "boundary", label: "Greater Mumbai (BMC) boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "River catchments (FABDEM)", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "rivers", label: "Rivers", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },
    { family: "reservoirs", label: "The seven supply lakes", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true },
    { family: "reservoir-catchments", label: "Supply-lake catchments", floor: "hydrology", geom: "fill", color: "#2dd4bf", defaultOn: false },
    { family: "waterbodies-major", label: "Lakes & tanks (named / >= 5 ha)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
    { family: "waterbodies-minor", label: "Smaller water bodies", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
    { family: "waterbodies-lost", label: "Lost tanks (filled in)", floor: "hydrology", geom: "point", color: "#b45309", defaultOn: false },
    { family: "drainage", label: "Nullahs & drains (OSM)", floor: "hydrology", geom: "line", color: "#3b82f6", defaultOn: false, heavy: true },

    // Monitoring & evidence
    { family: "monitoring-points", label: "Water-quality stations (MPCB / CPCB)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true, readings: true },
    { family: "prs-stretches", label: "Polluted stretches (CPCB, Oct 2025)", floor: "monitoring", geom: "line", color: "#b91c1c", defaultOn: true },
    { family: "groundwater-wells", label: "CGWB groundwater wells", floor: "monitoring", geom: "point", color: "#0369a1", defaultOn: false },

    // Pressures
    { family: "industries", label: "Industrial areas (OSM)", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },
    { family: "flood-hotspots", label: "Flood spots (BMC register)", floor: "pressures", geom: "point", color: "#f59e0b", defaultOn: true },

    // Gaps & response (governance floor)
    { family: "gaps", label: "Treatment & waste gap (per river)", floor: "governance", geom: "fill", color: "#dc2626", defaultOn: true, gap: true },
    { family: "infrastructure", label: "Sewage treatment plants (BMC MSDP + MMR)", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true },
    { family: "admin-corporation", label: "Municipal corporations (MMR)", floor: "governance", geom: "fill", color: "#94a3b8", defaultOn: false, context: true },
  ],
  credits: [
    "Rivers, water bodies, drains, industrial areas and corporation boundaries: OpenStreetMap contributors (ODbL).",
    "River catchments and supply-lake catchments: derived on FABDEM v1-2 30 m (University of Bristol, CC BY-NC-SA 4.0; Copernicus GLO-30 attribution) with WhiteboxTools D8 routing - the same method as the region's lake-catchment atlas.",
    "Polluted river stretches and station BOD: CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version).",
    "Station readings: MPCB Water Quality Status of Maharashtra annual reports (2018-19 to 2023-24; 2019-20 never published) and the CPCB NWMP series as transcribed by Praja Foundation (2024, RTI).",
    "Sewage treatment plants: MPCB per-STP inventory; inlet and outlet BOD from Praja Foundation's Status of Civic Issues in Mumbai 2024 (RTI series); replacement-plant dates from BMC's Environment Status Report 2024-25.",
    "Supply lakes: live capacities from the Maharashtra WRD Pravah daily bulletin; BMC's share of each lake from BMC's published live-storage figures; live storage read at view time from the daily feed (Vihar and Tulsi have no public feed).",
    "Groundwater: CGWB Ground Water Year Book of Maharashtra, National Hydrograph Network wells.",
    "Flood spots: BMC Disaster Management flood-spot register (the officially mapped subset).",
    "Lost tanks: Sharada Dwivedi and Rahul Mehrotra, Bombay: The Cities Within (1995), with Sahapedia and Tindall (1982); positions are present-day locality sites.",
  ],
};

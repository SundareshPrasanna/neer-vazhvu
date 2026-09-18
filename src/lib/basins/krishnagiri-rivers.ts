import type { BasinManifest } from "./types";

// Krishnagiri district's rivers, groundwater and industry: Hosur's district on
// the Basin Atlas, a district-scoped instance on the Erode pattern. The
// district boundary is the frame; TN WRD's sub-basins, clipped to it, are the
// catchments a river selection scopes to. Data under
// public/data/basins/krishnagiri-rivers/, built by
// scripts/build_krishnagiri_rivers_basin.py through the shared engine.
//
// The district straddles two basins: the Thenpennai (Ponnaiyar) drains the
// Hosur, Krishnagiri and Bargur side east to the Bay of Bengal; the Chinnar and
// Dodda Halla drain the Anchetty and Denkanikottai side south to the Cauvery,
// which is the district's south-western line. The basin id is
// "krishnagiri-rivers", not "krishnagiri": the NVDM scope registry holds
// "tn-krishnagiri" as the district scope. It has no city, so it is reached
// from the district Atlas page and lives at /embed/basins/krishnagiri-rivers.
export const KRISHNAGIRI_RIVERS: BasinManifest = {
  basinId: "krishnagiri-rivers",
  cityIds: [],
  displayName: "Krishnagiri district: rivers, groundwater and industry",
  displayNameLocal: "கிருஷ்ணகிரி மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Krishnagiri district in one map: the Thenpennai as it enters Tamil Nadu from Bengaluru's side, its Markandeya and Pambar tributaries, the Chinnar and Dodda Halla that drain the other half of the district to the Cauvery, the six reservoirs on or inside the district line, groundwater extraction by taluk, and the 1,695 industrial units on Tamil Nadu's own register. Uthangarai, Bargur and Krishnagiri taluks extract more groundwater than is recharged (149%, 105% and 101%, 2024-2025) and Hosur taluk is at 90%. The register places 570 stone, granite and M-sand units and 199 quarrying units in the district, and 50 of its 71 red-category metal surface treatment units in Hosur taluk. CPCB's October 2025 list carries no stretch on the Thenpennai in Tamil Nadu, and lists the same river as Priority I on the Karnataka side, from Mugalur bridge to the Chokkarasanahalli bridge where it crosses into Hosur taluk; TNPCB's sensor below the Kelavarapalli dam, the first inside Tamil Nadu, read a monthly mean BOD of 26 mg/L in September 2026, against a bathing criterion of 3. Click a river to scope every layer to its catchment.",
  mapCenter: [12.52, 78.05],
  mapZoom: 10,
  defaultFocus: { center: [12.66, 77.9], zoom: 11 }, // open on Hosur and Shoolagiri; the rest of the district is a pan away
  defaultFitFamilies: ["boundary"],
  areaKm2: 5143,
  areaNote: "Computed from the TNGIS district boundary. The catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district, the Thenpennai's into Karnataka.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "thenpennai",
      displayName: "Thenpennai (Ponnaiyar)",
      displayNameLocal: "தென்பெண்ணை",
      subHydroshedIds: ["SBP16", "SBP17", "SBP18", "SBP01", "SBP02", "SBP04", "SBP07"], // its own reach plus the Shoolagiri Chinnar, Kambainallur and Matturar catchments, whose streams are not drawn
      color: "#1e3a8a",
      narrative:
        "The Thenpennai enters Tamil Nadu in Hosur taluk and is held twice inside the district: at Kelavarapalli, 10 km from Hosur, and 60 km downstream at the Krishnagiri Reservoir Project dam. About 172 km of its mapped course runs inside or along the district. Its catchments here cover 1,950 sq km and hold 1,069 of the district's 1,694 registered industrial units, including 64 of the 71 red-category metal surface treatment units and five of the eight SIPCOT outlines. CWC's Gummanur gauge has read its flow daily since September 1978. CPCB lists the river as a Priority I polluted stretch on the Karnataka side, ending at the bridge on the state line; TNPCB's sensor below the Kelavarapalli dam, the first inside Tamil Nadu, read a monthly mean BOD of 26.1 mg/L in September 2026.",
      attributes: {
        origin:
          "The south-eastern slopes of the Chennakesava Hills, north-west of Nandidurg in Karnataka (TN WRD, Krishnagiri dam page), at about 1,000 m above sea level (NGT joint committee report, O.A. 111/2020, p.13). It enters Tamil Nadu west of Bagalur (CGWB Krishnagiri brochure 2009, p.6), 'near Begalur village of Hosur Taluk' (WRD IAMWARM annexure, p.11).",
        length:
          "172 km inside or along the district (OSM mapped course). Whole river: 432 km, 112 km in Karnataka and 320 km in Tamil Nadu (TN WRD), of which 180 km lie in Dharmapuri and Krishnagiri districts (NGT joint committee report, p.13). The Census handbook prints 400 km (DCHB 2011, p.22).",
        tributaries:
          "WRD's IAMWARM annexure lists ten in all, among them Chinnar, Markandanadhi, Pambar and Vaniar (p.11); CGWB names 'Pambar and Burgur Ar.' as the important ones draining the district (2009 brochure, p.6). The Shoolagiri Chinnar, 14 km long from Berigai village, joins it below its dam (TN WRD, Shoolagiri Chinnar dam page).",
        flowsInto: "Bay of Bengal at Cuddalore (DCHB 2011, p.22).",
        pollutedStretch:
          "The listed stretch stops at the state line, not at the pollution. CPCB's October 2025 list carries no Tamil Nadu stretch on this river, but lists it under Karnataka as Priority I, the worst class: 'RIVER DAKSHINA PINAKINI/ THENPENNAIYAR FORM THENNPENNIYAR MUGALUR BRIDGE TO CHOKKARASANAHALLI BRIDGE' (p.14 of the printed report). Chokkarasanahalli bridge is where the river crosses into Hosur taluk. On the 2022-23 basis CPCB records a maximum BOD of 146 mg/L at Mugalur bridge in Bengaluru and 89 mg/L at the Chokkarasanahalli bridge station; its 2024 readings for the same two stations are 71 and 52.4 mg/L (Annexures III B and XIV). Downstream in Tamil Nadu, TNPCB's sensor below the Kelavarapalli dam read a monthly mean BOD of 26.1 mg/L in September 2026, against the 3 mg/L bathing criterion. The district's Environmental Plan (2019) records the river entering 'carrying sewage from Bangalore city', Tamil Nadu's suit O.S. No. 2/2015 against Karnataka pending in the Supreme Court, and monthly joint sampling by CPCB, KSPCB and TNPCB since September 2017 under the Court's order of 7.7.2017 (pp.18-19), with TNPCB sampling monthly at Sokkarasanapalli (p.20). NGT (Southern Zone) O.A. 111/2020 concerns 'Frothing of Chemical Foam in River Thenpennai'.",
        restorationInitiatives:
          "The Kelavarapalli reservoir supplies '6 M.G.D. (27.27MLD)' of drinking water to Hosur SIPCOT, Hosur town, Mathigiri and wayside villages (TN WRD). The Krishnagiri reservoir had lost 30.81% of its storage capacity to silt in 26 years (WRD IAMWARM annexure, p.13). No known public WRD or TNPCB document read so far records a restoration scheme for the river itself in the district.",
      },
    },
    {
      riverId: "markandeya",
      displayName: "Markandeya",
      displayNameLocal: "மார்க்கண்டேய நதி",
      subHydroshedIds: ["SBP03"],
      color: "#2563eb",
      narrative:
        "The Markandeya (Markandanadhi) drains 367 sq km of the district's east, between Krishnagiri town and the Pambar, to the Thenpennai. About 33 km of its course is mapped inside the district. Its catchment holds 48 registered units and the two Kurubarapalli SIPCOT complexes.",
      attributes: {
        origin: "No official source read states where the Markandeya rises. TN WRD lists the Markandanadhi sub-basin at 368.21 sq km, with the Nachikuppam Ar (Penniyar basin page).",
        length: "33 km of mapped course inside the district (OSM). No official length was found.",
        tributaries: "The Nachikuppam Ar shares its sub-basin (TN WRD, Penniyar basin page).",
        flowsInto: "The Thenpennai: 'Vanniyaar and Markanda rivers join South Pennar' (DCHB 2011, p.22).",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Markandeya in the WRD, TNPCB or district documents read.",
      },
    },
    {
      riverId: "pambar",
      displayName: "Pambar",
      displayNameLocal: "பாம்பாறு",
      subHydroshedIds: ["SBP05"],
      color: "#0891b2",
      narrative:
        "The Pambar's catchment is the district's largest single Thenpennai sub-basin at 903 sq km, taking in Bargur and Uthangarai taluks, both over-exploited for groundwater. About 24 km of its course is mapped inside the district, ending at the Pambar dam in Uthangarai taluk. The catchment holds 356 registered units, 212 of them in stone, granite and M-sand, 58 of the district's 195 quarry leases, and the Bargur SEZ outline.",
      attributes: {
        origin: "The Alangayam hills in Vellore district (TN WRD, Pambar dam page).",
        length: "24 km of mapped course inside the district (OSM). WRD gives the river 'about 44km' to its confluence (Pambar dam page).",
        tributaries: "'two tributaries such as Mathur river and Bargur river' (TN WRD, Pambar dam page); CGWB names the Burgur Ar among the district's important tributaries (2009 brochure, p.6).",
        flowsInto: "The Thenpennai 'near pavakkal village'; the Pambar dam stands 8 km above the confluence, with a catchment of 1,736 sq km (TN WRD, Pambar dam page).",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives:
          "The Pambar dam, commenced 1977 and completed 1983 (TN WRD), 16.5 m high and 652 m long (CWC National Register of Large Dams 2019, p.271), stores 280 million cubic feet against a command of 4,000 acres (Krishnagiri district website, agriculture page). No known public record of a river restoration scheme.",
      },
    },
    {
      riverId: "chinnar",
      displayName: "Chinnar",
      displayNameLocal: "சின்னாறு",
      subHydroshedIds: ["SB115"],
      color: "#d97706",
      narrative:
        "This Chinnar is the Cauvery's, not the Thenpennai's: it drains the Denkanikottai and Anchetty side of the district south to the Cauvery at Hogenakkal. Its sub-basin is the district's largest at 1,068 sq km inside the line, 1,750 sq km in all across Krishnagiri and Dharmapuri. About 29 km of the river is mapped inside the district; the Chinnar and Kesarigulihalla dams on the Dharmapuri side sit on the district's edge. The catchment holds 200 registered units and 35 quarry leases, and its taluks read safe for groundwater.",
      attributes: {
        origin: "'Thali Reserve Forest' (TN WRD, Chinnar reservoir page).",
        length: "29 km of mapped course inside the district (OSM). No official length was found. The sub-basin is 1,749.822 sq km across Dharmapuri and Krishnagiri (TN WRD, Cauvery basin page).",
        tributaries: "The Kesarigulihalla, 25 km long, joins it from the Halligothan range forest (TN WRD, Kesarigulihalla dam page).",
        flowsInto: "The Cauvery at Hogenakkal (TN WRD, Chinnar reservoir page).",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives:
          "The Chinnar dam near Panchapalli, Palacode taluk, built 1971 to 1976 (TN WRD; the CWC register prints 1977), 29 m high with a 613.82 sq km catchment, irrigates 4,500 acres in Dharmapuri district (TN WRD, Chinnar reservoir page; CWC National Register of Large Dams 2019, p.270). No known public record of a river restoration scheme.",
      },
    },
    {
      riverId: "dodda-halla",
      displayName: "Dodda Halla",
      subHydroshedIds: ["SB117"],
      color: "#b45309",
      narrative:
        "The Dodda Halla drains 836 sq km of the district's forested south-west, Anchetty taluk, to the Cauvery. Only 15 km of it is mapped (as 'Podda Halla' on OpenStreetMap), and its catchment holds 21 registered units, 19 of them quarrying, and no SIPCOT estate. Anchetty taluk extracts 35% of its groundwater recharge, the lowest in the district.",
      attributes: {
        origin: "No official source read states where the Dodda Halla rises. CGWB calls it 'the most important tributary of Cauvery draining the rugged terrain in the northwestern part of the district' (2009 brochure, p.5).",
        length: "15 km of mapped course inside the district (OSM). No official length was found. The sub-basin is 835.887 sq km, all in Krishnagiri (TN WRD, Cauvery basin page).",
        tributaries: "None named in the sources read.",
        flowsInto: "The Cauvery (CGWB Krishnagiri brochure 2009, p.5). No source read names the confluence point.",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Dodda Halla in the WRD, TNPCB or district documents read.",
      },
    },
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: [],
      color: "#0f766e",
      narrative:
        "The Cauvery is the district's south-western line for about 43 km of mapped course, from where it enters in Denkanikottai taluk to Hogenakkal. It has no catchment of its own inside the district: the Chinnar and Dodda Halla carry the district's water to it, so selecting it keeps every layer in view. TNPCB samples it monthly at Billikundu, on the district line, under the same Supreme Court order as the Thenpennai.",
      attributes: {
        origin: "Talakaveri, on the Brahmagiri range of the Western Ghats in Karnataka (CWC). 'Cauveri enters the district from southwest in Denkanikottai taluk' (DCHB 2011, p.22).",
        length: "43 km along the district line (OSM mapped course). Whole river: 320 km in Karnataka, 416 km in Tamil Nadu and 64 km as the common boundary (India-WRIS Cauvery basin report, p.20).",
        tributaries: "In this district the Chinnar and the Dodda Halla (TN WRD, Cauvery basin page; CGWB Krishnagiri brochure 2009, p.5).",
        flowsInto: "'It forms a waterfalls at Hokenakkal and joins at Mettur Dam' (DCHB 2011, p.22); Bay of Bengal at Poombuhar (TNPCB Cauvery action plan, p.11).",
        pollutedStretch:
          "CPCB's October 2025 list starts its Cauvery stretch at Erode, below Mettur; nothing on this reach is listed. The district's Environmental Plan (2019, pp.18-19) records the Cauvery entering 'carrying sewage from Bangalore city' through the Arkavathi, and monthly joint sampling at Billikundu since September 2017.",
        restorationInitiatives: "Nadanthaai Vaazhi Cauvery (WRD) covers the river's Tamil Nadu course below Mettur; no scheme specific to this reach was found in the documents read.",
      },
    },
  ],
  layers: [
    // Structural context
    { family: "boundary", label: "Krishnagiri district boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "Sub-basin catchments (TN WRD)", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
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
    { family: "reservoirs", label: "Reservoirs (TN WRD register)", floor: "hydrology", geom: "point", color: "#0891b2", defaultOn: true, readings: true,
      legendRows: [{ sym: "ring", color: "#0891b2", label: "Reservoir (no public level series: CWC reports none of these dams)" }] },
    { family: "waterbodies-major", label: "Tanks and water bodies (named or 5 ha and above)", floor: "hydrology", geom: "fill", color: "#0284c7", defaultOn: true },
    { family: "waterbodies-minor", label: "Smaller water bodies and stream parcels", floor: "hydrology", geom: "fill", color: "#0d9488", defaultOn: false, heavy: true },
    { family: "tanks", label: "Named tanks (centre points)", floor: "hydrology", geom: "point", color: "#0284c7", defaultOn: false },
    { family: "watersheds", label: "Watersheds", floor: "hydrology", geom: "fill", color: "#4f46e5", defaultOn: false, outline: true },
    { family: "sub-watersheds", label: "Sub-watersheds", floor: "hydrology", geom: "fill", color: "#6366f1", defaultOn: false, outline: true },
    { family: "mini-watersheds", label: "Mini-watersheds", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: false, outline: true },
    { family: "micro-watersheds", label: "Micro-watersheds", floor: "hydrology", geom: "fill", color: "#a5b4fc", defaultOn: false, outline: true, heavy: true },

    // Monitoring & evidence
    { family: "gauging-stations", label: "River flow and water quality (CWC gauge)", floor: "monitoring", geom: "point", color: "#0f766e", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#0f766e", label: "CWC gauge: river flow and water quality (tap for charts)" }] },
    { family: "realtime-stations", label: "Real-time sensor station (TNPCB)", floor: "monitoring", geom: "point", color: "#be185d", defaultOn: true, readings: true,
      legendRows: [{ sym: "dot", color: "#be185d", label: "TNPCB real-time sensor station (tap for charts)" }] },
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
          { value: "red-metal-treatment", label: "Red: metal surface treatment (pickling, plating)", color: "#be123c" },
          { value: "red-textile", label: "Red: textile processing", color: "#9f1239" },
          { value: "red-tannery", label: "Red: tanneries", color: "#7c2d12" },
          { value: "red-paper", label: "Red: pulp and paper", color: "#a16207" },
          { value: "red-chemicals", label: "Red: basic chemicals", color: "#7e22ce" },
          { value: "red-other", label: "Red: other units", color: "#dc2626" },
          { value: "red-quarry-mining", label: "Red: quarries and mining", color: "#78716c", defaultOff: true },
          { value: "orange", label: "Orange category (stone cutting, crushers, M-sand, engineering)", color: "#f97316", defaultOff: true },
          { value: "green-white", label: "Green and white category", color: "#16a34a", defaultOff: true },
        ],
      },
    },
    { family: "industrial-estates", label: "SIPCOT estates (Hosur, Shoolagiri, Bargur)", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

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
        rows: [{ value: "stp", label: "Sewage treatment plants", color: "#4f46e5" }],
      },
    },
    {
      family: "command-areas", label: "Canal command areas (CWC)", floor: "governance", geom: "fill", color: "#65a30d", defaultOn: false, outline: true,
      classes: {
        prop: "kind",
        rows: [
          { value: "krishnagiri", label: "Krishnagiri Reservoir Project (KRP) canals", color: "#15803d" },
          { value: "barur-tank", label: "Barur tank system", color: "#65a30d" },
        ],
      },
    },
    { family: "admin-taluk", label: "Taluks", floor: "governance", geom: "fill", color: "#7570b3", defaultOn: false },
    { family: "admin-block", label: "Blocks", floor: "governance", geom: "fill", color: "#1b9e77", defaultOn: false },
    { family: "admin-gp", label: "Village panchayats", floor: "governance", geom: "fill", color: "#66a61e", defaultOn: false, heavy: true },
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 3,665 outlines in the district with a geometry; here the register names 2,012 of the 2,115 larger ones. Area is computed from each outline. Named tanks are the 195 the all-tanks register names out of 1,619 tank outlines inside the district.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Cauvery, which is the district's south-western line, stays on the map. The Thenpennai is mapped under four names (Ponnaiyar, Thenpennai, Then Pennai, Dakshina Pinakini) and is folded into one course.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Krishnagiri Reservoir Project's right and left main canals and the Barur tank system. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units and the treatment plant: TNGIS industry register matched to land parcels. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code; the register spells Bargur taluk as Burgur.",
    "SIPCOT estates: SIPCOT GIS (sipcotgis.tn.gov.in), industrial complex outlines for Hosur phases I and II, the Shoolagiri Future Mobility and General Engineering parks, Bargur DTA and SEZ, and Kurubarapalli. The server also lists Hosur phase III, Shoolagiri Hosur phase IV and the Bargur complex but returns a database error for each (checked 18 September 2026), so those three are not drawn.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: CGWB and Tamil Nadu state telemetry stations (six-hourly, 2026) and CGWB manual quarterly readings (2021 to 2025). Depth is in metres below ground level; each well shows its latest reading and date. Stations are placed by their coordinates, so four wells the portal tags as Krishnagiri but which lie outside the district are left out.",
    "Reservoirs: TN WRD's register on TNGIS, six waterspreads on or inside the district line (Krishnagiri, Kelavarapalli, Pambar and Shoolagiri Chinnar in the district; Chinnar and Kesarigullihalla on the Dharmapuri side). CWC publishes no level series for any of them, so no reservoir carries a chart; the state's daily storage feed is a later addition.",
    "River flow and water quality at Gummanur on the Thenpennai: Central Water Commission, from the National Water Data Portal (NWIC). Flow is CWC's manual daily discharge from September 1978, shown as monthly means; water quality is the annual mean of CWC's samples, 1978 to 2024.",
    "Real-time sensor station: TNPCB's real-time water quality monitoring dashboard, one station on the Thenpennai below the Kelavarapalli dam, as monthly means from December 2025. These are sensor readings, not laboratory results.",
    "Polluted stretch: CPCB's October 2025 list carries no Thenpennai stretch in Tamil Nadu, so none is drawn. The same report lists the river under Karnataka as Priority I from Mugalur bridge to Chokkarasanahalli bridge, which is the crossing into Hosur taluk; that record, with CPCB's station readings, sits on the Thenpennai river card along with the district's Environmental Plan and the documents it cites.",
    "No known public source gives Krishnagiri industrial water intake or online effluent monitoring readings.",
  ],
};

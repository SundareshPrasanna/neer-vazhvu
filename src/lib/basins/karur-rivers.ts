import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Karur district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/karur-rivers/, built by scripts/build_karur_rivers_basin.py. The basin id is "karur-rivers";
// the district's own scope is "tn-karur". Scaffolded by scripts/new_district_basin.py.
export const KARUR_RIVERS: BasinManifest = {
  basinId: "karur-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Karur district: rivers, groundwater and industry",
  displayNameLocal: "கரூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Karur district in one map: the Cauvery on its northern edge, the Amaravathi that crosses the district to join it below Karur town, the Amaravathi's tributaries the Kudaganar and the Nanganji, the Noyyal on the north-western line, the New Kattalai High Level Canal that carries Cauvery water east from Mayanur, the two reservoirs inside the district, groundwater extraction by taluk, and the 749 industrial units on Tamil Nadu's own register. All seven taluks are critical or over-exploited for groundwater; Kadavur, Karur, Manmangalam and Pugalur extract more than is recharged (117.9%, 115.9%, 109.0% and 108.5%, 2024-2025). All 64 red-category textile processing units on the register lie in the Amaravathi's catchment, 44 of them within 2 km of the river. CPCB listed the Amaravathi along Karur as a polluted stretch in 2022 (Priority V); the state's June 2026 report records that CPCB has since delisted it. CPCB's October 2025 list carries the Cauvery from Erode to Pitchavaram, past the district, but names none of its polluted locations in Karur. Click a river to scope every layer to its catchment.",
  mapCenter: [10.84, 78.13],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 2896,
  areaNote:
    "Computed from the TNGIS district boundary (2,895.7 sq km); the collectorate gives 2,904 sq km (karur.nic.in, About District). The four catchments are TN WRD's sub-basins cut to that boundary, 2,893 sq km once three slivers under 3 sq km are dropped; each continues outside the district.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB128"],
      color: "#1e3a8a",
      narrative: "The Cauvery is Karur's northern edge: about 74 km of its mapped course runs along or inside the district line, most of it on the line itself. TNPCB counts 56.16 km in the district, from Kombupalayam, where it enters, to Sirugamani (TNPCB Cauvery action plan, 2019, p.137). That plan's findings record no direct outfall or industrial drain into this reach, the sewage of Kulithalai and Punjai Pugalur going into channels that lead to farmland (pp.139, 143); its action table adds that Kulithalai's sullage runs in three channels that join the river stretch (p.153). TNPCB's 2023 monthly sheets print class A for both Karur stations, Pugalur and Thirumukkudal, in every month, November without readings (TNPCB stretch-wise report 2023, pp.1-6). Two large units on the register lie near the river, EID Parry's sugar mill (2.1 km from its mapped course) and TNPL's paper mill (4.0 km), both in Punjai Pugalur; the 2019 plan records that the treated effluent of both is used for irrigation (p.149). Selecting it scopes the map to the Pungar (upper Coleroon) sub-basin, the district's north-east (1,122 sq km), which drains straight to it; the Amaravathi and Noyyal catchments have their own cards.",
      attributes: {
        origin: "Talakaveri, on the Brahmagiri range of the Western Ghats in Karnataka (CWC). In Karur district it 'enters at Kombupalayam Village' (TNPCB Cauvery action plan, p.137).",
        length: "74 km along or inside the district (OSM mapped course); TNPCB gives 56.16 km in the district (Cauvery action plan, p.137). Whole river: about 800 km (CWC).",
        tributaries: "In Karur district the Noyyal and the Amaravathi (TNPCB Cauvery action plan, p.137), and the Pungar, which joins it at Timmachalapuram (CGWB Karur brochure, 2008, p.6).",
        flowsInto: "Bay of Bengal at Poombuhar (TNPCB Cauvery action plan, p.11).",
        pollutedStretch: "CPCB, October 2025: Priority II, 'RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM', maximum BOD 24 mg/l observed in 2022 and 2023 (Annexure III A, p.91). The stretch runs past this district, but none of the seven polluted locations CPCB names on it is in Karur (Annexure II, p.76). CPCB's 2022 list carried the Cauvery as one Priority III entry, 'ALONG METTUR, ALONG ERODE, KATTIPALAYAM TO TRICHY, KUMBAKONAM TO PITCHAVARAM' (p.35), with maximum BOD of 4.2 mg/l at Pugalur, 4.0 at Thirumukkudal and 5.0 at Karur upstream on 2019 and 2021 data (p.61). The 2018 list carried Mettur to Mayiladuthurai as Priority I (p.6). The state's June 2026 report to NMCG gives the 2025 stretch as Mettur to Mayiladuthurai, 200 km, Priority II (p.6).",
        restorationInitiatives: "Nadanthaai Vaazhi Cauvery (WRD) aims 'to effectively curb sewage polluting the Cauvery River and its tributaries in Tamil Nadu' (WRD policy note 2025-26, p.87). In this district WRD is building a barrage across the Cauvery at Nanjai Pugalur, Pugalur taluk: Rs.406.50 crore, about 800 Mc.ft. of storage, 4,041 acres of ayacut and TNPL's water requirement, 76% complete (p.32). TNPCB's 2019 plan asked Kulithalai Municipality to provide a sewage treatment plant and Punjai Pugalur Town Panchayat a treatment system (p.159); the state's June 2026 report lists Kulithalai's 0.02 MLD faecal sludge plant in operation and its 3 MLD sewage plant 43% complete, due September 2026 (Tamil Nadu MPR, pp.23, 8).",
      },
    },
    {
      riverId: "amaravathi",
      displayName: "Amaravathi",
      displayNameLocal: "அமராவதி",
      subHydroshedIds: ["SB113"],
      color: "#2563eb",
      narrative: "The Amaravathi crosses the district through K.Paramathi, Aravakurichi, Thanthoni and Karur blocks to the Cauvery (CGWB Karur brochure, 2008, p.6): about 73 km of its mapped course runs inside or along the district, 39 km of it in Aravakurichi taluk. Its sub-basin is the district's largest catchment, 1,428 of 2,896 sq km, and holds 462 of the 749 registered industrial units, among them all 64 red-category textile processing units, 44 of them within 2 km of the river and 23 within 1 km. CWC's daily flow record at Nallamaranpatty, Aravakurichi taluk, begins in December 1977: 169 of the 541 months on record averaged no flow at all, as did every month read from January to June 2026. CWC's samples there averaged a BOD of 6.7 mg/l in 2023 (7 samples), against the bathing criterion of 3 mg/l.",
      attributes: {
        origin: "'the Munnar Hills in Kerala' (TN WRD, Amaravathy dam page). TNPCB places its start in the 'Manjampatti Valley between the Anamalai Hills and the Palani Hills' (Cauvery action plan, p.138).",
        length: "73 km inside or along the district (OSM mapped course). Whole river: 227 km (TN WRD, Amaravathy dam page); the Cauvery River Basin Atlas gives 195.132 km, measured from Amaravathinagar (NRCD, 2025, pp.52-53).",
        tributaries: "In Karur district the Kodavanar (mapped here as the Kudaganar), joining it at Karuvadampatti, and the Nanganji, joining it at Ariyur (CGWB Karur brochure, 2008, p.6). WRD's sub-basin list also names the Shanmugachittar and the Uppar among its streams (TN WRD, Cauvery basin page).",
        flowsInto: "The Cauvery, 'at Thirumukkudalur, about 10 km downstream side of Karur Town' (TNPCB Cauvery action plan, p.138); CGWB names the confluence Nerur (2008 brochure, p.6).",
        pollutedStretch: "CPCB's 2022 list carried the Amaravathi 'ALONG MADHUTHUKKULAM AND ALONG KARUR' as Priority V, maximum BOD 4.0 mg/l on 2019 and 2021 data (p.35), from two stations: 1 km below the effluent discharge point at Madathukulam (3.4 mg/l) and on the northern bank beside the municipal solid waste dump site, downstream of the dyeing cluster (4.0 mg/l) (p.60). The state's December 2023 report to NMCG recorded a maximum BOD of 2.7 mg/l on the river (p.3). Its June 2026 report states: 'Based on the water quality data for the year 2022-2023, CPCB has delisted Amaravathi and Palar River from the list of PRS' (p.6). Neither CPCB's 2018 list nor its October 2025 list carries an Amaravathi stretch in Tamil Nadu.",
        restorationInitiatives: "No restoration scheme specific to the Amaravathi in Karur was found in the WRD, TNPCB or district documents read. Karur's existing 15 MLD sewage treatment plant was using 5.90 MLD in June 2026, and a proposed 35.25 MLD plant for Karur stood at 'Retender on 24.08.2026' (Tamil Nadu MPR to NMCG, June 2026, pp.20, 32). The register places Karur Municipality's sewage treatment plant at Panchamadevi, Manmangalam taluk, 1.0 km from the river's mapped course; where it discharges is not stated in the documents read.",
      },
    },
    {
      riverId: "kudaganar",
      displayName: "Kudaganar",
      displayNameLocal: "குடகனாறு",
      subHydroshedIds: [],
      color: "#0d9488",
      narrative: "The Kudaganar, which CGWB and WRD's sub-basin list call the Kodavanar, rises in the Rangamalai hills on the Dindigul border and runs north to the Amaravathi (CGWB Karur brochure, 2008, p.6). About 27 km of its mapped course is inside the district, all of it in Aravakurichi taluk, which extracts 97.2% of its groundwater recharge (critical, 2024-2025). The Kodaganar reservoir's canals, which CWC records as serving Dindigul and Karur, run 33 km inside the district, and CWC maps 12,554 ha of that command area here. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'Originating in Rangamalai hills located in the boarder of Karur and Dindigul district' (CGWB Karur brochure, 2008, p.6).",
        length: "27 km inside the district (OSM mapped course). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Amaravathi 'at Karuvadampatti' (CGWB Karur brochure, 2008, p.6).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "The Kodaganar dam is among the 35 dams the Dam Safety Review Panel inspected (WRD policy note 2025-26, p.69). No known public record of a river restoration scheme in the documents read.",
      },
    },
    {
      riverId: "nanganji",
      displayName: "Nanganji",
      displayNameLocal: "நங்கஞ்சியாறு",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "The Nanganji rises in the Kottaivali hills in Dindigul district and flows north through Aravakurichi and K.Paramathi blocks to the Amaravathi (CGWB Karur brochure, 2008, p.6). About 24 km of its mapped course is inside the district, all of it in Aravakurichi taluk. Upstream in Dindigul district the Nanganjiyar dam, completed in 2007, holds it (Cauvery River Basin Atlas, p.22); CWC maps 18 km of the reservoir's canals and 1,928 ha of its command area inside Karur. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'the Kottaivali hills in Dindigul district' (CGWB Karur brochure, 2008, p.6).",
        length: "24 km inside the district (OSM mapped course). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Amaravathi 'at Ariyur' (CGWB Karur brochure, 2008, p.6).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "The Nanganjiar dam is among the 35 dams the Dam Safety Review Panel inspected (WRD policy note 2025-26, p.69). No known public record of a river restoration scheme in the documents read.",
      },
    },
    {
      riverId: "noyyal",
      displayName: "Noyyal",
      displayNameLocal: "நொய்யல்",
      subHydroshedIds: ["SB126"],
      color: "#d97706",
      narrative: "The Noyyal reaches the Cauvery along the district's north-western line: about 27 km of its mapped course runs along or inside the district, almost all of it on the line itself. TNPCB's 2019 Cauvery plan calls it 'the source of pollution in the River Cauvery in the Karur District', from dyeing and bleaching units in Tiruppur district (p.139), and records the TDS of its seepage water above the 500 mg/l drinking water standard (p.151). TNPCB's one-day sample on 2 January 2019 at Maravapalayam, on the Cauvery below the confluence (p.142), read BOD 6 mg/l and dissolved oxygen 4.2 mg/l, against bathing criteria of 3 mg/l or less and 5 mg/l or more (pp.140, 143). Its catchment here is small, 213 sq km, but holds 52 of the district's 172 quarry leases and 61 of its 194 red-category quarrying units. The Noyyal Athupalayam reservoir in Pugalur taluk read 0% of capacity on the state dashboard on 21 October 2026.",
      attributes: {
        origin: "'the Vellingiri hills in the Western Ghats' (TNPCB Cauvery action plan, p.138).",
        length: "27 km along or inside the district (OSM mapped course); 182.137 km in all (Cauvery River Basin Atlas, NRCD, 2025, p.65).",
        tributaries: "None is named in the WRD or TNPCB documents read. WRD's Noyel sub-basin lists streams including Sanganurpallam, Kodangipallam and Chinnakarainadhi (TN WRD, Cauvery basin page).",
        flowsInto: "The Cauvery 'at Noyyal, a village in Karur district named after the River itself' (TNPCB Cauvery action plan, p.138); the Cauvery River Basin Atlas gives the confluence as Avadaiyaparai (p.66).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. TNPCB's 2019 Cauvery plan treats it as the source of pollution in the Cauvery in Karur district (p.139).",
        restorationInitiatives: "Extension, Renovation and Modernisation of the Noyyal River System (WRD): G.O.(Ms) No.209 of 22.11.2019, Rs.230 crore of State funds in three packages, the third, LS 72 km to 158.35 km, reaching Pugalur taluk (WRD project slides, slides 2 and 4); recorded as completed (WRD policy note 2025-26, p.28). The 2019 plan asked that the zero liquid discharge systems of Tiruppur's dyeing units 'ensure 100% recycling' (TNPCB Cauvery action plan, p.151).",
      },
    },
    {
      riverId: "new-kattalai-canal",
      displayName: "New Kattalai High Level Canal",
      displayNameLocal: "புதிய கட்டளை உயர்மட்ட கால்வாய்",
      subHydroshedIds: [],
      color: "#7c3aed",
      narrative: "The New Kattalai High Level Canal leaves the Cauvery at the Kattalai barrage in Mayanur and runs east through Krishnarayapuram and Kulithalai taluks: CWC's canal network maps 57 km of it inside the district, 40 km of that in Kulithalai taluk. It is one of four canals the barrage regulates, with the Kattalai High Level, South Bank and North Bank canals, which together serve 1,01,312 acres (PWD policy note 2014-15, p.32). CWC maps 154 km of Kattalai-system canals and 14,543 ha of the Kattalai command area inside the district. Krishnarayapuram and Kulithalai taluks extract 99.1% and 90.9% of their groundwater recharge (critical, 2024-2025). It has no catchment of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Cauvery at Mayanur, Krishnarayapuram taluk: the Kattalai barrage, built 250 m below the Kattalai bed regulator for Rs.234 crore, regulates four off-take canals, the 'New Kattalai High Level canal' among them (PWD policy note 2014-15, pp.31-32).",
        length: "57 km inside the district (CWC canal network). No known public document read states its whole length.",
        tributaries: "Not applicable to a canal. The four canals regulated at the barrage serve 1,01,312 acres together (PWD policy note 2014-15, p.32); CWC gives the Kattalai project a culturable command area of 30.09 thousand ha, in Karur and Tiruchirappalli districts.",
        flowsInto: "No known public government document read states where it ends; CWC's line continues past the district's eastern line.",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches.",
        restorationInitiatives: "WRD's Extension, Renovation and Modernisation of the Kattalai High Level Canal irrigation system in Karur district, G.O. No. 207 of 22.11.2019, Rs.335.50 crore with NABARD funding, covering LS 0 km to LS 60 km (WRD project slides, slides 6 and 8), is recorded as completed (WRD policy note 2025-26, p.28); the slides do not say whether this canal was part of it. From the same barrage WRD is building the Cauvery-Vaigai-Gundar link: 4.10 km of flood carrier canal in Karur district at Rs.177.03 crore, about 87% complete (pp.52-53). Karnataka's suit in the Supreme Court, O.S. No. 3 of 2021, seeks to restrain both; Tamil Nadu has replied that none of these projects involves new ayacut (pp.127-128).",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Karur", TN_WRD_CATCHMENTS, "Rivers and canal"),
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false },
    CWC_CANALS,
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a CWC level chart (tap)", "Reservoir with no level chart (its card gives the day's storage where the state dashboard reports it)"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow and water quality (CWC gauge)", "CWC gauge: river flow and water quality (tap for charts)"),
    { family: "monitoring-points", label: "Water-quality stations (TNPCB, 2023)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    tnpcbIndustries(
      [
        {
          value: "red-textile",
          label: "Red: textile processing (bleaching, dyeing, printing)",
          color: "#be123c",
        },
      ],
      "Orange category",
    ),
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "stp",
        label: "Faecal sludge treatment plant on the register (Kulithalai Municipality)",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "kattalai",
        label: "Kattalai system (Mayanur barrage)",
        color: "#7c3aed",
      },
      {
        value: "kodaganar-reservoir",
        label: "Kodaganar reservoir",
        color: "#0d9488",
      },
      {
        value: "nanganjiar-resevoir",
        label: "Nanganjiar reservoir",
        color: "#0891b2",
      },
      {
        value: "lower-bhavani",
        label: "Lower Bhavani Project",
        color: "#15803d",
      },
      {
        value: "parambikulam-aliyar-irrigation",
        label: "Parambikulam Aliyar Project",
        color: "#65a30d",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,315 outlines in the district with a geometry (five rows without one are left out); 242 are named or 5 ha and above, and 148 carry a name. Area is computed from each outline. Named tanks are the 124 the all-tanks register names; the 594 unnamed tank outlines inside the district are not shown as points. The 157 village panchayats cover 2,565 of the district's 2,896 sq km: town panchayats, municipalities and reserve forest are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Cauvery and the Noyyal, which run along the district line, stay on the map. OpenStreetMap spells the Kudaganar 'Kudakanar'. The New Kattalai High Level Canal is CWC's line, drawn with the rivers so that it can be selected.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Kattalai system (154 km inside the district), the Kodaganar (33 km) and Nanganjiar (18 km) reservoir canals, the Lower Bhavani main canal (6 km), and 36 km of lines CWC files under the Kalingarayan Anicut System, drawn as filed; five command areas. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 750 units in the district (749 industrial units and one treatment plant; three register units with no readable parcel are left out). Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code; the register spells Kulithalai taluk as Kuzhithalai.",
    "Treatment plant: the one on the register, Kulithalai Municipality's faecal sludge treatment plant (registered 2019). The state's June 2026 progress report to NMCG lists Kulithalai's faecal sludge plant at 0.02 MLD, in operation (p.23).",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 13 CGWB and 17 Tamil Nadu state telemetry stations (six-hourly, 2026) and 34 CGWB manual wells (quarterly readings, January 2021 to January 2025). Depth is in metres below ground level; each well shows its latest reading and date. Stations are placed by their coordinates, so one well the portal tags as Karur but which lies outside the district is left out.",
    "Reservoirs: TN WRD's register on TNGIS, two waterspreads inside the district: Ponnaniyar (Kadavur taluk) and Noyyal Athupalayam (Pugalur taluk). Storage for Noyyal Athupalayam comes from the state's daily reservoir dashboard (TN-SMART, relayed by RIMES), with the reading's date: depth in feet, storage in Mcft and percentage of capacity, as it prints them. The dashboard's 'Ponnaiyar' point lies 1.4 km outside the register waterspread and no capacity figure confirms it is the same dam, so Ponnaniyar carries no reading.",
    "River flow and water quality at Nallamaranpatty on the Amaravathi: Central Water Commission, from the National Water Data Portal (NWIC). Flow is CWC's manual daily discharge from December 1977, 15,356 daily readings to 15 October 2026, shown as monthly means; water quality is the annual mean of CWC's samples, 1978 to 2023.",
    "Polluted stretch: CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version), names no polluted location in Karur district; its Cauvery stretch from Erode near Virapalayam to Pitchavaram runs past the district. CPCB's 2022 report carried the Amaravathi along Madathukulam and Karur (Priority V); the state's June 2026 progress report to NMCG records its delisting on 2022-2023 data. TNPCB's 2019 action plan for the Cauvery finds no direct outfall or industrial drain into the river in this district and prints no outfall coordinates, so none is drawn. Each is cited by page on the river cards.",
    "Water-quality classes quoted on the Cauvery card: TNPCB stretch-wise monthly report for the Cauvery, January to December 2023, the last year on TNPCB's polluted-stretches page.",
  ],
};

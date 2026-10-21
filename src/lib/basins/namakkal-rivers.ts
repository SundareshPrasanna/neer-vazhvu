import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, TN_GROUNDWATER_WELLS,
  tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Namakkal district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/namakkal-rivers/, built by scripts/build_namakkal_rivers_basin.py. The basin id is "namakkal-rivers";
// the district's own scope is "tn-namakkal". Scaffolded by scripts/new_district_basin.py.
export const NAMAKKAL_RIVERS: BasinManifest = {
  basinId: "namakkal-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Namakkal district: rivers, groundwater and industry",
  displayNameLocal: "நாமக்கல் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Namakkal district in one map: the Cauvery along its western and southern line; the Thirumanimuthar, whose sub-basin and the Karaipottanar's cover 2,308 of the district's 3,413 sq km; the Mettur East Bank Canal in Kumarapalayam taluk; groundwater extraction by taluk; and the 1,088 industrial units on Tamil Nadu's own register. Five of the eight taluks extract more groundwater than is recharged (Rasipuram 149.8%, Sendamangalam 149.2%, Namakkal 127.6%, Paramathi Velur 108.7%, Mohanur 108.4%, 2024-2025) and Tiruchengode is at 99.9%. The register places 84 of the district's 93 red-category textile processing units in Kumarapalayam taluk, on the Cauvery, and 80 of its 133 sago and starch units in Rasipuram taluk. TNPCB's 2019 action plan located 18 sewage outfalls on the district's bank of the Cauvery (17 are drawn; one plots 0.6 km from the river); CPCB's October 2025 list starts the river's polluted stretch at Erode near Virapalayam, 0.3 km off the district line, and lists the Thirumanimuthar as Priority I upstream at Salem. Click a river to scope every layer to its catchment.",
  mapCenter: [11.32, 78.14],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 3413,
  areaNote:
    "Computed from the TNGIS district boundary (3,412.6 sq km). The catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district. The District Environmental Plan (2019) gives 3363.35 sq km (p.5) and CGWB's 2008 brochure 3429.3 sq km across its taluks (p.5).",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB123"],
      color: "#1e3a8a",
      narrative: "The Cauvery is the district's western and southern line: about 94 km of its mapped course runs along or inside the boundary, from Kumarapalayam to Mohanur, opposite Erode and then Karur districts. Its own catchment here is 536 sq km and holds 293 of the district's 1,088 registered units, 90 of the 93 red-category textile processing units among them. TNPCB's 2019 action plan located 18 sewage outfalls on this bank, 15 in Kumarapalayam taluk and 3 in Tiruchengode taluk; from Jedarpalayam to Mohanur it found the towns' sewage going into the Raja Vaikkal and Mohanur canals rather than the river. TNPCB's five 2023 stations on this bank read class B at worst at Komarapalayam and Pallipalayam and class A in every month at Seerampalayam, Paramathi Velur and Mohanur; the series stops at December 2023.",
      attributes: {
        origin: "Talakaveri, in the Brahmagiri range of the Western Ghats in Karnataka: CWC's river network records it as 'Originate at Talakaveri in Kodagu District of Karnataka in Brahmagiri Range of Western Ghats'. In this district it 'enters at Kumarapalayam of Kumarapalayam Taluk' (TNPCB Cauvery action plan, p.73).",
        length: "94 km along or inside the district (OSM mapped course, within 1.6 km of the line). TNPCB divides this bank between two offices: '60.4 KM' under Kumarapalayam, from Poolampatti in Salem district to Molasi (p.73), and 'about 53 km' under Namakkal (p.106). Whole river: 894 km in CWC's river network (length_km 894.37); 'approximately 760 km' in TNPCB's action plan (p.73).",
        tributaries: "In this district the Thirumanimuthar: 'Thirumani Mutharu joins it in a village called Kududurai in Namakkal District' (TNPCB Cauvery action plan, p.11); CGWB places the confluence 'at Nanjai Edayar village of Paramathi taluk' (CGWB Namakkal brochure, December 2008, p.5). The Noyyal and Amaravathi join it in Karur district (TNPCB, p.11).",
        flowsInto: "Bay of Bengal at Poombuhar, Sirkali taluk (TNPCB Cauvery action plan, p.11).",
        pollutedStretch: "CPCB, October 2025: Priority II, 'RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM', maximum BOD 24 mg/l on the 2022-23 basis (Annexure III A, PDF p.91). The stretch starts at station 1320, 0.3 km off the district line at the coordinate TNPCB prints for it (NWMP annual data 2024, p.3); 74 km of the 94 km mapped along the district lies below it, and 14 of the 18 outfalls on the district's bank, OF2 to OF15 from Kumarapalayam to Pallipalayam, lie above it (computed from TNPCB's coordinates on the mapped course). Station 1320 read 3.2 mg/l in 2024 (Annexure XIV, PDF p.145). The 2022 list carried 'ALONG METTUR, ALONG ERODE, KATTIPALAYAM TO TRICHY, KUMBAKONAM TO PITCHAVARAM' as Priority III, maximum BOD 17.0 mg/l (CPCB 2022, PDF p.35); the 2018 list carried 'METTUR TO MAYILADUTHURAI' as Priority I (CPCB 2025, Annexure X, PDF p.121).",
        restorationInitiatives: "Sewerage for the bank towns, in the state's June 2026 report to NMCG: Komarapalayam, 6.02 MLD, 80% complete, timeline September 2026 (PDF p.8); Pallipalayam, 5 MLD, 46%, timeline December 2026 (PDF p.10). Mohanur's 1.01 MLD STP cum FSTP is at 5% with the status 'Site Dispute' (PDF p.30), and Velur's 1.19 MLD plant is at DPR stage (PDF p.32). Two common treatment schemes for Kumarapalayam's dyeing units are among the ten proposed for Erode and Namakkal districts; 'The funding for the 10 schemes is awaited' (PDF p.58). Nadanthaai Vaazhi Cauvery (WRD): the National River Conservation Directorate has approved Rs.934.301 crore, shared 60:40, and the revised project report and State share are 'under consideration of the Government' (WRD policy note 2025-26, PDF pp.88-89).",
      },
    },
    {
      riverId: "thirumanimuthar",
      displayName: "Thirumanimuthar",
      displayNameLocal: "திருமணிமுத்தாறு",
      subHydroshedIds: ["SB129"],
      color: "#2563eb",
      narrative: "The Thirumanimuthar rises in the Shevaroy hills of Salem district and crosses Namakkal from north to south to the Cauvery: CWC's river network maps 66 km of its course inside the district, through Tiruchengode, Rasipuram, Paramathi Velur and Mohanur taluks, which extract 99.9% to 149.8% of their groundwater recharge. Its sub-basin is the district's largest, 1,674 sq km, and holds 591 of the 1,088 registered units, 89 of the 133 sago and starch units and 71 of the 117 quarry leases. CPCB lists the river as Priority I at station 3022, Uthamasolapuram in Salem district, 6.3 km from the district line; TNPCB's monitored stretch, Salem to Papparapatti, 15 km, ends where the river enters Namakkal. The one point TNPCB's 2019 plan sampled inside the district, Mathiyampatti Padithurai in Rasipuram taluk, read BOD 10.2 mg/l against a bathing criterion of 3.",
      attributes: {
        origin: "'The River Thirumanimutharu originates from Manjavadi in Shevaroy Mountain' (TNPCB Thirumanimutharu action plan, 2019, p.6); CWC's river network starts it at Manjavadi R F, Yercaud sub-district, Salem. It enters Namakkal 'at Mamundi Village, Rasipuram taluk' (action plan, p.6).",
        length: "66 km inside the district, 72 km within 1.6 km of the line (CWC river network course). Whole river: 119.83 km (CWC river network). TNPCB gives 'approximately 55 KM' in Salem district and 'about 62 KM in Namakkal district' (action plan, p.6).",
        tributaries: "The Ponniyar, which CWC's river network maps for 19.6 km inside Tiruchengode taluk, joins it at Konnaiyar (CWC river network). The other streams joining it are not named in the documents read.",
        flowsInto: "The Cauvery 'at Nanjai Edayar village of Paramathi taluk' (CGWB Namakkal brochure, December 2008, p.5), the end village CWC's river network also gives. TNPCB's own plan says it 'joins the River Cauvery at Nanjai Edayar place' and 'ends at Koodudurai village, Mohanur Taluk' (Thirumanimutharu action plan, p.6); TNPCB's Cauvery plan names Kududurai (p.11) and Kooduthurai in Paramathy Velur taluk (p.106), and photographs the 'Confluence point of Thirumanimuthar with Mohanur Canal at Koodudurai' (p.115).",
        pollutedStretch: "CPCB, October 2025: Priority I, 'RIVER THIRUMANIMUTHARU AT SALEM, D/S OF SAGO & TEXTILE DYING INDUSTRIES', maximum BOD 60 mg/l on the 2022-23 basis (Annexure III B, PDF p.98) and 120 mg/l in 2024 (Annexure XIV, PDF p.141). It was Priority I in 2018 as 'SALEM TO PAPPARAPATTI' (Annexure XI, PDF p.126) and in 2022 'ALONG SALEM', 56.0 mg/l (CPCB 2022, PDF p.36). TNPCB monitors 'Salem to Papparapatti - 15 KM' at one station, Uthamasolapuram, code 3022, 6.3 km outside the district (stretch reports 2018 to 2023); the state's June 2026 report gives BOD 90 mg/l there (MPR June 2026, PDF p.3). TNPCB's 2019 plan sampled one point inside the district, Mathiyampatti Padithurai, on 4 January 2019: BOD 10.2 mg/l, dissolved oxygen 6.9 mg/l, 'Not complied' (pp.12, 18).",
        restorationInitiatives: "The state's June 2026 report: 'This river is only a flood carrier. The sewage water enters in to the river in Salem Corporation.' Treatment plants are proposed under Nadanthai Vaazhi Cauvery (MPR June 2026, PDF p.70). The Cauvery (Mettur Dam), Sarabanga, Ponniyar, Thirumanimuthar, Karaipottanar and Ayyar link canal scheme was 'investigated to divert surplus flood water from Mettur dam' through these rivers; Phase I, Mettur dam to Pavithram tank in Namakkal district, 132.30 km, is estimated at Rs.8049.00 crore at 2018-19 rates (WRD policy note 2025-26, PDF pp.56-57).",
      },
    },
    {
      riverId: "mettur-east-bank-canal",
      displayName: "Mettur East Bank Canal",
      displayNameLocal: "மேட்டூர் கிழக்குக்கரை கால்வாய்",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "A branch canal of the Mettur Canal System, it ends in Kumarapalayam taluk: CWC's canal network maps 18.9 km of it inside the district, its last point 3.3 km from the Cauvery, with four distributaries adding 15.5 km. CWC maps 6,127 ha of the system's command area inside the district. The register places 26 of the district's 93 red-category textile processing units within 2 km of the canal. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "No document read names its head works. WRD lists its rehabilitation reaches by chainage, the first in Mettur taluk of Salem district, 'from LS 1105 m to 6655 m' (PWD policy note 2014-15, PDF p.139). CWC files it under the Mettur Canal System on the Cauvery (CWC canal network).",
        length: "18.9 km inside the district, all in Kumarapalayam taluk (CWC canal network); 22.9 km within 1.6 km of the district line. CWC gives the whole canal 65.6 km (length_km 65.5987). WRD's works reach 'from LS 45.303km to 58.000km in Kumarapalayam Taluk' (PWD policy note 2017-18, PDF p.134).",
        tributaries: "Not applicable to a canal. CWC maps four distributaries off it inside the district, 15.5 km in all; CWC gives the Mettur Canal System, approved 1949, a culturable command area of 18.21 thousand ha across Salem, Erode and Namakkal (CWC water resource project layer).",
        flowsInto: "No known public government document states where it ends. CWC's line ends inside Kumarapalayam taluk, 3.3 km from the Cauvery.",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches.",
        restorationInitiatives: "Rehabilitation from LS 45.303 km to 58.000 km in Kumarapalayam taluk, Rs.25 crore, 7,481 acres: listed to 'commence soon' (PWD policy note 2017-18, PDF p.134) and at 85% of work completed (2018-19, PDF p.120). Rehabilitation in Mettur, Edapadi and Thiruchengode taluks, Rs.30.00 crore, 27,000 acres: '95% works have been completed' (2016-17, PDF p.141). Rehabilitation from LS 14,000 m to 31,400 m in Edappadi and Sankari taluks of Salem district, Rs.48.86 crore, 9,039 acres (2019-20, PDF p.113).",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Namakkal", TN_WRD_CATCHMENTS, "Rivers and canals"),
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false },
    { family: "prs-drains", label: "Sewage outfalls (TNPCB action plan, 2019)", floor: "hydrology", geom: "point", color: "#eab308", defaultOn: true },
    CWC_CANALS,
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
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
      "Orange category (sago and starch, animal feed, stone crushers)",
    ),
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "cetp-proposed",
        label: "Common effluent treatment plant: proposed, funding awaited",
        color: "#d8b4fe",
      },
      {
        value: "stp",
        label: "Sewage and faecal sludge treatment plants",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "mettur-canal-system",
        label: "Mettur canal system",
        color: "#1e3a8a",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,235 outlines in the district: 290 named or of 5 ha and more (230 of them named), and 945 smaller unnamed outlines. The register prints a class (Kuttai, Kulam, Odai, Stream) far more often than a name; area is computed from each outline. Named tanks are the 205 the all-tanks register names inside the district. Village panchayats: 322; town panchayats, municipalities and the corporation are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Cauvery, which is the district line, stays on the map. OpenStreetMap names no other river inside the district; the Thirumanimuthar is drawn from the Central Water Commission's river network on the National Water Data Portal (NWIC), which the portal lists under an open licence.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Mettur East Bank Canal and four Mettur Canal System distributaries, 34.4 km inside the district. Two main canals, 55.3 km in Paramathi Velur and Mohanur taluks, that CWC files under the Kalingarayan Anicut System (an Erode canal system) are left out until a source names them; TNPCB's Cauvery plan calls the canals from the Jedarpalayam regulator 'Rajavaikal' and 'Mohanur vaikkal' (pp.106, 109). Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 1,091 units placed (8 more print no position and are left out). Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code; the register spells Tiruchengode taluk as Thiruchengode.",
    "Treatment plants: positions from the industry register: the Rasipuram sewage treatment plant, Tiruchengode Municipality's faecal sludge treatment plant, and the Green Environmental Association common effluent treatment plant at Pallakkapalayam, one of the two Namakkal schemes the Tamil Nadu Department of Textiles tabulates under Nadanthai Vaazhi Cauvery (3.00 MLD, 118 dyeing units, Rs.182.4 crore). The other, the Kumarapalayam Green Kavery Dyeing Cluster (5.00 MLD, 90 units, Rs.133.53 crore), is registered as a textile park and sits on the industry layer. The state's June 2026 report to NMCG says funding for the ten schemes is awaited.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu, 105 wells in the district: CGWB telemetry (11) and Tamil Nadu state telemetry (25) stations, six-hourly in 2026, and CGWB manual quarterly readings, 2021 to 2025 (69). Depth is in metres below ground level; each well shows its latest reading and date. Stations are placed by their coordinates, so wells the portal tags as Namakkal but which lie outside the district are left out.",
    "Water-quality stations: TNPCB stretch-wise monthly reports for the Cauvery, January to December 2023, the last year published: Komarapalayam, Seerampalayam, Pallipalayam, Paramathi Velur and Mohanur. Classes are the worst monthly use-based class of 2023. Station points are town centres.",
    "Polluted stretch: CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version), with the 2018 list as CPCB restates it, drawn on the mapped course of the Cauvery inside the district; the 2025 stretch is drawn from station 1320, at the coordinate TNPCB prints for it. Outfalls: TNPCB's 2019 action plan for the Cauvery, p.85. Sewerage progress: the state's June 2026 monthly report to NMCG. Each is cited by page on the river cards.",
    "The build found no reservoir on the TN WRD register within 1.6 km of the district, no CWC discharge or water-quality station tagged Namakkal on the National Water Data Portal, and no TNPCB real-time sensor station in the district (probes of 21 October 2026).",
  ],
};

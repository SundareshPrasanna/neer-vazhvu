import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges, TN_GROUNDWATER_WELLS,
  tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Thanjavur district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/thanjavur-rivers/, built by scripts/build_thanjavur_rivers_basin.py. The basin id is "thanjavur-rivers";
// the district's own scope is "tn-thanjavur". Scaffolded by scripts/new_district_basin.py.
export const THANJAVUR_RIVERS: BasinManifest = {
  basinId: "thanjavur-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Thanjavur district: rivers, groundwater and industry",
  displayNameLocal: "தஞ்சாவூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Thanjavur district in one map: the head of the Cauvery delta, where the Grand Anicut (Kallanai) divides the river into the Cauvery, the Vennar, the Grand Anicut Canal and the Kollidam on the district's northern line; the Kudamurutti, Arasalar and Vettar that branch off below it; in the south the Pamani and the Agniyar, Nasuvunni and Maharajasamudram of the Agniyar basin; 508 km of canals on CWC's network; groundwater extraction by taluk; and the 313 units on Tamil Nadu's own industry register. Six of the nine taluks extract more groundwater than is recharged: Thiruvidaimarudhur 124.8%, Thiruvaiyaru 110.9%, Kumbakonam 109.6%, Orathanadu 108.2%, Papanasam 100.7% and Pattukkottai 100.1% (2024-2025). CPCB's October 2025 list carries the Cauvery from Erode to Pitchavaram as Priority II, and the highest reading on that whole stretch, a BOD of 24 mg/L in 2022 and 2023, is at its Kumbakonam station, inside this district; the same station read 2.5 mg/L in 2024. TNPCB's 2019 action plan records two town panchayats on the Cauvery here, Thirukattupalli and Thiruvaiyaru, letting part of their sewage into the river. Click a river to scope every layer to its catchment.",
  mapCenter: [10.67, 79.24],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 3410,
  areaNote:
    "Computed from the TNGIS district boundary. The Census handbook prints 3,411 sq km (DCHB 2011, p.3) and CGWB 3,396.57 sq km (2009 brochure, p.i). The catchments are TN WRD's sub-basins cut to that boundary and cover 3,399 sq km of it (two slivers under 5 sq km, South Vellar and Nandiyar-Kulaiyar, are left out); each continues outside the district, the Cauvery Delta into Tiruvarur and Nagapattinam and the Agniyar and Ambuliyar into Pudukkottai.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB116", "SB119"],
      color: "#1e3a8a",
      narrative: "Below the Grand Anicut at Thogur the Cauvery crosses the district eastward, about 99 km of mapped course inside or along it; TNPCB counts 82.7 km inside the district. On the TNGIS taluk map it passes Budalur, Thiruvaiyaru, Papanasam, Thiruvidaimarudhur and Kumbakonam taluks, and four of those five extract more groundwater than is recharged. TNPCB's 2019 action plan found no industrial discharge into this reach and lists three domestic sewage outfall points from two town panchayats, Thirukattupalli and Thiruvaiyaru. CPCB's October 2025 list carries the reach inside its Priority II stretch from Erode to Pitchavaram, and the stretch's highest BOD, 24 mg/L in 2022 and 2023, was read at Kumbakonam; in 2024 that station read 2.5 mg/L.",
      attributes: {
        origin: "Talakaveri, on the Brahmagiri range of the Western Ghats in Karnataka, at about 1,341 m (CWC, Cauvery basin page). It 'enters into Thanjavur District at Thohur village' (TNPCB Cauvery action plan, p.180), where the Grand Anicut stands (Thanjavur district website, WRD page, spells it Thogur, Thiruvaiyaru taluk). The coordinates the plan prints for this entry point and for the exit at Narasinganpettai plot outside the district, so the map does not use them.",
        length: "99 km of mapped course inside or along the district, 89 km of it inside the line (OSM). TNPCB: 'The total length of River Cauvery in Thanjavur District is 82.7 km' (action plan, p.180). Whole river: about 800 km (CWC, Cauvery basin page).",
        tributaries: "None inside the district: 'There are no tributories which joins in the River Cauvery' (TNPCB action plan, p.180, as printed). Distributaries leave it at four structures: the Grand Anicut at Thohur (the Coleroon, the Vennar and the Grand Anicut canal), the Kudamurutti head at Thirukattuppalli, the Arasalaru dam at Kabisthalam Mettutheru and the Veeracholan regulator at Mananchery (pp.180-181).",
        flowsInto: "It 'leaves Thanjavur District at Narasinganpettai village' and enters what the 2019 plan calls Nagapattinam District (TNPCB action plan, p.180), reaching the Bay of Bengal at Poombuhar (p.11).",
        pollutedStretch: "CPCB, October 2025: Priority II, 'RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM', maximum BOD 24 mg/L in 2022 and 2023 (Annexure III A, p.81). Of the stretch's seven stations, the 24 mg/L is the reading at 'RIVER CAUVERY AT KUMBAKONAM, THANJAVUR, TAMILNADU' (Annexure II, p.66); the same station read 2.5 mg/L in 2024 (Annexure XIV, p.135). CPCB records the stretch as improved from its 2018 listing, Mettur to Mayiladuthurai, Priority I, BOD 3.3 to 32 mg/L (September 2018 list, Table 3; 2025 report, Annexure X, p.111). In the 2022 list the Cauvery was Priority III with a maximum BOD of 17.0 mg/L in 2019 and 2021, read at 'RIVER CAUVERY AT TRICHY, GRAND ANAICUT, TAMILNADU'; the Thanjavur station read 5.2 and Kumbakonam 7.5 (Table 27, p.27; Annexure I, p.51). TNPCB's 2019 action plan, written for the 2018 Priority I stretch, records 'no water polluting industries located adjacent to the River Cauvery' in the district, and for Thirukattupalli and Thiruvaiyaru town panchayats: 'Part of the sewage is discharged into the River Cauvery' (p.182). Its table lists three outfalls with GPS coordinates, though the sentence above it says two (p.194). Its river samples of 02.01.2019 read BOD 4 mg/L upstream of the Thirukattupalli regulator and behind the ARC Complex at Thiruvaiyaru, against the bathing criterion of 3, and dissolved oxygen 4.8 mg/L at the Mahamagam Padithurai in Kumbakonam, against 5 (p.193). TNPCB's monthly report for 2023 reads the Cauvery at Kumbakonam class B in the three months it reports (January, February, November) and the Cauvery at Thanjavur class A or B in the four months it reports.",
        restorationInitiatives: "Nadanthaai Vaazhi Cauvery (WRD): the National River Conservation Directorate has approved Rs.934.301 crore for the first phase, shared 60:40, including Rs.36.70 crore for a Kallanai Museum; the revised DPR and the State share are 'under consideration of the Government' (WRD policy note 2025-26, pp.76-78). Extension, Renovation and Modernisation of the Cauvery sub-basin: 33 packages, revised sanction Rs.3,607.30 crore, an ayacut of 3,54,147 acres in Thanjavur, Nagapattinam, Pudukottai, Mayiladuthurai and Tiruvarur districts, 94% of works complete (p.17). Kumbakonam's 17.0 MLD sewage treatment plant is operating with 13.00 MLD in use, Thiruvaiyaru's 1.01 MLD plant is 99% built with a September 2026 timeline, and a 0.01 MLD plant for Thirukattupalli is at DPR stage (Tamil Nadu's monthly progress report to NMCG, June 2026, pp.4, 8, 15).",
      },
    },
    {
      riverId: "kollidam",
      displayName: "Kollidam (Coleroon)",
      displayNameLocal: "கொள்ளிடம்",
      subHydroshedIds: [],
      color: "#0369a1",
      narrative: "The Kollidam is the district's northern line: 'The Kollidam River forms the northern boundary and flows from west to east' (DCHB 2011, p.3). About 104 km of its mapped course runs along the district, 46 km of it inside the line, past Budalur, Thiruvaiyaru, Papanasam and Thiruvidaimarudhur taluks. At the Grand Anicut it takes the Cauvery's flood water so that the delta's own channels stay intact (Thanjavur district website, WRD page). The register places five of its nine riverbed sand-mining units within 1 km of the river. It has almost no catchment of its own inside the district, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Cauvery 'splits into two at upper Anicut about 14 kilometres (9 mi) west of Tiruchirappalli. The northern branch of the river is called the Kollidam' (TNPCB Cauvery action plan, p.11). At the Grand Anicut, 'During floods the storm water is being diverted to the Coleroon river, the flood carrier' (Thanjavur district website, WRD page).",
        length: "104 km along or inside the district, 46 km of it inside the line (OSM mapped course). No official length was found in the documents read.",
        tributaries: "TN WRD's Marudaiyar and Lower Coleroon sub-basins, on its north bank, reach into the district for 14.4 and 11.1 sq km (TN WRD sub-basins on TNGIS); no source read names a tributary joining it inside the district.",
        flowsInto: "Towards the sea: near its tail, between Thirukazhipalai village (Cuddalore district) and Alagudi village (Mayiladuthurai district), WRD is studying a tail-end structure 'to prevent sea water intrusion' (WRD policy note 2025-26, p.201). No document read names its mouth.",
        pollutedStretch: "CPCB lists no Kollidam stretch. Its station 1326, 'RIVER CAUVERY AT COLEROON', is one of the seven stations of the Cauvery's Priority II stretch: maximum BOD 16 mg/L in 2022 and 2023 and 8 mg/L in 2024 (CPCB October 2025, Annexure II, p.66; Annexure XIV, p.135). CPCB and TNPCB print no position for the station.",
        restorationInitiatives: "WRD proposes a new regulator at Anaikarai 'to replace the 185 year old Regulator in the Northern and Southern arms of Kollidam River', between Vembukudi village (Ariyalur district) and Vinayagan Street village in Thiruvidaimarudur taluk of this district, storing about 200 Mcft (WRD policy note 2025-26, p.202). A detailed project report for rehabilitating the Kollidam system across Tiruchirappalli, Ariyalur, Thanjavur, Mayiladuthurai and Cuddalore districts, Rs.9.983 crore, is being prepared (p.211). Flood protection works to the Kollidam in Thanjavur, Nagapattinam and Cuddalore districts, Rs.375.90 crore, are listed among completed Flood Management Programme works (PWD policy note 2014-15, pp.76-77).",
      },
    },
    {
      riverId: "vennar",
      displayName: "Vennar",
      displayNameLocal: "வெண்ணாறு",
      subHydroshedIds: ["SB116"],
      color: "#2563eb",
      narrative: "The Vennar leaves the Cauvery at the Grand Anicut and, at the Thenperumbur anaicut, divides into the Vennar and the Vettar (DCHB 2011, p.3). OpenStreetMap draws about 47 km of it inside or along the district in two pieces, 22 and 25 km long, with a gap of about 20 km between them. TNPCB samples it monthly above and below Thanjavur: in 2023 both stations read class A or B in every month reported, and neither reported in March, May, June or July. CPCB's 2022 report lists the Vennar among rivers whose BOD stayed below 3 mg/L in 2019 and 2021. The register's only two red-category basic chemicals units lie within 1 km of its mapped course in Papanasam taluk.",
      attributes: {
        origin: "The Grand Anicut at Thogur, where WRD distributes the Mettur water 'to Cauvery, Vennar, Grand Anicut Canal and Coleroon rivers' (Thanjavur district website, WRD page); 'at this point Cauvery splits into Cauvery and Vennar' (DCHB 2011, p.3).",
        length: "47 km of mapped course inside or along the district, in two pieces (OSM). WRD works in chainage: its rehabilitation proposal covers the river 'from L.S.27.260 km to 55.510 km' (WRD policy note 2025-26, p.212), and a bed dam stands at L.S.75.250 km in Papanasam taluk (WRD announcements status, 2022-23). No official total length was found.",
        tributaries: "Its main branch is the Vettar: 'At Thenperumbur anaicut, Vennar splits into Vennar and Vettar' (DCHB 2011, p.3). WRD names a 'Vennar - Koraiyar - Pamaniyar Regulator across Vennar River in Needamangalam Taluk of Tiruvarur District' (PWD policy note 2015-16, photograph caption).",
        flowsInto: "Downstream through Tiruvarur and Nagapattinam: WRD's Vennar sub-basin lies in 'Thanjavur, Thiruvarur and Nagapattinam Districts' (WRD policy note 2025-26, p.212). No document read states where the Vennar itself ends.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists. CPCB's 2022 report names the Vennar in its 'List of Clean Rivers based on monitored data during year 2019 & 2021' (Annexure III, p.60). TNPCB's 2023 monthly report has two stations on it, Vennar at Thanjavur upstream (10057) and downstream (10058): BOD from below 2 to 3 mg/L, class A or B, in the months reported. In January, February and November 2023 the upstream station's row prints the same values as station 1206, the Cauvery at Thanjavur.",
        restorationInitiatives: "WRD is preparing a detailed project report, Rs.9.80 crore, to rehabilitate the Vennar's irrigation structures from L.S.27.260 to 55.510 km (WRD policy note 2025-26, p.212), and the Vennar is one of six rivers in the preliminary project report for Phase II of the Asian Development Bank assisted climate adaptation project in the delta, submitted on 22.09.2021 (pp.69-70). A bed dam across the Vennar at L.S.75.250 km, Kovathakudi village, Papanasam taluk, Rs.10.00 crore, is listed with status C (WRD announcements status, 2022-23). Grade walls at mile 30/1 (Piramanpettai, Thanjavur taluk) and mile 56/5-6 (Ukkadai, Papanasam taluk) were reported 85% and 90% complete (PWD policy note 2014-15, p.146).",
      },
    },
    {
      riverId: "vettar",
      displayName: "Vettar",
      subHydroshedIds: ["SB116"],
      color: "#0891b2",
      narrative: "The Vettar is the Vennar's branch, split off at the Thenperumbur anaicut (DCHB 2011, p.3). About 37 km of it is mapped through Thiruvaiyaru, Papanasam, Thanjavur and Budalur taluks. No TNPCB or CPCB monitoring station is on it, and no registered industrial unit lies within 1 km of its course.",
      attributes: {
        origin: "The Thenperumbur anaicut on the Vennar: 'At Thenperumbur anaicut, Vennar splits into Vennar and Vettar' (DCHB 2011, p.3; the same in CGWB's 2009 Thanjavur brochure, p.1).",
        length: "37 km of mapped course inside or along the district (OSM). WRD records a bed dam at L.S.70.930 km in Papanasam taluk (WRD announcements status, 2022-23). No official total length was found.",
        tributaries: "None named in the sources read. WRD names a Vettar sub-basin alongside the Odampokkiyar and Vennar sub-basins (WRD policy note 2025-26, p.212).",
        flowsInto: "No document read states where it ends. The Cauvery River Basin Atlas lists the Vettar in Thanjavur and Tiruvarur districts (NRCD, 2025, pp.20-21).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the polluted or the clean rivers it assessed. TNPCB's 2023 report has no station on it.",
        restorationInitiatives: "A bed dam across the Vettar at L.S.70.930 km, Kondavittanthidal village, Papanasam taluk, Rs.7.97 crore, is listed with status C (WRD announcements status, 2022-23).",
      },
    },
    {
      riverId: "kudamurutti",
      displayName: "Kudamurutti",
      subHydroshedIds: ["SB116"],
      color: "#0d9488",
      narrative: "The Kudamurutti leaves the Cauvery at the Kudamurutti head at Thirukattuppalli (TNPCB Cauvery action plan, p.180) and runs about 60 km of mapped course eastward, mostly through Thiruvaiyaru and Papanasam taluks, which extract 110.9% and 100.7% of their groundwater recharge. The register places 13 units within 1 km of its course, none of them red category. No TNPCB or CPCB monitoring station is on it.",
      attributes: {
        origin: "'A regulator at Tirukkattupalli splits Cauvery into Cauvery and Kudamurtti rivers' (DCHB 2011, p.3); TNPCB lists the Cauvery-Kudamurutti head at Thirukattuppalli (action plan, p.180).",
        length: "60 km of mapped course inside or along the district (OSM). The Cauvery River Basin Atlas gives the Kodamurutti River 70.49 km (NRCD, 2025, Table 8, p.35).",
        tributaries: "None named in the sources read.",
        flowsInto: "No document read states where it ends. The Atlas lists the Kodamurutti in Thanjavur and Tiruvarur districts (pp.20-21).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the rivers it assessed.",
        restorationInitiatives: "Grade walls across the Kudamurutty at mile 39/0-100 and 40/1 (Thiruchotruthurai village) and at mile 30/2 (Konerirajapuram village), both in Thiruvaiyaru taluk, were reported 70% and 60% complete (PWD policy note 2014-15, p.145).",
      },
    },
    {
      riverId: "arasalar",
      displayName: "Arasalar",
      subHydroshedIds: ["SB116"],
      color: "#7c3aed",
      narrative: "The Arasalar leaves the Cauvery at the Arasalaru dam at Kabisthalam Mettutheru (TNPCB Cauvery action plan, p.180). OpenStreetMap draws 18 km of it inside or along the district, all in Kumbakonam taluk (109.6% groundwater extraction); the Cauvery River Basin Atlas gives the whole river 84.76 km. Downstream, in Karaikal, CPCB's 2018 list carried an Arasalar stretch at Priority IV; no Arasalar stretch has been listed since.",
      attributes: {
        origin: "The Cauvery-Arasalaru dam at Kabisthalam Mettutheru (TNPCB Cauvery action plan, pp.180-181).",
        length: "18 km of mapped course inside or along the district (OSM). Whole river: 84.76 km (Cauvery River Basin Atlas, NRCD, 2025, Table 8, p.35).",
        tributaries: "None named in the sources read.",
        flowsInto: "Karaikal: the Atlas lists the Arasalar in Thanjavur, Tiruvarur and Karaikkal (Puducherry) (pp.20-21), and CPCB monitors it 'Along KARAIKAL' (September 2018 list, Table 4).",
        pollutedStretch: "Downstream only. CPCB's September 2018 list carried the Arasalar 'Along KARAIKAL' under Puducherry, Priority IV, BOD 7.0 mg/L (Table 4). The 2022 report placed it among stretches removed 'based on observed improvement in the monitored data during 2019 & 2021' (Annexure X, p.79) and names the Arasalar among its clean rivers (Annexure III, p.59); the 2025 report records it as identified in 2018 but not in the present assessment (Annexure IX, p.106). No stretch in Thanjavur district is listed.",
        restorationInitiatives: "No known public record of a restoration scheme for the Arasalar in the WRD, TNPCB or district documents read.",
      },
    },
    {
      riverId: "pamani",
      displayName: "Pamani (Pamaniyar)",
      subHydroshedIds: ["SB116"],
      color: "#4f46e5",
      narrative: "The Pamani, which WRD spells Pammaniyar or Pamaniyar, is one of the Cauvery delta rivers (TN WRD, Cauvery basin page). About 38 km of it is mapped in the district's south-east, through Pattukkottai and Orathanadu taluks. No registered industrial unit lies within 1 km of it, and no monitoring station is on it.",
      attributes: {
        origin: "No document read states where it rises. WRD names a 'Vennar - Koraiyar - Pamaniyar Regulator across Vennar River in Needamangalam Taluk of Tiruvarur District' (PWD policy note 2015-16, photograph caption).",
        length: "38 km of mapped course inside or along the district (OSM); WRD records a grade wall at mile 87/05 (PWD policy note 2014-15, p.146). No official total length was found.",
        tributaries: "None named in the sources read.",
        flowsInto: "No document read states where it ends. The Atlas lists the Pamaniyar in Thanjavur and Tiruvarur districts (NRCD, 2025, pp.20-21).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the rivers it assessed.",
        restorationInitiatives: "A grade wall across the Pamaniyar at mile 87/05 to feed the Kandaparichanar main channel at Siramelkudi village, Pattukkottai taluk, was reported 95% complete (PWD policy note 2014-15, p.146). The Paminiyar is one of six rivers in the preliminary project report for Phase II of the Asian Development Bank assisted climate adaptation project, submitted on 22.09.2021 (WRD policy note 2025-26, pp.69-70).",
      },
    },
    {
      riverId: "agniyar",
      displayName: "Agniyar",
      displayNameLocal: "அக்னியாறு",
      subHydroshedIds: ["SB130"],
      color: "#d97706",
      narrative: "The Agniyar names the basin that drains the district's south: TN WRD's Agniyar sub-basin covers 928 sq km of the district and its Ambuliyar sub-basin a further 268. About 39 km of the river is mapped here, almost all in Pattukkottai taluk (100.1% groundwater extraction). The two sub-basins hold 465 of the district's 753 named tanks and 75 of its 313 registered units. CWC's Pattukottai gauge is filed under the Agniyar, but its printed position falls on the Maharajasamudram, 6 km from the Agniyar's mapped course; it is drawn there.",
      attributes: {
        origin: "No official source read states where it rises. TN WRD's Agniyar sub-basin, 2,106.431 sq km across Pudukottai and Thanjavur districts, lists the 'Kattar, Agniyar, Nasuvunni, Maharajasamudram' (TN WRD, Agniyar basin page).",
        length: "39 km of mapped course inside or along the district (OSM). No official length was found.",
        tributaries: "TN WRD lists the Kattar, Nasuvunni and Maharajasamudram with it in the Agniyar sub-basin (Agniyar basin page); no source read says which of them join it.",
        flowsInto: "No document read states where it meets the sea. CWC files its gauge under the basin 'East flowing rivers between Pennar and Kanyakumari' (Pattukottai record, National Water Data Portal).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the rivers it assessed.",
        restorationInitiatives: "A check dam across the Agniar near Neivelivadapathy village, Orathanadu taluk, Rs.7.45 crore for 883 acres, was reported 80% complete (PWD policy note 2016-17, p.236). The Cauvery - Agniyar - South Vellar - Manimuthar - Vaigai - Gundar link canal, 262.19 km from the Kattalai (Mayanur) barrage, is planned to connect the Cauvery with the Agniyar (WRD policy note 2025-26, p.41).",
      },
    },
    {
      riverId: "nasuvunni",
      displayName: "Nasuvunni",
      subHydroshedIds: ["SB130"],
      color: "#b45309",
      narrative: "The Nasuvunni is the longest river drawn in the district's south: about 61 km of mapped course, all inside the line and almost all in the Agniyar sub-basin, through Pattukkottai and Orathanadu taluks (100.1% and 108.2% groundwater extraction). WRD's works records call it the Nasuviniyar Drain.",
      attributes: {
        origin: "No official source read states where it rises. TN WRD lists the Nasuvunni in the Agniyar sub-basin (Agniyar basin page).",
        length: "61 km of mapped course, all inside the district (OSM). No official length was found.",
        tributaries: "None named in the sources read.",
        flowsInto: "No document read states where it ends.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the rivers it assessed.",
        restorationInitiatives: "A tail-end bed dam across the Nasuviniyar Drain from LS 22.000 km, Karisakkadu village, Pattukkottai taluk, Rs.4.76 crore, is listed with status C (WRD announcements status, 2022-23). A pumping scheme from the Maharajasamudram and the 'Nasuviniyar River to feed Ettupulikadu channel No.II' in Pattukottai taluk, Rs.32.50 crore, was under scrutiny (PWD policy note 2019-20, p.167).",
      },
    },
    {
      riverId: "maharajasamudram",
      displayName: "Maharajasamudram",
      subHydroshedIds: ["SB130"],
      color: "#ca8a04",
      narrative: "The Maharajasamudram runs about 37 km of mapped course through Orathanadu and Pattukkottai taluks, in the Agniyar sub-basin. CWC's Pattukottai gauge, the district's only river gauge on the portal, sits on its mapped course and read flow 1,659 times, on 1,632 days, between 7 November 2018 and 31 July 2026: monthly means reach 24.5 cubic metres a second (November 2021), and every reading was zero in April and July 2024, March and June 2025 and June and July 2026. CWC's own record names the gauge's river as the Agniyar. Pattukkottai Municipality's faecal sludge treatment plant on the register is 0.4 km from the river's course.",
      attributes: {
        origin: "No official source read states where it rises. TN WRD lists the Maharajasamudram in the Agniyar sub-basin (Agniyar basin page).",
        length: "37 km of mapped course inside or along the district (OSM). No official length was found.",
        tributaries: "None named in the sources read.",
        flowsInto: "No document read states where it ends.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and CPCB's 2022 report does not name it among the rivers it assessed. CWC's Pattukottai record carries flow only, no water quality.",
        restorationInitiatives: "A check dam across the Maharajasamudram river in Sillathur village, Orathanadu taluk, Rs.4.13 crore, is listed with status C (WRD announcements status, 2021-22). A pumping scheme in the river to feed the Rajamadam main channel in Enathi village, Rs.32.50 crore, was under scrutiny (PWD policy note 2019-20, p.167).",
      },
    },
    {
      riverId: "grand-anicut-canal",
      displayName: "Grand Anicut Canal",
      displayNameLocal: "கல்லணைக் கால்வாய்",
      subHydroshedIds: [],
      color: "#0e7490",
      narrative: "The Grand Anicut Canal is one of the four channels into which the Grand Anicut divides the Cauvery, with the Cauvery, the Vennar and the Kollidam; the Census handbook calls it 'Putharu' (DCHB 2011, p.4). CWC's canal network maps about 100 km of it inside the district, south through Budalur, Thanjavur, Orathanadu, Pattukkottai and Peravurani taluks into Pudukkottai district, and files it under the Cauvery Mettur project, whose command area covers 157,703 ha of the district. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Grand Anicut at Thogur, Thiruvaiyaru taluk (Thanjavur district website, WRD page); CWC's line begins inside the district at the canal head (CWC canal network).",
        length: "About 100 km inside the district (99.7 km of CWC's line, computed); CWC's own attribute gives the whole line 141.93 km (CWC canal network, 2025). WRD's works run in chainage to 148.650 km, in Avudaiyarkovil and Manalmedukudi taluks of Pudukkottai district (WRD announcements status, 2024-25).",
        tributaries: "Not applicable to a canal. Its full supply level is 4,200 cusecs, and the modernisation scheme is to stabilise an ayacut of 2,27,472 acres in Thanjavur and Pudukottai districts (WRD policy note 2025-26, p.18). CWC gives the Cauvery Mettur project a culturable command area of 103.79 thousand ha (CWC command areas).",
        flowsInto: "Its last reaches lie in Aranthangi, Avudaiyarkovil and Manalmedukudi taluks of Pudukkottai district (WRD announcements status, 2024-25).",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches. No TNPCB monitoring station is on the canal in the 2023 report.",
        restorationInitiatives: "Extension, Renovation and Modernisation of the Grand Anicut Canal: 16 packages, Rs.2,639.15 crore, to restore the 4,200 cusec full supply level and raise carrying efficiency 'from 45% to 61.60%'; phase I is five packages at a revised Rs.1,082.31 crore, and Rs.447 crore is sanctioned for six phase II packages (WRD policy note 2025-26, p.18). Among them, the canal from L.S.92.200 to 107.198 km and its head reach, in Pattukkottai, Peravurani, Thanjavur and Budalur taluks, Rs.77.10 and Rs.96.09 crore, are listed in progress (WRD announcements status, 2024-25).",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Thanjavur", TN_WRD_CATCHMENTS, "Rivers and the Grand Anicut Canal"),
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false },
    { family: "prs-drains", label: "Sewage outfalls (TNPCB action plan, 2019)", floor: "hydrology", geom: "point", color: "#eab308", defaultOn: true },
    CWC_CANALS,
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow (CWC gauge)", "CWC gauge: river flow (tap for chart)"),
    { family: "monitoring-points", label: "Water-quality stations (TNPCB, 2023)", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    tnpcbIndustries(
      [
        {
          value: "red-metal-treatment",
          label: "Red: metal surface treatment (pickling, plating)",
          color: "#e11d48",
        },
      ],
      "Orange category (health care, rice mills, building projects, vehicle servicing, riverbed sand mining)",
    ),
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "stp",
        label: "Sewage and faecal sludge treatment plants on the register (Kumbakonam, Pattukkottai)",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "cauvery-delta-system",
        label: "Cauvery Delta System",
        color: "#1e3a8a",
      },
      {
        value: "cauvery-mettur",
        label: "Cauvery Mettur project (includes the Grand Anicut Canal)",
        color: "#0e7490",
      },
      {
        value: "kattalai",
        label: "Kattalai (New Kattalai high level canal)",
        color: "#65a30d",
      },
      {
        value: "lower-coleroon-anicut-system",
        label: "Lower Coleroon Anicut System (South Rajan canal)",
        color: "#7c3aed",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 5,289 outlines in the district with a geometry (199 register rows have none). 605 are 5 ha or larger and 437 of those carry a name; 325 smaller outlines are named too. The water-bodies layer shows every named outline and every outline of 5 ha or more, 930 in all. Area is computed from each outline. Named tanks are the 753 the all-tanks register names out of 2,166 tank outlines inside the district.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Kollidam, which is the district's northern line, stays on the map. OpenStreetMap draws the Vennar in two pieces with a gap of about 20 km, and only 18 km of the Arasalar.",
    "Grand Anicut Canal and the canal network: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): 35 canal lines, 508 km inside the district (Cauvery Mettur 389 km, which includes the Grand Anicut Canal; Cauvery Delta System 89 km; Kattalai 19 km; Lower Coleroon Anicut System 10 km), and four command areas. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure. The Grand Anicut Canal is drawn as a waterway that can be selected like a river.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 313 units in the district (31 red, 212 orange, 70 green), registered 2015 to 2024. Unit ids follow TNPCB's consent-register format. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound: TNPCB's 2019 action plan counts 656 units across the district's taluks (p.193). Sector is read from TNPCB's own industry type code. SIPCOT GIS has no industrial estate in the district; its one outline here, Thalaivaipalayam, is a tourism plot.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 62 stations placed by their coordinates, 4 CGWB and 34 Tamil Nadu state telemetry stations (six-hourly, 2026) and 24 CGWB manual wells (2021 to 2025). Depth is in metres below ground level; each well shows its latest reading and date.",
    "River flow at Pattukottai: Central Water Commission, from the National Water Data Portal (NWIC): manual daily discharge, 1,659 readings on 1,632 days from 7 November 2018 to 31 July 2026, shown as monthly means. CWC's record names the river as the Agniyar; the printed position falls on the mapped course of the Maharajasamudram, 6 km from the Agniyar's, so the gauge is drawn there. The portal carries no CWC water-quality rows for the district.",
    "Polluted stretch, outfalls and water quality: CPCB, Polluted River Stretches for Restoration of Water Quality, September 2018, November 2022 and October 2025 (updated version); TNPCB's 2019 action plan for the Cauvery, Mettur to Mayiladuthurai stretch (Thanjavur district, pp.180-209); TNPCB's National Water Quality Monitoring Programme monthly report for January to December 2023 (the same address for 2024 and 2025 returns HTTP 404); and Tamil Nadu's June 2026 monthly progress report to NMCG. Each is cited by page on the Cauvery, Kollidam, Vennar and Arasalar cards.",
    "Tamil names: the Thanjavur district website's Tamil page for the Water Resources Department, which names காவிரி, கொள்ளிடம், வெண்ணாறு, கல்லணைக் கால்வாய் and அக்னியாறு. No official Tamil source read names the Vettar, Kudamurutti, Arasalar, Pamani, Nasuvunni or Maharajasamudram, so those cards carry no Tamil name.",
    "No reservoir on the TN WRD register on TNGIS lies in the district, TNPCB's real-time dashboard has no station here (eight stations, none in Thanjavur), and no known public source gives Thanjavur industrial water intake or online effluent monitoring readings.",
  ],
};

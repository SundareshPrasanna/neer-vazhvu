import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Vellore district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/vellore-rivers/, built by scripts/build_vellore_rivers_basin.py. The basin id is "vellore-rivers";
// the district's own scope is "tn-vellore". Scaffolded by scripts/new_district_basin.py.
export const VELLORE_RIVERS: BasinManifest = {
  basinId: "vellore-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Vellore district: rivers, groundwater and industry",
  displayNameLocal: "வேலூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Vellore district in one map: the Palar, which follows the district's south-western line with Tirupathur district for its first 16 km, crosses Gudiyattam, K.V. Kuppam, Anaikkattu, Vellore and Katpadi taluks and leaves along the eastern line with Ranipet district; its tributaries the Ponnai, which runs along that eastern line for 16 km, the Kaundinya, which flows from the Mordhana dam through Gudiyattam, the Agaram Ar and the Kallaparai Ar from the south, and the Malattar in Pernambut taluk with its tributary the Goddar; the Naganadhi on the southern line with Tiruvannamalai district; the Mordhana and Rajathopekanar reservoirs; groundwater extraction by taluk; and the 370 units on Tamil Nadu's industry register. Five of the six taluks extract more groundwater than is recharged, K.V. Kuppam (150.8%) and Anaikkattu (148.1%) the most (2024-2025). 8 of the register's 9 red-category tanneries are in Pernambut taluk, in the Malattar's catchment, 7 of them within 1.4 km of the Goddar in Chinnathamalsiruvu, the village of the Pernambut tannery effluent treatment plant, which the Supreme Court's 1996 judgment lists among seven common plants then operating and which the state reported operating and complying in June 2026. CPCB's 2022 list carried the Palar 'ALONG VANIYAMBADI' (Priority V), upstream in Tirupathur district; the state's reports since September 2025 record that CPCB has delisted it, and no CPCB edition names a place in today's Vellore district. Click a river to scope every layer to its catchment.",
  mapCenter: [12.91, 78.96],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 2207,
  areaNote:
    "Computed from the TNGIS district boundary (2,207.0 sq km). The About page on vellore.nic.in states 'The geographical area of this district is 1336.42 Sq.Kms.' and gives the 2011 population of the undivided district ('39,36,331'); neither matches today's district, and the area is not used. The five catchments are TN WRD's sub-basins cut to the boundary, 2,205.8 sq km in all: Poiney (Ponnai) 920, Kavundinyanadhi 418, Agaramar 360, Cheyyar 266 and Malattar 242; a 0.18 sq km sliver of the Upper Palar sub-basin is dropped. Each continues outside the district; the Cheyyar sub-basin's part here is 6.1% of it.",
  rivers: [
    {
      riverId: "palar",
      displayName: "Palar",
      displayNameLocal: "பாலாறு",
      subHydroshedIds: [],
      color: "#2563eb",
      narrative: "The Palar is the district's main river. TN WRD describes an inter-state river that 'originates in Kolar District in Karnataka, traverses through Andhra Pradesh via Chittoor District and runs through Vellore, Ranipet, Thiruvannamalai, Kancheepuram and Chengalpattu Districts in Tamil Nadu, before confluencing into the Bay of Bengal' (WRD policy note 2025-26, p.156). About 50 km of its main mapped course lies inside the district. For its first 16 km it follows the south-western line with Tirupathur district, from Rajakkal in Pernambut block to Koothambakkam in Gudiyatham block; it then crosses Gudiyattam, K.V. Kuppam, Anaikkattu, Vellore and Katpadi taluks and runs along the eastern line with Ranipet district for its last 5 km. OpenStreetMap also maps a 12.5 km second channel of the river between Kalanipakkam and Karugambathur. The Malattar meets it at the district line near Rajakkal, the Agaram Ar at Olakasi and the Kaundinya at Pasumathur, and the Ponnai joins 1.6 km beyond the eastern line. CGWB records that 'The shallow alluvial aquifer along Palar River provides drinking water supply for a number of urban and rural habitations in the district' (CGWB Vellore brochure, January 2009, p.14; the undivided district). The register places 76 units within 2 km of its main and second channels: 37 green or white, 34 orange and 5 red category (3 other red units and 2 quarries). North of the river in K.V. Kuppam taluk, the Rajathopekanar reservoir stands on the Rajathopu Kanar, a stream that the WRD note says flows 'into Dharapadavedu Tank in Katpadi Taluk' (WRD dam details, 2024); it read 2.3% of capacity (0.48 Mcft, at 4.29 of 24.57 ft) on the state dashboard on 22 October 2026. The Palar has no TN WRD sub-basin of its own in the district: its reach lies in the Poiney (49.3 km) and Kavundinyanadhi (12.6 km) sub-basins, which the Ponnai and Kaundinya cards select, so selecting the Palar keeps every layer in view.",
      attributes: {
        origin: "'originates in Kolar District in Karnataka' (WRD policy note 2025-26, p.156). The district survey report: 'Palar River originates in Nandhi Durg, Kolar district' (Vellore District Survey Report, Department of Geology and Mining, 2018, p.43).",
        length: "About 50 km of the main mapped course inside the district (49.8 km), 16 km of it along the south-western line and 5 km along the eastern line (OSM), plus a 12.5 km second channel, all inside. Whole river: 'about 295' km (Vellore District Survey Report, 2018, p.43; CGWB Vellore brochure, 2009, p.7); 122 km in the undivided district (District Survey Report for sand, 2019, p.68).",
        tributaries: "'Ponnaiyar, Cheyyar, Pambar and Malattar are some of the major tributaries of Palar draining the district' (CGWB Vellore brochure, 2009, p.7; the undivided district). 'Kavundinya Nadi from the northwest and Agaram Ar from the south join the Palar River' (Vellore District Survey Report, 2018, p.74). CWC's river network also has the Periya Ar (32.1 km, all inside the district) and the Otterikaner (17.8 km) joining it in Anaikkattu and Vellore taluks; neither is drawn.",
        flowsInto: "The Bay of Bengal (WRD policy note 2025-26, p.156); the district survey report: 'finally enter into Bay of Bengal near Sadarangapattinam' (2018, p.43).",
        pollutedStretch: "No CPCB edition names a place in today's Vellore district. CPCB's 2022 report listed the Palar 'ALONG VANIYAMBADI' as Priority V, maximum BOD 4.0 mg/l on 2019 and 2021 data (p.35), from one station, 'RIVER PALAR AT VANIYAMBADI WATER SUPPLY HEAD WORK, TAMILNADU' (p.61). CPCB's own record places that station at 12.6792 N, 78.5954 E (National Water Data Portal, CPCB water quality), in Vaniyambadi taluk of Tirupathur district, 18.5 km outside this district. The September 2018 and October 2025 reports do not name the Palar (text search). The state's reports to NMCG record that the action plans 'for Palar and Amaravathi have been approved by River Rejuvenation Committee and are under implementation' (MPR, June 2026, p.74) and, from September 2025: 'Based on the water quality data for the year 2022-2023, CPCB has delisted Amaravathi and Palar River from the list of PRS' (MPR, September 2025, p.63; June 2026, p.6). An earlier CPCB report, of February 2015, listed the Palar 'VANIYAMBADI TO MINNUR' as Priority II, with the towns printed as 'VANIYAMBADI, VELLORE' (p.63; archived copy of CPCB's file); it does not say whether 'Vellore' is the town or the then district.",
        restorationInitiatives: "The state's June 2026 report lists two sewage treatment plants at Vellore, 10.28 MLD in operation with 7.5 MLD in use and 50 MLD under trial run, both 'Complied' (p.19), and a 9 MLD plant for Gudiyatham, marked PRS, 6% complete in June 2026 with a May 2027 timeline (p.10). WRD's 2024-25 note lists among on-going schemes the 'Construction of 2 Nos. of Sub surface Dyke across Palar River and 1 No. of Artificial Recharge Structure across Malattar River at an estimated cost of Rs.72.72 crore to benefit an ayacut of 4533.05 acre in Ranipet, Vellore and Villupuram Districts.' (WRD policy note 2024-25, p.155). On the state's suits over Andhra Pradesh's works across the Palar, the WRD note records: 'This matter is also pending in the Supreme Court.' (WRD policy note 2025-26, p.158).",
      },
    },
    {
      riverId: "ponnai",
      displayName: "Ponnai",
      displayNameLocal: "பொன்னை",
      subHydroshedIds: ["SB96"],
      color: "#0891b2",
      narrative: "The Ponnai enters the district from Andhra Pradesh at its northern tip near Thengal and, for 16 of its 20 km inside, runs along the district's eastern line with Ranipet district, from Errukkampattu down to Kuppathamottur; it meets the Palar 1.6 km beyond the line. CWC's river network traces it from Thotathimmaiah Palle in Chittoor district to the Palar at Nandiyalam in Ranipet district, 75.1 km. CWC's gauge at Thiruvalam, which plots 0.3 km from its mapped course (the data portal files the station under the Palar, with the Poini as tributary), recorded daily flow from June 2018 to April 2026: the flow was zero on at least three in ten of its readings, and the highest monthly mean was 215.73 cumec in November 2021. The Poiney Anicut System's West Main Canal runs 10.0 km inside the district, and CWC maps 903 ha of the system's command area here (culturable command area 9.24 thousand ha, benefiting Vellore and Ranipet districts). TNPCB's 2020 plan for the Ranipet CEPI area samples the 'Ponnai River (Sikkarajapuram)' at a point 0.05 km outside this district's line (p.29). Selecting the Ponnai scopes the map to TN WRD's Poiney sub-basin, 920 sq km in the district, which also takes in the Palar's 49 km reach through K.V. Kuppam, Anaikkattu, Vellore and Katpadi taluks and holds 261 of the register's 367 industrial units. Katpadi taluk, all but 1 sq km of it in this sub-basin, extracts 83.7% of its groundwater recharge (semi-critical) and K.V. Kuppam taluk 150.8% (over-exploited, 2024-2025).",
      attributes: {
        origin: "Andhra Pradesh: CWC's river network starts it at Thotathimmaiah Palle, Pakala, Chittoor district. The sand survey report gives 'Andhar Pradesh', at 412 m (District Survey Report for sand, 2019, p.68).",
        length: "20.3 km inside the district, 19.0 km of it within 300 m of the eastern line (OSM mapped course). Whole river: 75.1 km in CWC's river network; 36 km in the undivided district (District Survey Report for sand, 2019, p.68).",
        tributaries: "None inside the district in CWC's river network; its tributary the Niva joins it in Chittoor district.",
        flowsInto: "The Palar, at Nandiyalam in Wallajah taluk of Ranipet district (CWC river network), 1.6 km beyond the district line on the map.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search). TNPCB's 2020 plan for the Ranipet CEPI area notes that 'River Ponnai is running at a distance of 2 Km from the CEPI core zone' (p.9).",
        restorationInitiatives: "The district administration's notices list demonstration plots of the state's water and land resources project (நீர்வள நிலவள திட்டம், phase 4) in the 'பொன்னை ஆறு உபவாடிநிலை பகுதி', the Ponnai river sub-basin area, for 2023-2024 and 2024-2025 (vellore.nic.in, notices). No other scheme specific to the Ponnai in the district was found in the documents read.",
      },
    },
    {
      riverId: "kaundinya",
      displayName: "Kaundinya",
      displayNameLocal: "கௌண்டன்யா மகாநதி",
      subHydroshedIds: ["SB92"],
      color: "#7c3aed",
      narrative: "The Kaundinya flows south-east from the Mordhana reservoir, about 1 km inside the district's northern line, through Gudiyattam taluk to the Palar at Pasumathur. WRD records that the 'Mordhana dam was constructed across Koundinyanadhi near Gudiyatham Taluk of Vellore District', that the river 'originates and flows from Punganur in Palamaner Taluk of Andhra Pradesh', and that 'Koundinyanadhi is a major tributary of Palar River'; the dam serves 'existing ayacuts of 3387 hectares' and was 'completed on 21.03.2001 and storage commenced' (WRD dam details, 2024). The reservoir, beside Morthana village panchayat, read 14.4% of capacity (37.69 Mcft, at 2.13 of 37.73 ft) on the state dashboard on 22 October 2026. About 27.7 km of the river's mapped course is inside the district, 25.1 km of it in Gudiyattam taluk, past Seevoor, Thazhaiyatham and Sempalli; CWC's Godd Ar joins it at Perumbadi. In Gudiyattam town WRD lists a walking track on its left bank among works in progress (WRD policy note 2025-26, p.97). The register places 12 units within 2 km of it (9 green or white, 1 orange, 1 tannery and 1 quarry). Its sub-basin, TN WRD's Kavundinyanadhi, covers 418 sq km of the district, and Gudiyattam taluk extracts 120.5% of its groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "'Punganur in Palamaner Taluk of Andhra Pradesh' (WRD dam details, 2024, Mordhana Dam entry). CWC's river network starts it at Karangi, Srinivaspur taluk, Kolar district, Karnataka.",
        length: "27.7 km inside the district, 25.1 km in Gudiyattam taluk (OSM mapped course, named Kaundinya Mahanadhi). Whole river: 123.4 km in CWC's river network; 48 km in the undivided district from the 'Mordhana dam' (District Survey Report for sand, 2019, p.68).",
        tributaries: "CWC's river network has the Godd Ar joining it at Perumbadi, Gudiyattam taluk (19.2 km of it inside the district; not drawn). No other tributary is named in the documents read.",
        flowsInto: "The Palar: 'Kavundinya Nadi from the northwest and Agaram Ar from the south join the Palar River' (Vellore District Survey Report, 2018, p.74). On the map it meets the Palar at Pasumathur, K.V. Kuppam block.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search).",
        restorationInitiatives: "Sub-surface dyke across the Koundanya Nadhi at Seevoor village, Gudiyatham taluk, Rs.384.00 lakh, among the schemes inaugurated through video conferencing on 08.06.2015 (PWD policy note 2015-16, pp.21-22). Artificial recharge wells at two tanks, Katpadi and Karigiri, in the Koundanyanadhi sub-basin, Rs.0.95 crore, works in progress (PWD policy note 2014-15, p.153). A well syphon across the Palar for the Mordhana Right Main canal near Chittathur, Rs.1.40 crore, completed: an 'ayacut of 3405 acre under 7 tanks receives assured supply from the Mordhana Reservoir.' (PWD policy note 2014-15, p.78). The Mordhana dam is among the dams whose rehabilitation under DRIP is reported completed (PWD policy note 2016-17, p.43). On-going in 2024-25: a vented causeway across the river, Rs.13.70 crore, and a road on the right bank 'from Thalayatham to Sempalli' with a walking track on the left bank, Rs.33.11 crore (WRD policy note 2024-25, pp.155-156); in progress in 2025-26: the walking track in Gudiyattam town, Rs.2.92 crore (WRD policy note 2025-26, p.97). The state's June 2026 report lists Gudiyattam's 0.03 MLD faecal sludge treatment plant in operation, 'Complied' (p.23).",
      },
    },
    {
      riverId: "agaram",
      displayName: "Agaram Ar",
      displayNameLocal: "அகரம் ஆறு",
      subHydroshedIds: ["SB90"],
      color: "#d97706",
      narrative: "The Agaram Ar flows north through Anaikkattu taluk to the Palar at Olakasi, in Gudiyatham block. The district survey report records that 'Kavundinya Nadi from the northwest and Agaram Ar from the south join the Palar River' and that 'Two major tributaries Kallparai Ar and Uttalum Ar join the Agaram Ar' (Vellore District Survey Report, 2018, p.74). OpenStreetMap maps it as a 15.9 km course, all inside the district and 13.2 km of it in Anaikkattu taluk, beginning near Guruvarajapalayam, where CWC's Kovilmalai/Uttarakaveri Aru comes in. CWC's river network names this same reach the lower Kallaparai Ar; on this map it is drawn once, as the Agaram Ar, and the Kallaparai Ar card draws the course above it. Its sub-basin, TN WRD's Agaramar, covers 360 sq km of the district (61.8% of the sub-basin) and holds 22 of the register's 367 industrial units (10 green or white, 5 orange, 6 quarries and 1 other red unit). Anaikkattu taluk extracts 148.1% of its groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "'Alangayam RF', at 434 m (District Survey Report for sand, 2019, p.68).",
        length: "15.9 km, all inside the district (OSM mapped course, named Agaram Ar). 75 km in the undivided district (District Survey Report for sand, 2019, p.68).",
        tributaries: "'Two major tributaries Kallparai Ar and Uttalum Ar join the Agaram Ar' (Vellore District Survey Report, 2018, p.74).",
        flowsInto: "The Palar (Vellore District Survey Report, 2018, p.74); on the map at Olakasi, Gudiyatham block.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search).",
        restorationInitiatives: "The district administration's notices list demonstration plots of the state's water and land resources project (நீர்வள நிலவள திட்டம்) in the 'அகரம் ஆறு உபவடிநில பகுதி', the Agaram river sub-basin area: phase 2 in 2021-22 and phase 4 in 2022-23 (vellore.nic.in, notices). No other scheme specific to the Agaram Ar was found in the documents read.",
      },
    },
    {
      riverId: "kallaparai",
      displayName: "Kallaparai Ar",
      subHydroshedIds: [],
      color: "#a16207",
      narrative: "The Kallaparai Ar is drawn from CWC's river network, because OpenStreetMap does not name it in full inside the district. CWC traces it from the Alangayam reserved forest in Tirupathur district to the Palar at Chithathoor in Gudiyatham, 49.0 km. Its lower 15.9 km is the course drawn on this map as the Agaram Ar, so the Kallaparai Ar is drawn only above it: 30.8 km, 28.6 km of it inside the district and all of that in Anaikkattu taluk, ending at Kuppampattu, 0.1 km from where the Agaram Ar begins and where CWC's Kovilmalai/Uttarakaveri Aru comes in. The district survey report treats the Kallaparai as a tributary of the Agaram Ar: 'Two major tributaries Kallparai Ar and Uttalum Ar join the Agaram Ar' (Vellore District Survey Report, 2018, p.74). Three short streams from the Karuthamalai and Vellakuttai reserved forests join it upstream. The register places one unit within 2 km of the drawn course, an orange-category unit. Its catchment is TN WRD's Agaramar sub-basin, which the Agaram Ar card selects, so selecting the Kallaparai Ar keeps every layer in view.",
      attributes: {
        origin: "The Alangayam reserved forest, Vaniyambadi taluk, Tirupathur district (CWC river network).",
        length: "30.8 km drawn, 28.6 km of it inside the district, all in Anaikkattu taluk (CWC river network line, above the Agaram Ar). CWC's whole line is 49.0 km, 44.7 km of it inside the district; its lower 15.9 km is the course drawn as the Agaram Ar. No other official length was found.",
        tributaries: "In CWC's river network: the Kanni Aru, the Karadi Pallam and the Tirtham Ar upstream; the Kovilmalai/Uttarakaveri Aru (8.4 km, all inside the district) comes in at the drawn course's lower end.",
        flowsInto: "The Agaram Ar on this map, and with it the Palar. CWC continues the Kallaparai Ar down that course to the Palar at Chithathoor, Gudiyatham; the district survey report has the Kallaparai joining the Agaram Ar (2018, p.74).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search).",
        restorationInitiatives: "No known public record of a restoration scheme for the Kallaparai Ar in the documents read.",
      },
    },
    {
      riverId: "naganadhi",
      displayName: "Naganadhi",
      displayNameLocal: "நாகநதி",
      subHydroshedIds: ["SB91"],
      color: "#0d9488",
      narrative: "The Naganadhi rises in the Kathalampattu reserved forest of Vellore taluk and runs along the district's southern line with Tiruvannamalai district before leaving it near Kilpallipattu. CWC's river network traces the Naganadi from the Kathalampattu reserved forest in Vellore taluk to Kuppam in Arani taluk of Tiruvannamalai district, 22.8 km, where it joins the Kamandala Naganadi, a tributary of the Cheyyar. OpenStreetMap names the course Kamandala Naga; its 21.3 km mapped line here follows CWC's Naganadi for 15.4 km and its upstream feeder, the Amerdiar, for 6.4 km. 11.9 km lies inside the district, 10.8 km of it in Vellore taluk, past Thuthikadu, Kathalampet and Vallam, and 8.1 km within 300 m of the line. In his radio address of 26 September 2021 the Prime Minister said: 'Take a look at Vellore and Thiruvannamalai districts of Tamilnadu, whose example I wish to cite. A river named Naagnadi flows there. Years ago, the Naagnadi had all dried up.' He said that the women there 'constructed check dams and recharge-wells' and that 'today, the river is brimming with water' (Mann Ki Baat, 81st episode, pmindia.gov.in). The district administration's website carries a video titled 'Naganathi River Rejuvenation Programme' (vellore.nic.in, page last updated 05.07.2018), and in the 2019 National Water Awards Vellore was the South zone's Best District in Revival of Rivers (PIB, 11 November 2020; an award for 2019, the year Ranipet and Tirupathur districts were carved from Vellore). None of these gives the number of structures, the scheme that paid for them or the years of work. Selecting it scopes the map to the part of TN WRD's Cheyyar sub-basin inside the district, 266 sq km (6.1% of that sub-basin), through which the Naganadhi and its feeders flow; Vellore taluk extracts 112.3% of its groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "The Kathalampattu reserved forest, Vellore taluk (CWC river network, Naganadi).",
        length: "11.9 km inside the district, 10.8 km in Vellore taluk, 8.1 km of it within 300 m of the southern line; 21.3 km mapped (OSM, named Kamandala Naga). CWC's Naganadi: 22.8 km.",
        tributaries: "In CWC's river network the Amerdiar, which rises in the Sandavasal reserved forest in Polur taluk and is joined by the Teniyur Aru, ends where the Naganadi begins; the Tellaiar and the Isanayakanodappu also join the Naganadi inside the district.",
        flowsInto: "The Kamandala Naganadi at Kuppam, Arani taluk, Tiruvannamalai district, which joins the Cheyyar (CWC river network). The sand survey report lists '7.Naganadhiar' and '6.Kamandalar' among the Palar basin's important tributaries (2019, p.36).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search).",
        restorationInitiatives: "Check dam across the 'Naganadhi river near Kathalampattu' village in Vellore taluk, Rs.2.60 crore, in progress with 30% of the work completed; by it 'ground water will be' recharged in the adjacent areas (PWD policy note 2016-17, p.126). No later status was found. The rejuvenation the Prime Minister described in 2021 and the district's 2018 video record are cited above; no official record read gives the number of recharge wells or check dams, the scheme that paid for them or the years of work, and the figures in media and NGO reports differ, so none is used.",
      },
    },
    {
      riverId: "malattar",
      displayName: "Malattar",
      subHydroshedIds: ["SB95"],
      color: "#db2777",
      narrative: "The Malattar is drawn from CWC's river network, because OpenStreetMap does not name it inside the district. CWC traces it from Yalakallu in Chittoor district to the Palar at Vadapudupattu in Ambur taluk of Tirupathur district, 26.2 km; 18.4 km lies inside the district, all in Pernambut taluk, and it runs along the district line for its first 4.5 km and its last 2.8 km, past Bathalapalli, Masigam and Machampattu to Rajakkal. In CWC's network two streams named Goddar Vanka join it, at Bathalapalli and at Chinnadamal Cheruvu (the second is drawn as the Goddar), and the Tlingal Eru at Masigam. Its sub-basin, TN WRD's Malattar, 243 sq km in the district, holds 8 of the register's 9 red-category tanneries, 7 of them in Chinnathamalsiruvu village, where the TALCO Pernambut tannery effluent treatment plant stands 1.5 km from the Malattar and 0.2 km from the Goddar. The Supreme Court's judgment of 28 August 1996 quotes its order listing '7. M/s. TALCO Pernambut Tannery Effluent Treatment Co. Ltd., Bakkalapalli, Pernambut, Dist. North Arcot Ambedkar.' among seven common plants then in operation, and records that 'The CETPs mentioned at Sl. Nos. 5, 6 & 7 were commissioned in January, 1996' (p.7). TNPCB's 2020 list gives the plant 36 member tanneries and a consented 891 KLD, of which 600 KLD is permitted (p.1); the state's June 2026 report lists it in operation with 35 member units, its online monitoring connected to TNPCB, consent valid up to 31/3/2028 and status 'Complied' (p.55). Pernambut taluk extracts 106.3% of its groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "Yalakallu, Venkatagirikota, Chittoor district, Andhra Pradesh (CWC river network). The sand survey report gives the 'Bathalapalli dam' as its place of origin in the district, at 359 m (District Survey Report for sand, 2019, p.68).",
        length: "18.4 km inside the district, all in Pernambut taluk (CWC river network line); 26.2 km in all (CWC). 22 km in the undivided district (District Survey Report for sand, 2019, p.68).",
        tributaries: "In CWC's river network: two streams named Goddar Vanka (28.5 km, all inside the district, from the Mordhana reserved forest to Chinnadamal Cheruvu, drawn as the Goddar; and 21.9 km from Baireddipalle in Chittoor district to Bathalapalli, not drawn) and the Tlingal Eru (to Masigam). The sand survey report names 'Goddar' among the district's rivers (2019, p.5).",
        flowsInto: "The Palar, at Vadapudupattu, Ambur taluk, Tirupathur district (CWC river network), just beyond the district line near Rajakkal. CGWB names the Malattar among the Palar's major tributaries (Vellore brochure, 2009, p.7).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search). For the undivided district as a whole, CGWB's 2009 brochure records that 'The pollution from tanneries has caused irrevocable deterioration of quality of ground water and soil in vast areas.' (p.12).",
        restorationInitiatives: "Earth dam, spillway and river sluices across the Malattar at Bathalapalli village, Rs.29.55 crore, for an ayacut of 4,243 acres: 28% of the work completed (PWD policy notes 2016-17, p.114, and 2017-18, p.115); 'under implementation' in 2018-19 (p.100). No later status was found, and the TN WRD reservoir register on TNGIS has no Bathalapalli reservoir. A diaphragm wall across the Malattar near Masigam village, Rs.3 crore, 'will commence soon', for an 'ayacut of 378 acres will be benefited through 36 wells' (PWD policy note 2017-18, p.146). The state's June 2026 report lists a 5 MLD sewage treatment plant for Pernambut, 15% complete in June 2026 with a December 2026 timeline (p.10).",
      },
    },
    {
      riverId: "goddar",
      displayName: "Goddar",
      subHydroshedIds: [],
      color: "#c2410c",
      narrative: "The Goddar is drawn from CWC's river network, which names it Goddar Vanka; OpenStreetMap does not map it. Its 28.5 km course lies wholly inside the district, in Pernambut taluk: CWC traces it from the Mordhana reserved forest, 0.3 km inside the district's northern line, south to the Malattar at Chinnadamal Cheruvu, and on the map it runs past Sathgur, Gundalapalli, Kothapalli, Erikuthi and Chinnathamalcheruvu village panchayats to meet the Malattar in Balur. The sand survey report for the undivided district names it among the district's rivers: 'The other rivers are Goddar, Agaram aru, Koundinya nathi, Malattar river and Ponnai river which are seasonal carriers flood water and confluence in to River Palar.' (District Survey Report for sand, 2019, p.5). It runs through the district's tannery cluster at Chinnathamalsiruvu: the TALCO Pernambut tannery effluent treatment plant stands 0.22 km from it, and 7 of the register's 9 red-category tanneries lie 0.13 to 1.34 km from it. The register places 23 units within 2 km of it, 21 of them in Chinnathamalsiruvu village: 7 tanneries, 2 glue and gelatin units, 2 slaughterhouse units, 11 orange-category units (6 of them animal feed units and 1 a dry tanning unit) and 1 green unit. A second CWC stream named Goddar Vanka, from Baireddipalle in Chittoor district to the Malattar at Bathalapalli, is not drawn. The Goddar's catchment lies in TN WRD's Malattar sub-basin, which the Malattar card selects, so selecting the Goddar keeps every layer in view.",
      attributes: {
        origin: "The Mordhana reserved forest, Pernambut taluk (CWC river network, Goddar Vanka).",
        length: "28.5 km, all inside the district and all in Pernambut taluk (CWC river network line). No official length was found.",
        tributaries: "None named in the documents read. The Kukkiloni Vanka and the Vattalu Vanka of CWC's network join the other, undrawn Goddar Vanka.",
        flowsInto: "The Malattar (CWC river network); on the map in Balur village panchayat. The sand survey report lists the 'Goddar' among streams that 'confluence in to River Palar' (2019, p.5); the district statistical handbook 2016-17 lists '4. Goddar' among the district's rivers (p.21). Both are for the undivided district, which also held a Goddar near Natrampalli (WRD policy note 2025-26, p.56), so neither says which stream.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search).",
        restorationInitiatives: "No known public record of a restoration scheme for the Goddar in the documents read. The TALCO Pernambut tannery effluent treatment plant beside it is in operation with 35 member units, consent valid up to 31/3/2028 and status 'Complied' (Tamil Nadu report to NMCG, June 2026, p.55); its record is on the Malattar card.",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Vellore", TN_WRD_CATCHMENTS, "Rivers"),
    CWC_CANALS,
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a CWC level chart (tap)", "Reservoir with no level chart (its card gives the day's storage where the state dashboard reports it)"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow (CWC gauge)", "CWC gauge: daily river flow (tap for charts)"),
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    tnpcbIndustries([], "Orange category"),
    { family: "industrial-estates", label: "SIPCOT Katpadi", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "cetp-operating",
        label: "Common effluent treatment plant (tanneries): operating",
        color: "#7e22ce",
      },
      {
        value: "stp",
        label: "Sewage and faecal sludge treatment plants",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "poiney-anicut-system",
        label: "Poiney Anicut System",
        color: "#0891b2",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels (8 watersheds, 22 sub-watersheds, 61 mini-watersheds and 311 micro-watersheds in the district), reservoirs, water bodies and named tanks: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency. TNGIS's mine-lease layer holds no lease in the district.",
    "Water bodies: the TNGIS all-water-bodies register, 1,210 outlines in the district (286 named or 5 ha and above, 924 smaller), 233 of which carry a name; area is computed from each outline. Named tanks are the 231 the all-tanks register names. The 247 village panchayats cover 1,205 of the district's 2,207 sq km: town panchayats, municipalities, the corporation and reserve forest are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL) for the Palar, Ponnai, Kaundinya (OSM's Kaundinya Mahanadhi), Agaram Ar and Naganadhi (OSM's Kamandala Naga); CWC's river network on the National Water Data Portal for the Malattar, the Kallaparai Ar and the Goddar (CWC's Goddar Vanka), which OpenStreetMap does not name in full inside the district. All are clipped to the district plus 1.6 km so that the rivers along the district line stay on the map. OpenStreetMap maps a 12.5 km second channel of the Palar between Kalanipakkam and Karugambathur; CWC's Kallaparai Ar is drawn only above the Agaram Ar, whose 15.9 km course CWC names as the Kallaparai's lower reach; of CWC's two streams named Goddar Vanka, the one through Chinnathamalsiruvu is drawn as the Goddar.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Poiney Anicut System's West and East Main Canals (10.6 km inside the district) and 903 ha of its command area. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area (9.24 thousand ha) is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 370 units in the district (78 red, 163 orange and 129 green or white category), filed under TNPCB's District Environmental Engineer offices at Vellore and Vaniyambadi. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code.",
    "Treatment plants: the 3 on the register, the TALCO Pernambut tannery CETP, the Gudiyatham municipality faecal sludge treatment plant and one private developer's sewage plant at Arumparuthi. The CETP shows its status in the state's June 2026 progress report to NMCG (p.55) and its consented and permitted quantities in TNPCB's 2020 tannery CETP list (p.1). The state lists no other tannery CETP in today's Vellore district; those at Ambur, Vaniyambadi and Ranipet are in Tirupathur and Ranipet districts.",
    "SIPCOT industrial estate: SIPCOT GIS (sipcotgis.tn.gov.in), the Katpadi complex outline. SIPCOT's own area field for it (211,853.1) does not fit the outline, so no area is shown.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 8 CGWB and 9 Tamil Nadu state telemetry stations (six-hourly, 2026) and 30 CGWB manual wells (readings from January 2021 to August 2024). Depth is in metres below ground level; each well shows its latest reading and date.",
    "Reservoirs: TN WRD's register on TNGIS, two waterspreads: Mordhana (Morthana village panchayat, on the Kaundinya) and Rajathopekanar (Chenji village panchayat, K.V. Kuppam taluk). Storage for both comes from the state's daily reservoir dashboard (TN-SMART, relayed by RIMES), with the reading's date: depth in feet, storage in Mcft and percentage of capacity, as it prints them. The dashboard's Rajathopekanar point sits 8 km from the register's outline and is matched to it by name.",
    "River flow: CWC's gauge, discharge and water quality site at Thiruvalam, from the National Water Data Portal: daily discharge from June 2018 to April 2026 (2,104 readings); the portal holds no water quality readings for it.",
    "Polluted stretch: none is drawn. No CPCB edition (September 2018, 2022, October 2025) names a place in today's Vellore district; the 2022 Palar listing is 'ALONG VANIYAMBADI', in Tirupathur district, and the state's progress reports to NMCG since September 2025 record its delisting. Each is cited by page on the Palar card.",
    "CEPI area: none is drawn. TNPCB's January 2020 plan for the CEPI area of SIPCOT Ranipet (then in Vellore district) prints 28 points; its core zone lies 2.8 to 5.6 km outside today's Vellore district, and one impact-zone point, the government higher secondary school at Thiruvalam, falls inside, in Katpadi taluk.",
  ],
};

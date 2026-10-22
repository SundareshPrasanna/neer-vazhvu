import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, TN_ADMIN,
} from "./district-layers";

// Tirupathur district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/tirupathur-rivers/, built by scripts/build_tirupathur_rivers_basin.py. The basin id is "tirupathur-rivers";
// the district's own scope is "tn-tirupathur". Scaffolded by scripts/new_district_basin.py.
export const TIRUPATHUR_RIVERS: BasinManifest = {
  basinId: "tirupathur-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Tirupathur district: rivers, groundwater and industry",
  displayNameLocal: "திருப்பத்தூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Tirupathur district in one map: the Palar, which comes in from Andhra Pradesh and runs 48 km inside the district through Vaniyambadi and Ambur, joined by the Kal Ar from Natrampalli, the Gorautakan Ar at Ambur and the Malattar on the northern line; the Kallaparai Ar, which drains the district's eastern edge to the Palar in Vellore district; the Pambar, which drains the south-west to the Pennaiyar past Andiappanur Odai reservoir; the Cheyyar, which rises on the south-eastern edge in the Javadhu hills, with Kuppanatham reservoir just across the line; groundwater extraction by taluk; and the 384 industrial units on Tamil Nadu's own register, 75 of them tanneries (51 in Ambur taluk, 23 in Vaniyambadi). All four taluks extract more groundwater than is recharged: Natrampalli 165.5%, Ambur 150.0%, Tiruppattur 141.3% and Vaniyambadi 131.5% (2024-2025). CPCB's 2022 list carried the Palar 'ALONG VANIYAMBADI' at Priority V; the state's reports to NMCG record from September 2025 that CPCB has delisted it on 2022-2023 data, and CPCB's October 2025 list does not name it. The state's June 2026 report lists three tannery common effluent treatment plants in the district, at Vaniyambadi and Ambur, all in operation. Click a river to scope every layer to its catchment.",
  mapCenter: [12.59, 78.65],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 2020,
  areaNote:
    "Computed from the TNGIS district boundary (2,019.8 sq km). The seven catchments are TN WRD's sub-basins cut to that boundary, 2,015.3 sq km in all after a 3.5 sq km sliver of the Matturar sub-basin is dropped: Pambar 851, Upper Palar 736, Cheyyar 161, Agaramar 149, Kavundinyanadhi 49, Pambar to Thirukovilur 48 and Malattar 23. Each continues outside the district except the Upper Palar, 99.9% of which lies inside.",
  rivers: [
    {
      riverId: "palar",
      displayName: "Palar",
      displayNameLocal: "பாலாறு",
      subHydroshedIds: ["SB97", "SB92"],
      color: "#1d4ed8",
      narrative: "The Palar comes into Tamil Nadu from Andhra Pradesh's Chittoor district (WRD policy note 2025-26, p.156), and TNPCB names Kodayanchi village as its entry into this district: its December 2024 report to the Supreme Court gives 'the average TDS of surface water in the year 2023 at the entry of the Tirupathur District at Kodayanchi village is 591 mg/l' (Supreme Court judgment, 30 January 2025, p.20). 58.5 km of its mapped course runs along or inside the district, 48.3 km of it inside the line: 19.8 km in Vaniyambadi taluk and 28.6 km in Ambur taluk. These are the tannery towns: the 2025 judgment records that 'More than 600 tanneries are situated in various clusters of Vaniyambadi, Ambur, Ranipet, Pernambut in the Vellore District.' (p.6), meaning the district as it stood before Tirupathur was carved out of it in 2019. Its two catchments here, the Upper Palar and Kavundinyanadhi sub-basins (784.1 sq km), hold 326 of the register's 384 industrial units and 74 of its 75 tanneries; 47 tanneries lie within 1 km of the mapped course and 69 within 2 km, and both tannery common effluent treatment plants on the register, Vanitec at Valayampattu and the Ambur plant's Thuthipet sector, stand within 1 km of it (0.45 and 0.87 km). TNPCB's 2024 report states that 'All the CETPs and IETPs that are located along the stretch of the Palar River have provided ZLD system and are operating the same' (judgment, p.20). CWC's gauge at Avarankuppam, 0.7 km inside the district line, recorded a monthly mean flow of zero in 211 of the 527 months with readings since June 1978; its samples averaged a BOD of 1.05 mg/l in 2021 and in 2022. Vaniyambadi and Ambur taluks extract 131.5% and 150.0% of their groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "The Palar 'originates in Kolar District in Karnataka, traverses through Andhra Pradesh via Chittoor District' (TN WRD policy note 2025-26, p.156).",
        length: "58.5 km along or inside the district (OpenStreetMap mapped course), 48.3 km of it inside the district line. WRD's Upper Palar sub-basin, which this reach drains, is 736.179 sq km (WRD Palar basin page); 735.5 sq km of it, 99.9%, lies in this district. No official whole-river length was found in the documents read.",
        tributaries: "In the district, the Kal Ar, which crosses Natrampalli taluk and joins at Vaniyambadi, the Gorautakan Ar, which joins at Ambur, and the Malattar, which joins near the northern district line in Ambur taluk (CWC river network, confluence fields). CWC's network also names shorter streams that reach the Palar in Ambur taluk, among them the Periyakaram Ar, Periya Kanar and Mulamaduvu Kanar; WRD lists only the Palar for the Upper Palar sub-basin (WRD Palar basin page).",
        flowsInto: "The Bay of Bengal. WRD writes that it 'runs through Vellore, Ranipet, Thiruvannamalai, Kancheepuram and Chengalpattu Districts in Tamil Nadu, before confluencing into the Bay of Bengal.' (WRD policy note 2025-26, p.156); that sentence does not name Tirupathur district.",
        pollutedStretch: "CPCB, September 2018: not listed; the report does not mention the Palar (text search). CPCB, 2022: Priority V, 'ALONG VANIYAMBADI', maximum BOD 4.0 mg/l on 2019 and 2021 monitoring (Table 27, p.35), at station 1450, 'RIVER PALAR AT VANIYAMBADI WATER SUPPLY HEAD WORK, TAMILNADU' (Annexure I, p.61). CPCB's coordinates for that station on the National Water Data Portal fall 0.02 km from the mapped course, inside Vaniyambadi taluk; its six 2021 samples there read BOD 2.4 to 4 mg/l. The state's reports to NMCG listed the Palar under Priority V up to August 2025 (MPR, August 2025, p.67) and from September 2025 state: 'Based on the water quality data for the year 2022-2023, CPCB has delisted Amaravathi and Palar River from the list of PRS.' (MPR, September 2025, p.63; June 2026, p.6). CPCB, October 2025: not listed; the report does not mention the Palar (text search).",
        restorationInitiatives: "The state's June 2026 report to NMCG records that 'The Action Plans for Palar and Amaravathi have been approved by River Rejuvenation Committee and are under implementation.' and that copies were sent to CPCB and the Ministry of Jal Shakti in October 2024 (p.74); the plan is not on TNPCB's polluted river stretches page (checked 22 October 2026). The same report lists Ambur's sewage treatment plant at 16.71 MLD, with 9.75 MLD in use (p.21), Vaniyambadi's 12.5 MLD plant at 5% complete with a completion timeline of February 2028 (p.10), and a 0.03 MLD faecal sludge plant for Vaniyambadi under construction (p.31). On 30 January 2025 the Supreme Court directed the State to 'formulate and implement a comprehensive rejuvenation plan for the Palar River, which includes removing pollutants, desilting, and ensuring adequate water flow' (2025 INSC 131, p.111).",
      },
    },
    {
      riverId: "kal-ar",
      displayName: "Kal Ar",
      subHydroshedIds: [],
      color: "#0369a1",
      narrative: "The Kal Ar crosses the district's west to the Palar: CWC's line starts at T Sadumur in Kuppam mandal of Andhra Pradesh and runs 34.2 km inside the district, 30.0 km of it through Natrampalli taluk, to the Palar at Vaniyambadi (CWC river network). The Oddu Kanar, 22.9 km long and wholly inside the district, joins it at Vaniyambadi from the Alangayam reserve forest (CWC river network). WRD's proposed Pennaiyar (Nedungal anicut) to Palar link would divert Pennaiyar flood water 'to Kallar, which is a tributary of Palar.' (WRD policy note 2024-25, p.102); the 2025-26 note describes the same scheme as a new canal 'to connect Palar River near Natrampalli through Goddar River.' (p.56). Neither note prints a map, so whether WRD's Kallar or Goddar is this Kal Ar is not confirmed. The Kal Ar has no WRD sub-basin of its own (it lies in the Upper Palar sub-basin, which the Palar card selects), so selecting it keeps every layer in view. Natrampalli taluk extracts 165.5% of its groundwater recharge, the highest share of the district's four taluks (over-exploited, 2024-2025).",
      attributes: {
        origin: "CWC's line starts at T Sadumur, Kuppam mandal, Chittoor district, Andhra Pradesh (CWC river network record, UID 4146). No official text read describes its source.",
        length: "34.2 km inside the district and 35.8 km along or inside it (CWC river network); CWC's line is 38.5 km.",
        tributaries: "The Oddu Kanar, whose CWC record gives its confluence as the Kal Ar at Vaniyambadi (CWC river network record, UID 3926).",
        flowsInto: "The Palar at Vaniyambadi (CWC river network record: end village Vaniyambadi M, confluence Palar).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names a Kal Ar or Kallar (text search).",
        restorationInitiatives: "The Pennaiyar (Nedungal anicut) to Palar link: the National Water Development Agency's draft project report was 'for Rs.648.23 Crore and submitted to Government of Tamil Nadu on 06.08.2018.' (WRD policy note 2025-26, p.55); by the 2025-26 note, 'an ayacut of 24,329 acres will be benefitted in Pochampalli and Krishnagiri Taluks of Krishnagiri District and Tirupattur, Natrampalli and Vaniyambadi Taluks of Tirupattur District, through the recharge of wells.' (p.56).",
      },
    },
    {
      riverId: "gorautakan",
      displayName: "Gorautakan Ar",
      subHydroshedIds: [],
      color: "#a21caf",
      narrative: "The Gorautakan Ar crosses Ambur taluk from west to east to the Palar: CWC's line starts in the Karapattu reserve forest and ends at Ambur municipality, 16.3 km in all and wholly inside the district (CWC river network, UID 4149). Its downstream end meets the Palar's mapped course. Its upper course runs through Arangaldurgam village panchayat and its lower course through Venkatasamuthiram, Devalapuram and Thuthipattu: 58 register units lie within 1 km of the line, 16 of them tanneries (12 in Thuthipattu village), and 40 tanneries lie within 2 km, 17 of them at Periavarikkam, where the register places the Ambur tannery CETP's Thuthipet sector plant, 1.8 km from the line. Of the 16 tanneries within 1 km, 15 are also within 1 km of the Palar, so these counts overlap with the Palar card's. CWC's network joins the Dentakan Ar (16.5 km), the Seshanabail Vanka (11.8 km) and the Tottimadugu Vanka to it. The river has no WRD sub-basin of its own (it lies in the Upper Palar sub-basin, which the Palar card selects), so selecting it keeps every layer in view. Ambur taluk extracts 150.0% of its groundwater recharge (over-exploited, 2024-2025). No WRD, TNPCB, CPCB or court document read names the river.",
      attributes: {
        origin: "Karapattu R F, Ambur subdistrict, Tirupathur district (CWC river network record, UID 4149, start village). No official text read describes its source.",
        length: "16.3 km, wholly inside the district and all in Ambur taluk (CWC river network); CWC's length field gives 16.28 km.",
        tributaries: "The Dentakan Ar (Karapattu R F to Thuthipattu), the Seshanabail Vanka (Ambur Durg R F to Vengatasamudram) and the Tottimadugu Vanka (8.9 km inside the district, to Khadavalam), whose CWC records give the Gorautakan Ar as their confluence (CWC river network, UIDs 3725, 4011, 4051).",
        flowsInto: "The Palar at Ambur (CWC river network record: end village Ambur M, confluence Palar).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names it (text search for Gorautakan, Dentakan and Seshanabail: 0 hits).",
        restorationInitiatives: "No official record of a restoration scheme on the Gorautakan Ar was found in the documents read.",
      },
    },
    {
      riverId: "malattar",
      displayName: "Malattar",
      subHydroshedIds: ["SB95"],
      color: "#059669",
      narrative: "The Malattar comes from Andhra Pradesh: CWC's line starts at Yalakallu in Chittoor district and ends on the Palar at Vadapudupattu in Ambur taluk, 26.2 km in all (CWC river network). Only its last 4.6 km lie inside the district; the 4.4 km drawn above that runs just outside the northern district line (median 0.25 km from it). CWC's gauge at Nariyampattu, 0.6 km inside the line, has daily flow readings from June 2018 to February 2026: the monthly mean was zero in 33 of the 66 months with readings. WRD's Malattar sub-basin, 265.841 sq km, lists 'Tungaleru, Malattar, Goddardanka' as its rivers (WRD Palar basin page); 23.1 sq km of it, 8.7%, is in this district, with one unit from the industry register.",
      attributes: {
        origin: "CWC's line starts at Yalakallu, Venkatagirikota mandal, Chittoor district, Andhra Pradesh (CWC river network record, UID 3855). No official text read describes its source.",
        length: "4.6 km inside the district and 9.0 km along or inside it (CWC river network); CWC's line is 26.2 km.",
        tributaries: "CWC's network names the Tlingal Eru and Goddar Vanka as Malattar feeders, both joining in Vellore district (CWC river network, confluence fields); WRD lists 'Tungaleru, Malattar, Goddardanka' for the sub-basin (WRD Palar basin page).",
        flowsInto: "The Palar at Vadapudupattu, Ambur taluk (CWC river network record: end village and confluence).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names a Malattar (text search).",
        restorationInitiatives: "No official record of a restoration scheme on this Malattar was found in the documents read. The Malattars in WRD's policy notes are other rivers: one where 'Malattar, a tributary of Pennaiyar River, bifurcates near Anrayanallur village.' (WRD policy note 2025-26, p.214), in Cuddalore and Villupuram districts, and one in Thoothukudi district (p.58).",
      },
    },
    {
      riverId: "kallaparai",
      displayName: "Kallaparai Ar",
      subHydroshedIds: ["SB90"],
      color: "#7c3aed",
      narrative: "The Kallaparai Ar rises inside the district in the Alangayam reserve forest of Vaniyambadi taluk and runs 4.4 km in the district before leaving it; the drawn line then keeps 0.5 to 1.7 km outside the district line for most of its way (median 1.0 km) to the Palar at Chithathoor, Gudiyatham taluk, Vellore district. CWC's line is 49.0 km (CWC river network). It is drawn as the outlet of the Agaramar sub-basin's 148.6 sq km in this district, 25.6% of WRD's 581.282 sq km sub-basin (WRD Palar basin page), in the east of Ambur and Vaniyambadi taluks, where CWC's Tirtham Ar, Talamaduvu Aru, Madigam Ar, Bhangl Aru and Ora Pallam drain to it, directly or through the Kovilmalai (Uttarakaveri) Aru (CWC river network, confluence fields). WRD names the sub-basin's rivers 'Agaramar,. Periyar' (WRD Palar basin page); no official text read uses the name Kallaparai Ar. The catchment holds one unit from the industry register.",
      attributes: {
        origin: "Alangayam R F, Vaniyambadi subdistrict, Tirupathur district (CWC river network record, UID 3775, start village).",
        length: "4.4 km inside the district and 39.3 km drawn along or near it, to 1.6 km outside the line (CWC river network); CWC's line is 49.0 km.",
        tributaries: "Inside the district, the Tirtham Ar (with the Bhangl Aru and Ora Pallam), and the Talamaduvu Aru (with the Madigam Ar) through the Kovilmalai (Uttarakaveri) Aru (CWC river network, confluence fields).",
        flowsInto: "The Palar at Chithathoor, Gudiyatham taluk, Vellore district (CWC river network record: end village and confluence).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names it (text search).",
        restorationInitiatives: "No official record of a restoration scheme was found in the documents read.",
      },
    },
    {
      riverId: "pambar",
      displayName: "Pambar",
      displayNameLocal: "பாம்பார்",
      subHydroshedIds: ["SB5"],
      color: "#b45309",
      narrative: "The Pambar drains the district's south-west to the Pennaiyar. WRD gives its origin as the 'Alangayam hills in Vellore District' (WRD Pambar dam page), written before Tirupathur district was formed; CWC's line starts at Pungampattunadu and runs 45.9 km inside the district, all in Tiruppattur taluk, before leaving for Krishnagiri district (CWC river network). Its sub-basin is the district's largest catchment, 850.6 sq km, 48.4% of WRD's 1,757.418 sq km Pambar sub-basin (WRD Pennaiyar basin page). Andiappanur Odai reservoir stands 0.3 km from the mapped course at Andiyappanur: WRD records that 'Andiappanur odai dam was constructed across Andiyappanur Odai and Periyar odai near Andiyappanur Village, Vaniyambadi Taluk of Vellore District', and that 'These odais are originating in the Jawadhu Hills and confluences with Pambar, which in turn confluences with Pennaiyar River.' (WRD Andiyappanur Odai dam page), written before the 2019 division (Andiyappanur village panchayat is now in Tiruppattur taluk). The state dashboard read it at 59.2% of capacity (66.47 Mcft) on 22 October 2026. The catchment holds 56 of the register's units, one of them a tannery. Tiruppattur taluk extracts 141.3% of its groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "'The pambar river is originates from Alangayam hills in Vellore District and runs at about 44km distance and it confluences in to the Pennaiyar river near pavakkal village.' (TN WRD, Pambar dam page). The page predates the 2019 division of Vellore district; CWC's line begins at Pungampattunadu in Tiruppattur taluk (CWC river network record, UID 4183).",
        length: "45.9 km inside the district, all in Tiruppattur taluk (CWC river network); CWC's line is 68.6 km to its confluence. WRD gives 'runs at about 44km distance' (Pambar dam page).",
        tributaries: "WRD names 'two tributaries such as Mathur river and Bargur river' (Pambar dam page), both joining in Krishnagiri district. Inside this district CWC's network names the Goddu Ar, which joins at Andiyappanur, the Pambu Aru and the Manjonai Ar (CWC river network, confluence fields); WRD's Andiappanur Odai dam is across the Andiyappanur Odai and Periyar odai (dam page).",
        flowsInto: "The Pennaiyar 'near pavakkal village'; WRD's Pambar dam, in Uthangarai taluk of Krishnagiri district, stands 8 km above the confluence (WRD Pambar dam page).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names a Pambar or Pambu (text search).",
        restorationInitiatives: "WRD's 2024-25 policy note shows check dams across the Pambar in Tiruppattur taluk near Jondrampalli (estimate Rs 3.33 crore) and near Matrapalli (estimate Rs 3.80 crore) (pp.264-265); the Matrapalli village panchayat touches the mapped course. The 2025-26 note lists landscaping, seating and play equipment at an estimated 'Rs.4.68 crore in Andiyappanur odai Reservoir in Tirupathur District.' (p.97). Andiappanur Odai dam was 'completed in the year 2007'; 'The first water release was on 06.06.2007.' (WRD dam page).",
      },
    },
    {
      riverId: "cheyyar",
      displayName: "Cheyyar",
      displayNameLocal: "செய்யாறு",
      subHydroshedIds: ["SB91"],
      color: "#be185d",
      narrative: "The Cheyyar begins on the district's south-eastern edge: WRD records that 'The River Cheyyar takes its origin in the eastern slopes of Jawadhu Hills and Western slopes of Thenmalai Hills.' (WRD Kuppanatham dam page), and CWC's line starts in the Inner Javudu reserve forest, which CWC places in Tirupathur district (CWC river network). Only the first 1.5 km of the mapped course lies inside the district; the next 21.8 km runs just outside the district line (median 0.8 km from it), past Kuppanatham dam. WRD writes that 'Kuppanatham dam was constructed across Cheyyar river near Kuppnatham Village in Cheyyar Taluk of Vellore District.' (Kuppanatham dam page), naming the districts as they then stood; the TNGIS register files the reservoir under Thiruvannamalai, and its point lies 0.5 km outside this district. The state dashboard read it at 25.0% of capacity (175.34 Mcft) on 22 October 2026. Selecting the river scopes the map to the Cheyyar sub-basin's 161.0 sq km here, 3.7% of WRD's 4,372.182 sq km (WRD Palar basin page), 157.9 sq km of it in Tiruppattur taluk, drained by CWC's Kal Ar (a different stream from the Palar's), Morajunai Ar, Kagamandai Ar and Manikkadapai Ar; no unit on the industry register lies in it. The district website notes that 'Tirupathur is surrounded by two major mountain ranges namely the ‘Javadhu Hills and Yelagiri Hills.' (tirupathur.nic.in, History).",
      attributes: {
        origin: "'The River Cheyyar takes its origin in the eastern slopes of Jawadhu Hills and Western slopes of Thenmalai Hills.' (TN WRD, Kuppanatham dam page). CWC's line starts at Inner Javudu R F, Tirupathur subdistrict, Tirupathur district (CWC river network record, UID 4150).",
        length: "1.5 km inside the district and 23.3 km along or inside it (OpenStreetMap mapped course); CWC's line runs 2.0 km inside. Whole river: 'The length of the Cheyyar river from its origin to its infall palar river is 188 kms.' (WRD Kuppanatham dam page); CWC's length field gives 194.8 km.",
        tributaries: "WRD lists 'Cheyyar, Kallar, Mirugandanadhi, Padavedu Ar, Kamandala naganadhi. Irumbedu maduvu, Kalavimaduvu' for the Cheyyar sub-basin (WRD Palar basin page). Inside this district CWC's network names the Kal Ar (UID 4145), Morajunai Ar, Kagamandai Ar, Manikkadapai Ar and Periya Ar as Cheyyar feeders (CWC river network, confluence fields).",
        flowsInto: "The Palar: 'The river is a tributary of Palar and its infall into Palar River.' (WRD Kuppanatham dam page). CWC's line ends at Angambakkam, Kancheepuram district (CWC river network record).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists; none of the three reports names the Cheyyar (text search for Cheyyar and Cheyar).",
        restorationInitiatives: "Kuppanatham dam: 'The dam works were commenced on 15.05.2005 and completed on 31.12.2008.' 'The first release of water was on 10.02.2010.' 'This dam benefits Thiruvannamalai District. Polur and Chengam Taluks are benefited by this dam.' (WRD Kuppanatham dam page). For the Pennaiyar (Sathanur dam) to Cheyyar link, 'Action will be taken to study the technical feasibility of diverting the main canal of the project to Palar through Cheyyar in second phase' (WRD policy note 2025-26, p.55).",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Tirupathur", TN_WRD_CATCHMENTS, "Rivers"),
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a CWC level chart (tap)", "Reservoir with no level chart (its card gives the day's storage where the state dashboard reports it)"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow and water quality (CWC gauge)", "CWC gauge: river flow and water quality (tap for charts)"),
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    tnpcbIndustries([], "Orange category"),

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "cetp-operating",
        label: "Common effluent treatment plants (tanneries): operating",
        color: "#7e22ce",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies and named tanks: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 828 outlines in the district (344 named or 5 ha and above, 484 smaller); area is computed from each outline. Named tanks are the 50 the all-tanks register names. The 208 village panchayats cover 1,195 of the district's 2,020 sq km: municipalities, town panchayats and reserve forest are not village panchayats.",
    "Rivers: the Palar and Cheyyar from OpenStreetMap contributors (ODbL); the Pambar, Kal Ar, Gorautakan Ar, Kallaparai Ar and Malattar from the Central Water Commission's river network on the National Water Data Portal (NWIC), which names them where OpenStreetMap does not. All are clipped to the district plus 1.6 km, so the Cheyyar, Malattar and Kallaparai Ar, which run along or just outside the district line, stay on the map.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 384 units in the district (95 red, 154 orange and 135 green or white category), all filed under TNPCB's Vaniyambadi office. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code.",
    "Treatment plants: the two tannery common effluent treatment plants on the register, Vanitec at Valayampattu (Vaniyambadi) and the Ambur plant's Thuthipet sector (Periavarikkam, Ambur). Each shows its status in the state's June 2026 progress report to NMCG (operation, renewal date, compliance) and its consented quantity in TNPCB's 2020 list. TNPCB's 2020 list and the state's June 2026 progress report to NMCG name three in the district, all in operation; the Ambur plant's Maligaithope sector is not on the register and is not drawn.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 2 CGWB and 11 Tamil Nadu state telemetry stations (six-hourly, 2026) and 17 CGWB manual wells (quarterly readings, January 2021 to August 2024). The portal tags some of them to Vellore, the parent district. Depth is in metres below ground level; each well shows its latest reading and date.",
    "Reservoirs: TN WRD's register on TNGIS, two waterspreads: Andiappanur Odai (Tiruppattur taluk) and Kuppanatham, which lies 0.5 km outside the south-eastern district line and which the register files under Thiruvannamalai. Storage for both comes from the state's daily reservoir dashboard (TN-SMART, relayed by RIMES), with the reading's date: depth in feet, storage in Mcft and percentage of capacity, as it prints them.",
    "River gauges: Central Water Commission, from the National Water Data Portal (NWIC): Avarankuppam on the Palar (daily flow from June 1978, water quality samples 1980 to 2023) and Nariyampattu on the Malattar (daily flow from June 2018).",
    "Polluted stretch: none is drawn. CPCB's 2018 and October 2025 lists carry no stretch in the district; its 2022 report listed the Palar along Vaniyambadi (Priority V), and the state's progress reports to NMCG since September 2025 record its delisting on 2022-2023 data. Each is cited by page on the Palar card.",
  ],
};

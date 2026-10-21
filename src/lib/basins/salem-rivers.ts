import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Salem district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/salem-rivers/, built by scripts/build_salem_rivers_basin.py. The basin id is "salem-rivers";
// the district's own scope is "tn-salem". Scaffolded by scripts/new_district_basin.py.
export const SALEM_RIVERS: BasinManifest = {
  basinId: "salem-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Salem district: rivers, groundwater and industry",
  displayNameLocal: "சேலம் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Salem district in one map: the Cauvery on its western line with Mettur dam, the Sarabanga, Thoppaiyar and Thirumanimuthar that run towards it, the Vasishta, Swetha Nadhi and Anaimaduvu of the Vellar basin to the east, the Vaniyar flowing north to the Pennaiyar, groundwater extraction by taluk, and the 1,057 industrial units on Tamil Nadu's own register. 13 of the 14 taluks are over-exploited for groundwater; Thalaivasal extracts 228.6% of its recharge and Gangavalli 192.5% (2024-2025). CPCB's October 2025 list carries three Priority I locations here, on the Sarabanga at Edapadi, the Thirumanimuthar at Salem and the Vasishta at Thulukannur, and TNPCB's 2019 action plans print the GPS points of 31 sewage outfalls in the district. Mettur, a CEPI area, scored 71.82 in CPCB's 2018 assessment and 19.7 in TNPCB's post-monsoon 2025 monitoring. Click a river to scope every layer to its catchment.",
  mapCenter: [11.68, 78.22],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 5233,
  areaNote:
    "Computed from the TNGIS district boundary (5,233 sq km); the district's statistical handbook and the Census handbook give 5237 sq km (District Statistical Handbook 2024-25, p.13; District Census Handbook 2011, p.25). The nine catchments are TN WRD's sub-basins cut to that boundary, 5,233 sq km in all; each continues outside the district.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB123"],
      color: "#1e3a8a",
      narrative: "The Cauvery, 'perennial in nature, flows along the western and southern boundaries of the district' (District Census Handbook 2011, Salem, p.25), with Mettur dam across it: 88 km of its mapped course runs along or inside the district, 42 km of that inside Mettur taluk. The reservoir read 22.5% of capacity (21,044 Mcft) on the state dashboard on 21 October 2026, and CWC's daily level at the dam was 221.06 m on 19 October. Below the dam, TNPCB's 2019 action plan records 11 sewage outfalls from Mettur Municipality (p.30) and prints their GPS points (pp.17-18); its sample at the Mettur sewage outlet on 2 January 2019 read dissolved oxygen 3.4 mg/l and BOD 4.2 mg/l, 'Complied except BOD' (p.25), and it concludes 'This implies that the River gets polluted due to sewage discharge only.' (p.36). TNPCB's 2023 monthly sheets print class A at Mettur (station 50) in all 12 months (TNPCB stretch-wise report 2023, pp.1-6). Mettur is also a CEPI area: TNPCB's 2020 plan gives it a 38.5 sq km core zone (p.8), its study covering 'M/s. Chemplast group of companies, M/s. Mettur Thermal Power stations and Mettur SIDCO' (CEPI plan, p.7). Selecting it scopes the map to the Mettur Reservoir to Noyel Confluence sub-basin (2,219 sq km here), which also drains the Sarabanga and the Thoppaiyar.",
      attributes: {
        origin: "'Originating in the foothills of Western Ghats at TalaCauvery, Kodagu in Karnataka' (TNPCB Cauvery action plan, 2019, p.10). It 'enters Tamil Nadu through Dharmapuri district' (p.10) and is held at Mettur by the Stanley Reservoir: 'It was completed in 1934.' (p.14).",
        length: "88 km along or inside the district (OpenStreetMap mapped course), 64 km of it inside the district line. Whole river: 'The total length of river Cauvery is 812 Kms.' (TN WRD, Mettur Dam page).",
        tributaries: "In Salem district the Sarabanga, which TNPCB lists with its confluence at Annamar Kovil (Cauvery action plan, p.11); above the dam the plan names three minor tributaries, the Palar, Chennar and Thoppar, that 'enter the Cauvery on her course above Stanley Reservoir' (p.14).",
        flowsInto: "The Bay of Bengal 'through two principal mouths in Poompuhar, Tamil Nadu' (TNPCB Cauvery action plan, p.10).",
        pollutedStretch: "CPCB, 2018: Priority I, 'METTUR TO MAYILADUTHURAI', BOD 3.3-32 mg/l (p.6): a stretch that begins at Mettur, in this district, 200 km long (TNPCB preamble, p.2). CPCB, 2022: Priority III, 'ALONG METTUR, ALONG ERODE, KATTIPALAYAM TO TRICHY, KUMBAKONAM TO PITCHAVARAM' (Table 27, p.35), with a maximum BOD of 5.7 mg/l at station 50, 'RIVER CAUVERY AT METTUR', on 2019 and 2021 data (Annexure I, p.61). CPCB, October 2025: Priority II, 'RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM' (Table 3.27, p.33). That stretch begins in Erode district, 14 km from this district's mapped course, and none of the seven Cauvery locations CPCB lists for it is in Salem (Annexure II, p.76). The state's June 2026 report to NMCG and TNPCB's 2026-27 policy note give the 2025 stretch as Mettur to Mayiladuthurai, 200 km, Priority II (MPR, p.6; policy note, p.88).",
        restorationInitiatives: "TNPCB's 2019 plan records Mettur's underground sewerage scheme, Rs.73.09 crore with three STPs of 7.20 MLD, after which 'Outfalls in the River Cauvery will be stopped permanently' (p.31). The state's June 2026 report lists Mettur STP-1, STP-2 and STP-3 at 0.82, 1.92 and 5.45 MLD, using 0.35, 0.295 and 2.87 MLD (MPR, p.21), and a 0.16 MLD plant for Poolampatty at DPR stage (p.32). WRD lists Mettur among the six dams for which the World Bank approved rehabilitation reports of Rs.297.70 crore (WRD policy note 2025-26, p.69).",
      },
    },
    {
      riverId: "sarabanga",
      displayName: "Sarabanga",
      displayNameLocal: "சரபங்கா",
      subHydroshedIds: [],
      color: "#2563eb",
      narrative: "The Sarabanga rises in the Yercaud foothills and runs south-west past Omalur, Tharamangalam and Edappadi to the Cauvery (TNPCB Sarabanga action plan, 2019, p.6): CWC's line runs 90 km inside the district, through Kadayampatti, Omalur, Edappady and Sankari taluks. CPCB's 2018 stretch, Thathayampatti to T.Konagapadi, is 15 km (TNPCB preamble, p.2); the two places the plan prints for it, the Thathiyampatti Bridge outfall and the Konagapadi open well, lie 15.8 km apart along CWC's line. The plan finds 'only domestic sewage from Idappadi Municipality, Thathiampatti Village Panchayat and Omalur Town Panchayat area' (p.7); its samples of 4 January 2019 read BOD 22 mg/l with no dissolved oxygen below Omalur and BOD 18 mg/l at Edapadi, both 'Not complied' (p.15). TNPCB's one station, 3024 at Edappadi, lies 30 km downstream of the named stretch; its 2023 sheets print class E in all 12 months, with BOD up to 120 mg/l in December (TNPCB stretch-wise report 2023, pp.1-5). CWC's Thevur gauge recorded no flow in 138 of the 250 months on record since September 1999. It has no WRD sub-basin of its own (it lies in the Mettur Reservoir to Noyel Confluence sub-basin, which the Cauvery card selects), so selecting it keeps every layer in view.",
      attributes: {
        origin: "'It originates from Shevaroy Hills (Yercaud foot hills) in Salem district.' The West Sarabanga rises at Danishpet and the East Sarabanga at Vattakadu (TNPCB Sarabanga action plan, p.6). The Census handbook says 'The origin of the river is traditionally placed at Yercaud hills.' (District Census Handbook 2011, p.25).",
        length: "90 km inside the district (CWC river network). 'The Total length of the main stream is nearly 70 km from Omalur to Idappadi.' (p.6); TNPCB's 2026-27 policy note gives 70 km (p.88).",
        tributaries: "The East Sarabanga, which 'confluences with the West Sarabanga at V.O.C Nagar' near Omalur (TNPCB Sarabanga action plan, p.6).",
        flowsInto: "The Cauvery 'at Annamar Kovil in Namakkal District' (TNPCB Sarabanga action plan, p.6); TNPCB's Cauvery plan lists the confluence as Annamar Kovil under Salem district (p.11).",
        pollutedStretch: "CPCB, 2018: Priority I, 'THATHAYAMPATTI TO T.KONAGAPADI', BOD 78.0 mg/l (p.6). CPCB, 2022: Priority II, 'ALONG SALEM', BOD 24.0 mg/l (Table 27, p.35), at station 3024, 'RIVER SARABANGA AT SALEM, D/S OF TEXTILE DYEING INDUSTRIES EFFLUENT, TAMILNADU' (Annexure I, p.61), one of the stretches CPCB moved to a lower priority class (Annexure XI, p.88). CPCB, October 2025: a single location, 'RIVER SARABANGA AT EDAPADI AT SALEM, D/S OF TEXTILE DYEING INDUSTRIES EFFLUENT', Priority I, BOD 36 mg/l in 2022 and 2023 (Annexure III B, p.98) and 80 mg/l in 2024 (Annexure XIV, p.140). The plan records 'There is no highly polluting industries located along the above polluted river stretch.' (p.7). The state's June 2026 report records 'No Flow' at its one monitoring location (MPR, p.3).",
        restorationInitiatives: "WRD's Mettur-Sarabanga lift irrigation scheme carries 'surplus water from the Mettur Dam to the dry tanks in Sarabanga Basin in Salem District', Rs.673.8835 crore for 4061.66 acres through 79 tanks; in trial runs between 31.07.2024 and 18.01.2025, 543.29 Mcft was released and 56 of 57 tanks reached full capacity (WRD policy note 2025-26, p.33). The state's June 2026 report lists Idappadi's 3 MLD sewage plant at 45%, due September 2026 (MPR, p.9), Edappadi's 0.03 MLD faecal sludge plant in operation (p.23) and a 1.16 MLD plant for Omalur at DPR stage (p.32), and notes 'This river is only a flood carrier.' (p.70).",
      },
    },
    {
      riverId: "thirumanimuthar",
      displayName: "Thirumanimuthar",
      displayNameLocal: "திருமணிமுத்தாறு",
      subHydroshedIds: ["SB129"],
      color: "#d97706",
      narrative: "The Thirumanimuthar 'originates from Manjavadi in Shevaroy Mountain' and runs south through Salem city to Papparapatti, where it enters Namakkal district (TNPCB Thirumanimutharu action plan, 2019, p.6): 52 km of CWC's line is inside the district, 30 km of it in Salem taluk. The plan prints eight Salem Corporation sewage outfalls, from Sengal Anai to Uthamasolapuram, 13.5 km apart along the river (p.9). On 4 January 2019 all ten of its samples were 'Not complied'; the seven along the city reach read no dissolved oxygen and BOD of 30 to 245 mg/l (p.18). The plan records that one of the Corporation's four STPs, 98 MLD in all, was operating (p.7); the state's June 2026 report lists Salem's Vellakuttai, Anaimedu, Mankuttai and Vandipettai plants, 98 MLD, using 11.5 MLD (MPR, p.21), and BOD 90 mg/l in the river (p.3). Its sub-basin here, 780 sq km, holds 348 registered units, among them 13 of the district's 21 red-category textile processing units, 8 of them within 2 km of the river.",
      attributes: {
        origin: "'The River Thirumanimutharu originates from Manjavadi in Shevaroy Mountain' (TNPCB Thirumanimutharu action plan, p.6); TNPCB's Cauvery plan also gives Manjavadi (p.11), and the Census handbook says the Sarabanga and Tirumanimuthar 'originate in the servarayan hills' (District Census Handbook 2011, p.25).",
        length: "52 km inside the district (CWC river network). 'In Salem District the River flows over a stretch of approximately 55 KM' (p.6); TNPCB's 2026-27 policy note gives 120 km for the whole river (p.88).",
        tributaries: "None is named in the TNPCB or WRD documents read; WRD's Tirumanimuttar sub-basin lists only the Tirumanimuttar (TN WRD, Cauvery basin page).",
        flowsInto: "'River Thirumanimutharu joins the River Cauvery at Nanjai Edayar place in Namakkal District.' (TNPCB Thirumanimutharu action plan, p.6).",
        pollutedStretch: "CPCB, 2018: Priority I, 'SALEM TO PAPPARAPATTI', BOD 190.0 mg/l (p.6), 15 km (TNPCB preamble, p.2). CPCB, 2022: Priority I, 'ALONG SALEM', BOD 56.0 mg/l (Table 27, p.35), at station 3022 (Annexure I, p.62), with no change from 2018 (Annexure XII, p.93). CPCB, October 2025: a single location, 'RIVER THIRUMANIMUTHARU AT SALEM, D/S OF SAGO & TEXTILE DYING INDUSTRIES', Priority I, BOD 60 mg/l in 2022 and 2023 (Annexure III B, p.98) and 120 mg/l in 2024 (Annexure XIV, p.141).",
        restorationInitiatives: "The state's June 2026 report states that 'Treatment plants have been proposed under Nadanthai Vaazhi Cauvery Project' and that e-flow will follow their completion (MPR, p.70). WRD's Cauvery (Mettur Dam), Sarabanga, Ponniyar, Thirumanimuthar, Karaipottanar and Ayyar link canal would carry Mettur's surplus flood water to tanks along its way; Phase I is estimated at Rs.8049.00 crore and 'Preparation of project report for this project is in progress.' (WRD policy note 2025-26, pp.56-57).",
      },
    },
    {
      riverId: "thoppaiyar",
      displayName: "Thoppaiyar",
      displayNameLocal: "தொப்பையாறு",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "The Thoppaiyar runs west from the Shevaroy hills along the district's northern edge to the Cauvery's Mettur reservoir: 77 km of CWC's line runs along or inside the district, but only 29 km is inside it, in Kadayampatti, Yercaud and Mettur taluks. WRD lists the Thoppaiyar among the reservoirs of the Mettur Reservoir to Noyel Confluence sub-basin (TN WRD, Cauvery basin page); the register places the reservoir's waterspread just across the district line, and it read 3.0% of capacity (9.06 Mcft) on the state dashboard on 21 October 2026. CWC's Thoppur gauge, in Kadayampatti taluk, recorded no flow in 126 of its 199 months on record since October 1999, and in every month read from February 2025 to August 2026. 34 registered units lie within 2 km of the river, 11 of them red-category quarries and mines. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "No official description of its source was found in the documents read; CWC's line begins in Yercaud taluk.",
        length: "29 km inside the district, 77 km along or inside it (CWC river network). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Cauvery: CWC's line meets the mapped Cauvery inside the Mettur reservoir's waterspread. No official text read names the confluence.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "The Thoppaiyar dam is among the 16 dams whose rehabilitation under the Dam Rehabilitation and Improvement Project, Rs.39.25 crore in all, the 2016-17 note records as completed (PWD policy note 2016-17, p.43). No river restoration scheme specific to the Thoppaiyar was found in the documents read.",
      },
    },
    {
      riverId: "vasishta",
      displayName: "Vasishta Nadhi",
      displayNameLocal: "வசிஷ்டா",
      subHydroshedIds: ["SB46"],
      color: "#7c3aed",
      narrative: "The Vasishta rises at the Puzhuthikuttai and Pappanaickenpatti dams and runs east through Pethanaickenpalayam, Attur, Manivilundhan and Thalaivasal into Villupuram district (TNPCB Vasista action plan, 2019, p.6): 81 km of CWC's line is inside the district, 22 km of it in Thalaivasal taluk. Its sub-basin, the Upper Vellar (1,422 sq km here), holds 76 of the register's 118 starch and sago units, 40 of them within 2 km of the river. The plan records 27 sago units near the river with consent to use their treated effluent on land for irrigation (p.7) and finds 'There is no industrial effluent discharge into the River.' (p.37); the sewage comes from Attur and Narasingapuram municipalities and three town panchayats (p.6). Its January 2019 sample below Attur read BOD 342 mg/l with no dissolved oxygen, 'Not complied' (p.18). TNPCB's one station, 3023 at Thulukkanur, lies 8 km upstream of the named stretch. Thalaivasal and Attur taluks extract 228.6% and 167.3% of their groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "'River Vasista Originates from Puzhuthikuttai dam and Pappanaickenpatti Dam' (TNPCB Vasista action plan, p.6). WRD calls it the upper Vellar: 'Anaimaduvu river is one of the major tributary of Vasista River also called as upper vellar' (TN WRD, Anaimaduvu Dam page). The Census handbook gives 'The Vasishta river originates in the Chitteri hills and flows southwards and joins the Vellar river.' (District Census Handbook 2011, p.25).",
        length: "81 km inside the district (CWC river network). 'In Salem District the River flows over a stretch of approximately 74 KM from the Pappanaickenpatti Dam and approximately 13 KM from Puzhuthikuttai dam.' (p.6); TNPCB's 2026-27 policy note gives 87 km (p.88).",
        tributaries: "In Salem district the Vellaru, from Jarugumalai R.F., which joins at Kundu ManiyanKaradu, and the Chitraru, from Pethanaickenpalayam lake, which joins at Narasingapuram (TNPCB Vasista action plan, p.6); and the Anaimaduvu (TN WRD, Anaimaduvu Dam page).",
        flowsInto: "'River Vasista and River Swedha flowing together at Ayan Peraiyur Village and forms River Vellar which finally confluences in Bay of Bengal at Parangipettai.' (TNPCB Vasista action plan, p.6).",
        pollutedStretch: "CPCB, 2018: Priority I, 'MANIVILUNDHAN TO THIYAGANUR', BOD 675.0 mg/l (p.6), 10 km (TNPCB preamble, p.2). CPCB, 2022: Priority I, 'ALONG SALEM', BOD 230.0 mg/l (Table 27, p.35), at station 3023, 'RIVER VASISTA AT SALEM, D/S OF SAGO INDUSRIES EFFLUENT, TAMILNADU' (Annexure I, p.62). CPCB, October 2025: a single location, 'RIVER VASISTA AT THULUKANNUR AT SALEM, D/S OF SAGO INDUSRIES EFFLUENT', Priority I, BOD 120 mg/l in 2022 and 2023 (Annexure III B, p.98) and 160 mg/l in 2024 (Annexure XIV, p.141). TNPCB's plan adds that the river is 'polluted from Attur to Kattukottai stretch (7km) due to the Attur Municipal sewage wastes into the river' (pp.35-36).",
        restorationInitiatives: "The state's June 2026 report lists a 12.5 MLD sewage plant for Attur and Narasinghapuram at 43%, due December 2026 (MPR, p.9), Attur's 0.04 MLD faecal sludge plant in operation (p.23), Yethapur's 1.01 MLD STP cum FSTP at 87% (p.11), and DPRs completed for Pethanaickenpalayam (2.10 MLD) and Belur (1.71 MLD) (p.33); for plantation along the river it records 'There is no proposal at present.' (p.70). TNPCB's 2019 plan records 211 of 271 encroachments evicted on the Attur to Thalaivasal reach (p.36).",
      },
    },
    {
      riverId: "swetha",
      displayName: "Swetha Nadhi",
      displayNameLocal: "சுவேதா நதி",
      subHydroshedIds: ["SB45"],
      color: "#0d9488",
      narrative: "'The Vellar system consists of the Vasista and Sweata Nadi, which drain two parallel valleys running east and west in Attur taluk', the Swetha 'carrying the drainage of Kolli Hills and Pachamalais' (TNPCB Vasista action plan, p.6). 45 km of CWC's line is inside the district, in Gangavalli and Thalaivasal taluks. Its sub-basin here, 451 sq km, holds 27 registered units, 13 of them starch and sago units. Gangavalli taluk extracts 192.5% of its groundwater recharge, the second highest share in the district (over-exploited, 2024-2025). It meets the Vasishta in Viluppuram district to form the Vellar (District Census Handbook 2011, p.25); CWC's two lines do not meet inside the district.",
      attributes: {
        origin: "'The Swetha river originates in the Kolli hills and flows eastwards.' (District Census Handbook 2011, p.25). TNPCB's Vasista plan says it carries 'the drainage of Kolli Hills and Pachamalais' (p.6). CWC's line begins in Gangavalli taluk.",
        length: "45 km inside the district (CWC river network). No official length was found.",
        tributaries: "The Ponni odai, which 'joins Swetha River near Veeraganur' (PWD policy note 2019-20, p.170); WRD's Swethanadhi sub-basin lists the Swethanadhi and the Kallar (TN WRD, Vellar basin page).",
        flowsInto: "The Vasista: 'The Vasishta Nadhi and Swetha Nadhi join together in Viluppuram district and takes the name of Vellar' (District Census Handbook 2011, p.25); TNPCB gives the meeting place as 'Ayan Peraiyur Village' (Vasista action plan, p.6).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "PWD's 2019-20 note lists two new check dams across the Swetha Nadhi in Gangavalli taluk, at Laddhuvadi (Rs.2.43 crore, 43.88 acres) and at Kudamalai (Rs.1.88 crore, 65.63 acres) (PWD policy note 2019-20, section 4.1.5, pp.95, 99-100). WRD lists a new tank across the Ponni Odai in Chokkanur Agrahara village, Gangavalli taluk, at Rs.33.32 crore for 446 acres (WRD policy note 2025-26, p.96).",
      },
    },
    {
      riverId: "anaimaduvu",
      displayName: "Anaimaduvu",
      displayNameLocal: "ஆனைமடுவு",
      subHydroshedIds: [],
      color: "#a855f7",
      narrative: "'The Anaimaduvu Reservoir is constructed across Anaimaduvu river at the foot of the Kalrayan hills.' (TN WRD, Anaimaduvu Dam page). CWC's line runs 41 km, all in Valapady taluk, and ends 4.3 km short of the Vasishta's line. The dam was built between 1982 and 1993 and 'Salem taluk is benefitted by this reservoir' (WRD); the district handbook gives its capacity at full reservoir level as 267 M.cft and its ayacut as 5011.70 acres (District Statistical Handbook 2024-25, p.157). It read 9.4% of capacity (25.23 Mcft) on the state dashboard on 21 October 2026. TNPCB's sample at the reservoir in January 2019 read BOD 7.5 mg/l, 'Complied except BOD' (TNPCB Vasista action plan, p.18); the plan's Belur Bridge outfall lies on this line (p.10). Valapady taluk extracts 155.2% of its groundwater recharge. It has no WRD sub-basin of its own (it lies in the Upper Vellar sub-basin, which the Vasishta card selects), so selecting it keeps every layer in view.",
      attributes: {
        origin: "No official description of its source was found in the documents read; the dam stands 'at the foot of the Kalrayan hills' (TN WRD, Anaimaduvu Dam page).",
        length: "41 km inside the district (CWC river network). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Vasista: 'Anaimaduvu river is one of the major tributary of Vasista River' (TN WRD, Anaimaduvu Dam page).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No river restoration scheme specific to the Anaimaduvu was found in the documents read. The state's June 2026 report lists a 1.71 MLD sewage plant for Belur with its DPR completed (MPR, p.33).",
      },
    },
    {
      riverId: "vaniyar",
      displayName: "Vaniyar",
      displayNameLocal: "வாணியாறு",
      subHydroshedIds: ["SB24"],
      color: "#15803d",
      narrative: "The Vaniyar 'rises in Servarayan hills in Yercaud' (District Census Handbook 2011, p.25) and flows north into Dharmapuri district: CWC's line runs 18 km inside the district, all in Yercaud taluk, the district's only taluk classed safe for groundwater (14.2% of recharge extracted, 2024-2025). 'The Vaniyar Dam is constructed across Vaniyar river near Pappireddipatti village at the foot of Servarayan Hills.' (TN WRD, Vaniyar Reservoir page); the register places the reservoir in Dharmapuri district. Its sub-basin here, 177 sq km of WRD's Vaniyar sub-basin, holds 2 registered units.",
      attributes: {
        origin: "'Vanier river rises in Servarayan hills in Yercaud.' (District Census Handbook 2011, p.25). CWC's line begins in Yercaud taluk, and WRD places the dam 'at the foot of Servarayan Hills' (TN WRD, Vaniyar Reservoir page).",
        length: "18 km inside the district (CWC river network). No official length was found.",
        tributaries: "WRD's Vaniyar sub-basin lists the Vaniyar, Varattar and Thurinjihalli Ar (TN WRD, Penniyar basin page); none joins it inside this district on the map.",
        flowsInto: "The Pennaiyar: 'It joins the Pennar below its confluence with the Pambar.' (District Census Handbook 2011, p.25); 'Vaniyar is one of the major tributaries of Pennaiyar River.' (TN WRD, Vaniyar Reservoir page).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "The Vaniyar dam is among the 16 dams whose rehabilitation under the Dam Rehabilitation and Improvement Project the 2016-17 note records as completed (PWD policy note 2016-17, p.43), and among the 35 dams the Dam Safety Review Panel inspected (WRD policy note 2025-26, p.69). No river restoration scheme specific to the Vaniyar was found in the documents read.",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Salem", TN_WRD_CATCHMENTS, "Rivers"),
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false },
    { family: "prs-drains", label: "Sewage outfalls (TNPCB action plans, 2019)", floor: "hydrology", geom: "point", color: "#eab308", defaultOn: true },
    CWC_CANALS,
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a CWC level chart (tap)", "Reservoir with no level chart (its card gives the day's storage where the state dashboard reports it)"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow and water quality (CWC gauges)", "CWC gauge: river flow and water quality (tap for charts)"),
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
      "Orange category (including 115 starch and sago units)",
    ),
    { family: "industrial-estates", label: "SIPCOT Salem Textile Park", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },
    { family: "cepi-area", label: "CEPI area, Mettur: frame through the plan's four reference points (TNPCB, 2020)", floor: "pressures", geom: "fill", color: "#9f1239", defaultOn: false, outline: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "stp",
        label: "Sewage and faecal sludge treatment plants on the register (Mettur Municipality, Jalakandapuram Town Panchayat)",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "mettur-canal-system",
        label: "Mettur Canal System (Mettur dam)",
        color: "#65a30d",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,549 outlines in the district; 424 are named or 5 ha and above, and 340 carry a name. Area is computed from each outline. Named tanks are the 121 the all-tanks register names. The 385 village panchayats cover about 3,375 of the district's 5,233 sq km: town panchayats, municipalities, the corporation and reserve forest are not village panchayats.",
    "Rivers: the Cauvery is OpenStreetMap contributors' course (ODbL); the Sarabanga, Thirumanimuthar, Thoppaiyar ('Veppadi Or Toppai Ar'), Vasishta ('Vellar/Vasista'), Swetha Nadhi ('Sweta Nadi'), Anaimaduvu ('Analmaduvu R') and Vaniyar are CWC's river network (National Water Data Portal), named as CWC files them, because OpenStreetMap does not name them in full here. All are clipped to the district plus 1.6 km so that rivers on the district line stay on the map.",
    "Canals and command area: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Mettur Canal System, its East Bank Canal (46.5 km inside the district) and West Bank Canal (14.2 km) with distributaries and minors; one command area, 8,935 ha of it mapped inside the district. Lengths and mapped areas are computed from CWC's lines and polygons; culturable command area (18.21 thousand ha) is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 1,060 units in the district (1,057 industrial units and three treatment plants). Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024, under TNPCB's DEE Salem and DEE Kumarapalayam offices. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code; 118 units carry the code for starch and sago manufacture.",
    "Treatment plants: the three on the register, Mettur Municipality's sewage treatment plants II and III and Jalakandapuram Town Panchayat's faecal sludge plant. The state's June 2026 progress report to NMCG lists Mettur STP-1, STP-2 and STP-3 in operation (p.21).",
    "SIPCOT estate: Salem Textile Park, 110.5 acres, from SIPCOT GIS (sipcotgis.tn.gov.in), area as SIPCOT states it.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk: 13 taluks over-exploited, Yercaud safe.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 17 CGWB and 42 Tamil Nadu state telemetry stations (2026) and 70 CGWB manual wells (quarterly readings, January 2021 to January 2025). Depth is in metres below ground level; each well shows its latest reading and date.",
    "Reservoirs: TN WRD's register on TNGIS, five waterspreads: Mettur, Anaimadavu and Kariakovil inside the district, Thoppaiyar just across its line and Vaniar in Dharmapuri district. Storage comes from the state's daily reservoir dashboard (TN-SMART, relayed by RIMES), read 21 October 2026; Mettur's level series is CWC's daily reservoir level from the National Water Data Portal.",
    "River flow and water quality: Central Water Commission gauges at Thevur (Sarabanga) and Thoppur (Thoppaiyar), from the National Water Data Portal (NWIC): manual daily discharge from 1999, shown as monthly means, and annual means of CWC's samples. The portal also tags a gauge at Sevanur to the Cauvery; it plots on the river's line, but its record (no flow in 111 of 262 months, a highest monthly mean of 9.09 cumec) does not read as the main river below Mettur, so it is not shown until its channel is confirmed.",
    "Polluted stretches: CPCB, Polluted River Stretches for Restoration of Water Quality, September 2018, 2022 and October 2025 (updated version). The 2025 entries for the Sarabanga, Thirumanimuthar and Vasishta are single locations (Annexure III B); CPCB's 2025 Cauvery stretch starts in Erode district. Outfall positions are the GPS coordinates TNPCB's 2019 action plans print for the Cauvery (Mettur and Poolampatti), Sarabanga, Thirumanimutharu and Vasista, 31 in the district. The map draws CPCB's 2018 stretches between the points the plans print (the river cards say where a point is our reading) and the 18 outfalls that lie within 0.5 km of the mapped river; the other 13, eight at Mettur and the five at Omalur, are left off, one of them because its printed longitude has 90 seconds. Each is cited by page on the river cards.",
    "Water-quality classes and readings quoted on the cards: TNPCB stretch-wise monthly reports, January to December 2023, the last year on TNPCB's polluted-stretches page, and the state's June 2026 progress report to NMCG.",
    "CEPI: TNPCB, Evaluation of CEPI Score and Action Plan for the CEPI Area of Mettur, Salem District (January 2020), the four core-zone reference points of section 1.1; scores from CPCB's December 2009 assessment, the 2020 plan, TNPCB's CEPI score sheet and TNPCB's 2026-27 policy note.",
    "Tamil river names: WRD and PWD Tamil policy notes, TNPCB's Tamil policy note 2026-27 and the WRD website's Tamil pages, each named in the card notes.",
  ],
};

import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges, TN_GROUNDWATER_WELLS,
  tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Ranipet district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/ranipet-rivers/, built by scripts/build_ranipet_rivers_basin.py. The basin id is "ranipet-rivers";
// the district's own scope is "tn-ranipet". Scaffolded by scripts/new_district_basin.py.
export const RANIPET_RIVERS: BasinManifest = {
  basinId: "ranipet-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Ranipet district: rivers, groundwater and industry",
  displayNameLocal: "இராணிப்பேட்டை மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Ranipet district in one map: the Palar, which crosses the district from west to east past Ranipet and Arcot, with the Ponnai joining it at the western edge; the Cheyyar along the southern line in Kalavai taluk, with its catchment drained here by the Kalavimaduvu; the Kosasthalaiyar with the Kallar and the Kaveripakkam Ar in the north and east, in the district's largest catchment; the Nandi Ar in the north; the canals of the Palar Anicut System; 552 named tanks among 1,844 water bodies; CWC's gauges at Arcot on the Palar and Ayalambedu on the Nandi; groundwater extraction by taluk; the SIPCOT estates at Ranipet and Panapakkam; and the 608 industrial units on Tamil Nadu's own register, 109 of them red-category tanneries, all filed under Walajah taluk. Arcot taluk extracts more groundwater than is recharged (112.8%, 2024-2025) and Walajapet 97.2%. CPCB scored the Vellore (North Arcot) industrial cluster 81.79 on its pollution index for industrial areas in 2009 and 79.38 in 2018, for the Ranipet SIPCOT area, which lies in today's Ranipet district; TNPCB's own rounds since 2019 score it between 14.96 and 28.10, and 21.792 after the 2025 monsoon (TNPCB score sheet, 2026). TNPCB records about 2.2 lakh tonnes of chromium sludge at the closed Tamil Nadu Chromates and Chemicals site at Ranipet; interim remedial works began in February 2026. No CPCB list has carried a Palar stretch in this district: the 2015 and 2022 lists name stretches at Vaniyambadi, upstream in Tirupathur district, and the state's reports since September 2025 record that CPCB has delisted the Palar. Click a river to scope every layer to its catchment.",
  mapCenter: [12.95, 79.46],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 1847,
  areaNote:
    "Computed from the TNGIS district boundary (1,846.7 sq km); the district's horticulture page gives a geographical area of 184140.5 hectares (ranipet.nic.in, Horticulture) and its disaster management plan 2234.32 sq km (DDMP 2025, p.8). The six catchments are TN WRD's sub-basins cut to that boundary, 1,843.0 sq km in all: Kosasthalaiyar 856.2, Cheyyar 471.9, Nandhiyar 189.0, Poiney (ponnai) 168.2, Vegavati 151.3 and Cooum 6.4. Each continues outside the district. Ranipet district was formed from Vellore district and 'started functioning on 28 November 2019' (ranipet.nic.in, About District); documents older than that call this area part of Vellore (or North Arcot) district.",
  rivers: [
    {
      riverId: "palar",
      displayName: "Palar",
      displayNameLocal: "பாலாறு",
      subHydroshedIds: ["SB96", "SB98"],
      color: "#2563eb",
      narrative: "The Palar crosses the district from west to east. The district's disaster management plan says it 'physically splits the district into 2 halves' and 'enters the district at Walajah Taluk and passes through Arcot and Nemili Taluks' (Ranipet DDMP 2025, p.9). Its mapped course runs 45.8 km in the map's clip, 28.9 km of it inside the district line: 13.0 km in Walajapet, 13.0 km in Arcot and 3.2 km in Nemili taluk; about 17.1 km runs within 300 m of the line, in the west by Kilminnal and Nandhiyalam, where the Ponnai joins, and in the east from Valavanur to Kalathur. Ranipet town was founded 'opposite Arcot, on the northern bank of the River Palar' (ranipet.nic.in, History). The Palar anicut, built in 1857-58 near Thirumalaicheri at km 244 of the river, feeds 319 tanks in Ranipet, Kanchipuram, Tiruvannamalai and Tiruvallur districts and irrigates 31,367.45 ha (ranipet.nic.in, Walaja Palar Anaicut, in Tamil); CWC maps 17,309 ha of the Palar Anicut System's command area and 89.9 km of its canals in the district. At CWC's Arcot gauge the river flowed on 329 of 2,608 days with a reading from 2013 to 2020 (12.6%) and on 1,307 of 1,338 from 2021 to June 2026 (97.7%); the highest reading, 2,605.66 cubic metres a second, was on 19 November 2021. The two sub-basins it runs through here, Poiney and Vegavati, hold 370 of the register's 608 industrial units and 103 of its 109 red-category tanneries; 105 tanneries lie within 5 km of the river and 6 within 2 km. TNPCB's January 2020 plan for the Ranipet SIPCOT CEPI area lists untreated sewage of 4.0, 5.0 and 4.5 MLD from Melvisharam, Arcot and Ranipet municipalities discharged into the Palar, and records that 'No Common Sewage Treatment system is provided in all the three municipalities' (p.32). Arcot taluk extracts 112.8% of its groundwater recharge (over-exploited) and Walajapet 97.2% (critical), 2024-2025.",
      attributes: {
        origin: "'originates in Kolar District in Karnataka, traverses through Andhra Pradesh via Chittoor District' (WRD policy note 2025-26, p.156).",
        length: "45.8 km of mapped course in the map's clip (OSM), 28.9 km of it inside the district line. CGWB: 'flowing towards east for a distance of about 295 km' (CGWB Vellore district brochure, January 2009, p.7); the district plan's hazard table repeats about 295 km (DDMP 2025, p.75). No other official whole-river length was found in the documents read.",
        tributaries: "In the district the Ponnai, which 'merged with Palar River at Wallajah Taluk' (DDMP 2025, p.9); CWC's river network ends the Ponnai at Nandiyalam, Wallajah. CGWB names 'Ponnaiyar, Cheyyar, Pambar and Malattar' as major tributaries in the then Vellore district (2009, p.7); the Cheyyar joins downstream of this district, at Angambakkam in Kanchipuram district (CWC river network).",
        flowsInto: "The sea: it runs on through Thiruvannamalai, Kancheepuram and Chengalpattu districts 'before confluencing into the Bay of Bengal' (WRD policy note 2025-26, p.156).",
        pollutedStretch: "No CPCB list has carried a Palar stretch in Ranipet district. CPCB's February 2015 list had the Palar 'VANIYAMBADI TO MINNUR', Priority II (p.63); its 2018 list has no Palar entry (text search); its 2022 list carried it 'ALONG VANIYAMBADI', Priority V, maximum BOD 4.0 mg/l (p.35), from one station, 'RIVER PALAR AT VANIYAMBADI WATER SUPPLY HEAD WORK, TAMILNADU' (p.61), which CPCB's own coordinates on the National Water Data Portal place 65.1 km west of this district; Vaniyambadi is in Tirupathur district (MPR, June 2026, p.55). The state's policy note gives that stretch as Kodaiyanchi to Marapattu, 16.30 km, Priority V (2025-26, p.99). The state's reports record that the Palar action plan was approved by the River Rejuvenation Committee and furnished to CPCB and MoJS in October 2024 (MPR, June 2026, p.74), and from September 2025: 'Based on the water quality data for the year 2022-2023, CPCB has delisted Amaravathi and Palar River from the list of PRS' (MPR, September 2025, p.63; June 2026, p.6). CPCB's October 2025 list has no Palar entry (text search).",
        restorationInitiatives: "Sewage: the state's June 2026 report lists a 3.01 MLD sewage treatment plant for Walajapet under construction, 10% complete and due in June 2027, and a proposed 4 MLD plant for Melvisharam with a letter of award issued on 06.07.2026 as the report prints it (pp.10, 32). TNPCB's 2020 CEPI plan set December 2022 for sewage treatment plants in Melvisharam, Arcot and Ranipet municipalities (p.69). The anicut: the district's press release of 26 February 2026 is titled 'Palar Anicut Renovated 26/02/2026' (ranipet.nic.in). Between states: Tamil Nadu's suits on Andhra Pradesh's works across the Palar, filed in the Supreme Court in 2006 and 2016, are pending (WRD policy note 2025-26, pp.156-158). Chromium waste at the closed Tamil Nadu Chromates and Chemicals site at Ranipet: interim remedial works 'commenced in the third week of February 2026' (policy note 2026-27, p.123; see the CEPI record).",
      },
    },
    {
      riverId: "ponnai",
      displayName: "Ponnai",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "The Ponnai comes down from Andhra Pradesh along the district's western line and joins the Palar in Walajapet taluk. The district plan: 'The Ponnai river starting from vizharam, Andhra Pradesh enters Vellore District at Katpadi Taluk and merged with Palar River at Wallajah Taluk' (Ranipet DDMP 2025, p.9). Of its 21.0 km mapped in the map's clip, 16.1 km runs within 300 m of the line, with Vellore district across, and 8.4 km lies inside, all in Walajapet taluk, the last 6.7 km through Seekarajapuram and Thengal to the Palar. CWC's river network records it as 75.14 km from Thotathimmaiah Palle in Pakala mandal, Chittoor district, to Nandiyalam, Wallajah. TNPCB's 2020 CEPI plan notes that 'River Ponnai is running at a distance of 2 Km from the CEPI core zone' and sampled it at Sikkarajapuram (p.9, p.29). CWC maps 2,300 ha of the Poiney Anicut System's command area and 6.6 km of its East Main Canal in the district. The register places 32 units within 2 km of the river, one of them a red-category tannery. WRD's sub-basin carries its name, Poiney (ponnai); its 168.2 sq km here also hold the Palar's reach past Ranipet and Arcot, so that sub-basin is on the Palar card and selecting the Ponnai keeps every layer in view.",
      attributes: {
        origin: "Andhra Pradesh: CWC's river network starts it at Thotathimmaiah Palle, Pakala mandal, Chittoor district; the district plan names 'vizharam, Andhra Pradesh' (DDMP 2025, p.9).",
        length: "21.0 km mapped in the map's clip (OSM), 8.4 km of it inside the district line and 16.1 km along it. Whole river: 75.14 km in CWC's river network (National Water Data Portal).",
        tributaries: "None in the district. CWC's network has the Goddu Vanka and the Niva joining it in Chittoor district, Andhra Pradesh.",
        flowsInto: "The Palar: it 'merged with Palar River at Wallajah Taluk' (DDMP 2025, p.9); CWC ends it at Nandiyalam, Wallajah. CGWB calls it the Ponnaiyar among the Palar's major tributaries (Vellore brochure, 2009, p.7).",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names it (text search). The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Ponnai in Ranipet district in the documents read.",
      },
    },
    {
      riverId: "cheyyar",
      displayName: "Cheyyar",
      displayNameLocal: "செய்யாறு",
      subHydroshedIds: ["SB91"],
      color: "#7c3aed",
      narrative: "The Cheyyar touches the district only along its southern line in Kalavai taluk: 12.3 km of mapped course in the map's clip, 9.9 km of it within 300 m of the line by Soraiyur village panchayat, with Tiruvannamalai district across, and 1.3 km inside in short pieces. Its WRD sub-basin is the district's second largest catchment, 471.9 sq km in Arcot, Kalavai and Walajapet taluks (10.8% of the sub-basin). Inside the district that catchment drains through streams CWC's river network names the Kalavimaduvu, 46.6 km, all inside the district (its own card), and the Irumbedumaduvu, 17.0 km inside, which receives the Kalavimaduvu and reaches the Cheyyar at Thozhupedu in Tiruvannamalai district; the Irumbedumaduvu is not drawn. CWC maps 2,892 ha of the Shenbagathope reservoir project's command area and 458 ha of the Thandarai anicut's in the district. The sub-basin holds 76 of the register's units, 6 of them red-category tanneries. Arcot taluk extracts 112.8% of its groundwater recharge (over-exploited) and Kalavai 78.8% (semi-critical), 2024-2025.",
      attributes: {
        origin: "Inner Javudu reserve forest, Tirupathur district, where CWC's river network starts it.",
        length: "12.3 km mapped in the map's clip (OSM), 1.3 km inside the district line. Whole river: 194.83 km in CWC's river network (National Water Data Portal).",
        tributaries: "In this catchment, CWC's Irumbedumaduvu (not drawn), which receives the Kalavimaduvu (drawn, its own card). CWC's network also has the Kamandala Naganadi and the Manjalar joining it in Tiruvannamalai district.",
        flowsInto: "The Palar, at Angambakkam in Kanchipuram district (CWC river network). WRD: a proposed canal from the Sathanur dam would link the Pennaiyar 'with Palar River through Cheyyar River' (WRD policy note 2025-26, p.54).",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names it (text search).",
        restorationInitiatives: "No scheme in Ranipet district was found in the documents read. Downstream, WRD lists an anicut across the Cheyyar near Silambakkam in Uthiramerur taluk, Kancheepuram district, Rs.35.21 crore (WRD policy note 2025-26, p.96), and a revised detailed project report of Rs.370.00 crore for phase I of the Pennaiyar (Sathanur dam) to Cheyyar link (p.55).",
      },
    },
    {
      riverId: "kalavimaduvu",
      displayName: "Kalavimaduvu",
      subHydroshedIds: [],
      color: "#db2777",
      narrative: "The Kalavimaduvu is drawn from CWC's river network; no other official text naming it was found in the documents read. CWC records it as 46.57 km from Punganur reserve forest, Arcot, to Thattacheri, Arcot, where it joins the Irumbedumaduvu, which CWC carries on to the Cheyyar at Thozhupedu in Tiruvannamalai district. All 46.6 km lie inside the district: 19.4 km in Arcot, 17.8 km in Kalavai and 9.4 km in Walajapet taluk, from the reserve forest in Timiri block south-east past Ayilam, Sathur and K.Velur to Irunghur village panchayat, where the line ends 1.46 km from the Cheyyar's mapped course. It passes the Kalavai tank (300.1 ha), the second largest of the district's 552 named tanks, and comes within 1.2 km of the Palar near Pudupadi. The register places 30 units within 2 km of it, 8 of them red-category tanneries (5 at Kathiavadi and 3 at Visharam). It is the main drawn stream of the Cheyyar sub-basin inside the district: the TNGIS watersheds it runs through, 4C2A1 and 4C2A6, hold 446 of the sub-basin's 471.9 sq km here, but the Irumbedumaduvu, not drawn, also crosses 4C2A1 and 4C2A5, so the sub-basin stays on the Cheyyar card, the river WRD names it after, and selecting the Kalavimaduvu keeps every layer in view. Arcot taluk extracts 112.8% of its groundwater recharge (over-exploited), Walajapet 97.2% (critical) and Kalavai 78.8% (semi-critical), 2024-2025.",
      attributes: {
        origin: "Punganur reserve forest, Arcot, as CWC labels it (CWC river network); the line starts in Timiri block (TNGIS).",
        length: "46.6 km, all inside the district (CWC line); CWC's own figure is 46.57 km.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Irumbedumaduvu at Thattacheri (CWC river network), which CWC carries to the Cheyyar at Thozhupedu, Cheyyar taluk, Tiruvannamalai district.",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names it (text search).",
        restorationInitiatives: "No known public record of a restoration scheme in the documents read.",
      },
    },
    {
      riverId: "kosasthalaiyar",
      displayName: "Kosasthalaiyar",
      displayNameLocal: "கொசஸ்தலையாறு",
      subHydroshedIds: ["SB144"],
      color: "#d97706",
      narrative: "The Kosasthalaiyar's catchment is the district's largest: 856.2 sq km of WRD's Kosasthalaiyar sub-basin, 44.0% of it, across Sholingur, Nemili, Arakkonam and Walajapet taluks. The district plan places its 'origin point at Kaveripakkam surplus' (Ranipet DDMP 2025, p.9). OpenStreetMap's course runs 39.4 km, all inside the district: 16.7 km in Arakkonam, 16.3 km in Nemili and 6.4 km in Sholingur taluk, from Govindacheri east past the Mahendravadi tank to Pudukesavaram on the eastern line. For its lower 21.3 km it runs in the channel CWC's river network calls the Kallar; the map draws that shared reach as the Kosasthalaiyar, and the Kallar's own line stops where the two meet near Kilkalathur. CWC starts the Korttalaiyar/Kushasthalaiar at Uriyur, Arakonam, where the Kallar ends, and runs it 98.09 km to the sea at Kattivakkam in Thiruvallur district. The Kaveripakkam tank (1,048.8 ha) is the largest of the district's 552 named tanks and the Mahendravadi tank (261.1 ha) the third, after Kalavai's (300.1 ha). The sub-basin holds 129 of the register's units, 23 of them red-category quarries and 8 red-category textile processing units; 16 units lie within 2 km of the river, 11 of them quarries. Arakkonam, Nemili and Sholingur taluks extract 75.3%, 74.8% and 76.4% of their groundwater recharge (semi-critical, 2024-2025).",
      attributes: {
        origin: "'kosasthalayar river origin point at Kaveripakkam surplus' (DDMP 2025, p.9). The mapped course starts 2.8 km from the Kaveripakkam tank's outline.",
        length: "39.4 km, all inside the district (OSM mapped course). CWC: the Korttalaiyar/Kushasthalaiar runs 98.09 km from Uriyur, Arakonam, to the sea (CWC river network).",
        tributaries: "In the district, the Kallar and the Kaveripakkam Ar, which meet it near Kilkalathur and Kilvenkatapuram (CWC river network and OSM). Downstream CWC's network has the Nagari (Kundeti), which the Nandi joins, and the Allikkuli flowing into it in Thiruvallur district.",
        flowsInto: "The Bay of Bengal, at Kattivakkam in Thiruvallur district (CWC river network).",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names it (text search).",
        restorationInitiatives: "No scheme in Ranipet district was found in the documents read. Downstream, WRD's flood mitigation works for 'widening of Adyar and Kosasthalaiyar' in Chennai and Kancheepuram districts, Rs.250.00 crore, report seven of eight works completed (WRD policy note 2025-26, p.105).",
      },
    },
    {
      riverId: "nandi",
      displayName: "Nandi Ar",
      subHydroshedIds: ["SB34"],
      color: "#65a30d",
      narrative: "The Nandi Ar rises in the north-west of the district and flows north-east into Thiruvallur district. CWC's river network starts it at Katharikuppam, Wallajah, and runs it 58.47 km to Ramapuram, Tiruttani taluk, where it joins the Nagari (Kundeti). Of its 33.9 km mapped in the map's clip, 16.6 km lies inside the district in three pieces, 14.5 km in Sholingur and 2.1 km in Walajapet taluk, and 7.9 km runs within 300 m of the northern line. CWC's Ayalambedu gauge on it, in Venguppattu village panchayat, read no flow on 973 of 1,586 days with a reading from June 2018 to February 2026 (61.3%); the highest, 123.134 cubic metres a second, was on 5 December 2020. The portal files the station under the Kosasthalaiyar. Its WRD sub-basin, Nandhiyar, covers 189.0 sq km of the district, mostly in Arakkonam taluk (150.6 sq km), and holds 33 of the register's units; 14 units lie within 2 km of the river.",
      attributes: {
        origin: "Katharikuppam, Wallajah taluk as CWC labels it (CWC river network); the mapped course starts in Palleri village panchayat, Walajah block.",
        length: "16.6 km inside the district, 33.9 km in the map's clip (OSM). Whole river: 58.47 km in CWC's river network.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Nagari (Kundeti) at Ramapuram, Tiruttani taluk, Thiruvallur district, which CWC's network then carries to the Korttalaiyar (Kosasthalaiyar).",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists (text search; the only hits for Nandi are the Nandirajhor in Odisha).",
        restorationInitiatives: "No known public record of a restoration scheme for the Nandi in Ranipet district in the documents read.",
      },
    },
    {
      riverId: "kallar",
      displayName: "Kallar",
      subHydroshedIds: [],
      color: "#0d9488",
      narrative: "The Kallar is drawn from CWC's river network, because OpenStreetMap does not name it here. CWC records it as 56.21 km from Rendadi, Wallajah, to Uriyur, Arakonam, where both the Cooum and the Korttalaiyar begin in CWC's network, and gives its confluence as the Cooum. The district plan gives a different start: 'kallar river origin at Mahendravadi channel' (Ranipet DDMP 2025, p.9). Its lower 21.3 km, from near Kilkalathur to Uriyur, run in the channel OpenStreetMap names the Kosasthalaiyar; the map draws that shared reach as the Kosasthalaiyar, so the Kallar's line here runs 34.9 km from Rendadi to Kilkalathur, where it meets the Kosasthalaiyar: 19.8 km in Sholingur, 8.5 km in Arakkonam and 6.6 km in Nemili taluk, all inside the district. CWC's Kaveripak and Tirumalapura streams join it on the shared reach. The register places 29 units within 2 km of the drawn line, 7 of them red-category quarries. It lies wholly in the Kosasthalaiyar sub-basin, which is on that card, so selecting it keeps every layer in view.",
      attributes: {
        origin: "Rendadi, Wallajah taluk as CWC labels it (CWC river network); TNGIS places Rendadi in Sholinghur block. The district plan: 'kallar river origin at Mahendravadi channel' (DDMP 2025, p.9).",
        length: "35.0 km drawn, all inside the district (CWC line, 34.9 km of it from Rendadi to Kilkalathur); the remaining 21.3 km to Uriyur are drawn as the Kosasthalaiyar. CWC's own figure for the whole Kallar is 56.21 km.",
        tributaries: "CWC's Kaveripak (the Kaveripakkam Ar) and Tirumalapura, which CWC records as joining the Kallar, both on the reach drawn here as the Kosasthalaiyar.",
        flowsInto: "CWC gives its confluence as the Cooum, at Uriyur, Arakonam, the point where CWC's Cooum and Korttalaiyar both begin. On this map its line joins the Kosasthalaiyar near Kilkalathur.",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names a Kallar (text search).",
        restorationInitiatives: "No known public record of a restoration scheme in the documents read.",
      },
    },
    {
      riverId: "kaveripakkam",
      displayName: "Kaveripakkam Ar",
      subHydroshedIds: [],
      color: "#a16207",
      narrative: "The Kaveripakkam Ar leaves the Kaveripakkam tank, a WRD tank of 1,048.8 ha on the TNGIS register, in Cheri village panchayat: its mapped course starts 0.02 km from the tank's outline. It runs 27.4 km east, 25.0 km in Nemili and 2.5 km in Arakkonam taluk, to meet the Kosasthalaiyar at Kilvenkatapuram, on the reach CWC calls the Kallar. CWC's river network calls it Kaveripak, 44.51 km from Kalmelkuppam, Wallajah, to Kilvenkatapuram, with its confluence the Kallar; 23.2 km of OpenStreetMap's course follows CWC's line. The district's Tamil page on the tank records that it was dug in the 8th century, holds 1474 million cubic feet, has a bund 8.35 km long, spreads over 3968 acres and irrigates about 19500 acres in 14 villages (ranipet.nic.in, Kaveripakkam Eri, in Tamil). PWD listed the tank among water bodies proposed for desilting (PWD policy notes 2014-15, p.113; 2015-16, p.120). The register places 13 units within 2 km of the stream. It lies wholly in the Kosasthalaiyar sub-basin, which is on that card, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Kaveripakkam tank in Cheri village panchayat (mapped course; the tank's outline from the TNGIS register). CWC starts its Kaveripak at Kalmelkuppam, Wallajah.",
        length: "27.4 km, all inside the district (OSM mapped course); CWC: 44.51 km.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Kallar in CWC's river network, at Kilvenkatapuram, Nemili, on the shared reach this map draws as the Kosasthalaiyar.",
        pollutedStretch: "Not in CPCB's 2015, 2018, 2022 or October 2025 lists; none of the four names it (text search).",
        restorationInitiatives: "PWD: 'Kaveripakkam tank in Palar basin of Vellore District' among tanks proposed for desilting (PWD policy note 2014-15, p.113); the 2015-16 note lists it among tanks recommended for desilting (p.120). No later status was found in the documents read.",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Ranipet", TN_WRD_CATCHMENTS, "Rivers"),
    CWC_CANALS,
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    cwcGauges("River flow and water quality (CWC gauges)", "CWC gauge: river flow and water quality (tap for charts)"),
    TN_GROUNDWATER_WELLS,

    // Pressures: one register, one toggle per TNPCB category and sector
    tnpcbIndustries(
      [
        {
          value: "red-textile",
          label: "Red: textile processing (bleaching, dyeing, printing)",
          color: "#be123c",
        },
        {
          value: "red-metal-treatment",
          label: "Red: metal surface treatment (pickling, plating, anodising)",
          color: "#e11d48",
        },
      ],
      "Orange category",
    ),
    { family: "industrial-estates", label: "SIPCOT industrial land: Ranipet Phases I to III and its SEZ; Panapakkam general, SEZ and the footwear cluster (MLFAC)", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },
    { family: "cepi-area", label: "CEPI critically polluted area: core zone frame through the plan's four points (TNPCB plan, 2020)", floor: "pressures", geom: "fill", color: "#9f1239", defaultOn: false, outline: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "cetp-operating",
        label: "Common effluent treatment plants (tanneries): in operation",
        color: "#7e22ce",
      },
      {
        value: "cetp-not-operating",
        label: "Common effluent treatment plants (tanneries): not in operation (temporary), June 2026",
        color: "#a8a29e",
      },
    ]),
    cwcCommandAreas([
      {
        value: "palar-anicut-system",
        label: "Palar Anicut System",
        color: "#2563eb",
      },
      {
        value: "shenbagathope-res",
        label: "Shenbagathope reservoir project",
        color: "#7c3aed",
      },
      {
        value: "poiney-anicut-system",
        label: "Poiney Anicut System",
        color: "#0891b2",
      },
      {
        value: "thandarai-anicut",
        label: "Thandarai Anicut",
        color: "#65a30d",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, water bodies and named tanks: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,844 outlines in the district (676 named or 5 ha and above, 1,168 smaller), 580 of which carry a name; area is computed from each outline. Named tanks are the 552 the all-tanks register names. The 288 village panchayats cover 1,628 of the district's 1,847 sq km.",
    "Rivers: OpenStreetMap contributors (ODbL) for the Palar, Ponnai, Cheyyar, Kosasthalaiyar, Nandi Ar and Kaveripakkam Ar, and CWC's river network (National Water Data Portal) for the Kallar and the Kalavimaduvu, which OpenStreetMap does not name here; all clipped to the district plus 1.6 km so that the Palar, Ponnai, Cheyyar and Nandi, which run along the district line, stay on the map. CWC's Kallar and OpenStreetMap's Kosasthalaiyar share 21.3 km of channel from near Kilkalathur to Uriyur; that reach is drawn once, as the Kosasthalaiyar, and the Kallar's line stops where the two meet.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Palar Anicut System (89.9 km inside the district) and the Poiney Anicut System (6.6 km); four command areas, Palar Anicut System (17,309 ha mapped in the district), Shenbagathope reservoir (2,892 ha), Poiney Anicut System (2,300 ha) and Thandarai Anicut (458 ha). Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units: TNGIS industry register matched to land parcels, 608 units in the district (213 red, 292 orange and 103 green or white category), filed under TNPCB's Vellore (587) and Ranipet (21) district offices. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code.",
    "Treatment plants: the three tannery common effluent treatment plants on the register (Ranipet Tannery Effluent Treatment Company at Vannivedu, Ranipet Finished Leathers Effluent Treatment Company at Karai and Visharam Tanners Enviro Control Systems at Visharam). TNPCB's 2020 tannery list and the state's June 2026 progress report name four in Ranipet district; the fourth, the SIPCOT-SIDCO Phase II Entrepreneur Finished Leather plant, is not on the register and is not drawn. The June 2026 report lists two of the four as in operation and two as not in operation (temporary); each drawn plant's colour follows that report (Ranipet Tannery and Ranipet SIDCO in operation, Visharam not in operation), and its card gives TNPCB's 2020 consented quantity.",
    "Industrial estates: SIPCOT GIS outlines of the Ranipet Industrial Complex (Phases I, II and III and its SEZ) and of Panapakkam (General, MLFAC and SEZ); area as SIPCOT states it.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 7 CGWB and 11 Tamil Nadu state telemetry stations (six-hourly, 2026) and 24 CGWB manual wells (quarterly readings, January 2021 to January 2025); CGWB's wells keep the parent district's tag, Vellore. Depth is in metres below ground level; each well shows its latest reading and date.",
    "River gauges: CWC's manual daily discharge at Arcot on the Palar (4,344 days with a reading, 1979 to June 2026; about one reading a month before 2013) with CWC water quality samples from 1995, and at Ayalambedu on the Nandi (1,586 days, June 2018 to February 2026), from the National Water Data Portal.",
    "Polluted stretch: none is drawn. No CPCB list (2015, 2018, 2022, October 2025) carries a stretch in Ranipet district; the Palar's 2015 and 2022 stretches are at Vaniyambadi in Tirupathur district, and the state's progress reports to NMCG since September 2025 record its delisting on 2022-2023 data. Each is cited by page on the Palar card.",
    "CEPI area: the core zone of TNPCB's January 2020 action plan for the CEPI area of SIPCOT Industrial Complex, Ranipet, drawn as the polygon through the four reference points the plan prints (p.8); it encloses 1.8 sq km against the plan's 3.40 sq km, which the plan gives as SIPCOT Phase-I and Phase-II (p.7). SIPCOT's Phase I and Phase II outlines on the estates layer hold all four points and enclose 3.85 sq km. Scores are CPCB's (2009, 2011, 2013, 2018) and TNPCB's (2019 to 2025).",
  ],
};

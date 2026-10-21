import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, cwcGauges,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Tiruchirappalli district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/tiruchirappalli-rivers/, built by scripts/build_tiruchirappalli_rivers_basin.py. The basin id is "tiruchirappalli-rivers";
// the district's own scope is "tn-tiruchirappalli". Scaffolded by scripts/new_district_basin.py.
export const TIRUCHIRAPPALLI_RIVERS: BasinManifest = {
  basinId: "tiruchirappalli-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Tiruchirappalli district: rivers, groundwater and industry",
  displayNameLocal: "திருச்சிராப்பள்ளி மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Tiruchirappalli district in one map: the Cauvery from Pettavaithalai to the Upper Anicut at Mukkombu, where the Kollidam branches off to carry its flood water, the Ayyar, Kulaiyar, Koraiyar, Ariyar and South Vellar that drain the district, the Uyyakondan, Pullambadi and New Kattalai channels that carry the rivers' water across it, groundwater extraction by taluk, and the 501 industrial units on Tamil Nadu's own register. Manapparai, Musiri, Thuraiyur and Marungapuri taluks extract more groundwater than is recharged (143%, 131.5%, 127.4% and 119.6%, 2024-2025). The register lists 72 quarrying and mining units, 15 river-sand quarry units beside the Cauvery, the Kollidam and the Kulaiyar, and five of the district's six red-category metal surface treatment units in the Ponnaniyar catchment south of the Cauvery. CPCB's October 2025 list carries the Cauvery through the district within a Priority II stretch from Erode to Pitchavaram; its Musiri station read a maximum BOD of 14 mg/L over 2022 and 2023 and 2.4 mg/L in 2024. The Corporation's sewage treatment plant discharges into the Koraiyar, and TNPCB's 2019 plan records no sewage outfall into the Cauvery itself in the district. Click a river to scope every layer to its catchment.",
  mapCenter: [10.89, 78.57],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 4506,
  areaNote:
    "Computed from the TNGIS district boundary. The catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district. The district website gives 4,404 sq km, the 2011 Census handbook 4509 sq km and CGWB's brochure 4403.83 sq km.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "cauvery",
      displayName: "Cauvery",
      displayNameLocal: "காவிரி",
      subHydroshedIds: ["SB128", "SB118", "SB129", "SB119", "SB116"],
      color: "#1e3a8a",
      narrative: "The Cauvery enters the district at Pettavaithalai and leaves it at Vengur (TNPCB Cauvery action plan, p.160); about 96 km of its mapped course runs along or inside the district line, 60 km of it inside. At the Upper Anicut (Mukkombu), between Elamanur and Vathalai, it divides: the Kollidam takes the flood water and the Cauvery carries water for irrigation (PWD policy note 2019-20, p.56). CWC's Musiri gauge has read its flow daily since June 1972. Its highest monthly mean there is 2,334 cubic metres a second, in August 2022, and 17 months since 1972 averaged no flow at all, the last five from March to July 2017. TNPCB's four 2023 stations named for places in the district (Musiri, Pettaivaithalai, Tiruchirappalli upstream and downstream) read BOD of 4 mg/L at most, at Pettaivaithalai in January, and dissolved oxygen as low as 4.2 mg/L at Tiruchirappalli upstream in November (TNPCB monthly water quality data 2023, PDF pp.1, 41), against bathing criteria of 3 and 5 mg/L (TNPCB Cauvery action plan, p.168). The five catchments that drain to it here cover 1,770 sq km and hold 212 of the district's 501 registered units, all six of its red-category metal surface treatment units and its three SIPCOT outlines. The register also lists seven river-sand quarry units within 600 m of its mapped course, from Mullipadi and Unniyur to Pettavaithalai.",
      attributes: {
        origin: "Talakaveri, on the Brahmagiri range of the Western Ghats in Karnataka, at about 1341 m (CWC, Cauvery basin page). In the district, 'Entry point of the river cauvery is pettavaithalai and exit point is Vengur Village' (TNPCB Cauvery action plan, p.160).",
        length: "96 km along or inside the district, 60 km of it inside the boundary (OSM mapped course). TNPCB counts '45.0 KM in Trichy District' (Cauvery action plan, p.160); the Census handbook, describing the Cauvery and the Coleroon together, gives 'about 125 Kms' (DCHB 2011, p.4). Whole river: about 800 km (CWC).",
        tributaries: "The Census handbook names the Coleroon, Koraiyar, Ariyar, Malattar channel, Uyyakondan channel and Pullambadi canal (DCHB 2011, p.4); CGWB names 'Ayyar and Uppar in the north and Koraiyar in the south' as the prominent ones (district brochure 2008, p.4).",
        flowsInto: "Bay of Bengal at Poombuhar (TNPCB Cauvery action plan, p.11).",
        pollutedStretch: "CPCB, October 2025: Priority II, 'RIVER CAUVERY AT ERODE NEAR VIRAPALAYAM TO PITCHAVARAM', maximum BOD 24 mg/L on the 2022 and 2023 basis (Annexure III A, S.No.122, p.81 of the printed report). Of its stations, Musiri read a maximum of 14 mg/L and Pettaivaithalai 4 mg/L over 2022 and 2023 (Annexure II, p.66), and 2.4 and 2.6 mg/L in 2024 (Annexure XIV, p.135). The 2022 list placed the river at Priority III with 'KATTIPALAYAM TO TRICHY' among its reaches, maximum BOD 17.0 mg/L, read at the station CPCB labels 'RIVER CAUVERY AT TRICHY, GRAND ANAICUT' (Table 27, p.25; Annexure I, p.51). The 2018 list carried 'METTUR TO MAYILADUTHURAI' at Priority I, BOD 3.3 to 32 mg/L on 2016 and 2017 data (Table 3, PDF p.6). TNPCB's action plan (2019) records 'There is no sewage outfall points in the River Cauvery, Trichy District' (p.169); the Corporation's treated sewage goes to the Koraiyar (p.161), and Musiri and Sirugamani town panchayats let sullage into irrigation channels (pp.172-173).",
        restorationInitiatives: "Tiruchirappalli Corporation's 58.64 MLD sewage treatment plant treats 55.00 MLD a day and discharges into the Korai river; a 100 MLD plant at Panjappur, Rs.233.87 crore, is in progress, and 26 of the 65 wards have underground drainage (MAWS policy note 2025-26, pp.99-100). The State's June 2026 report to the NGT shows its 100 MLD 'Trichy (PRS)' plant at 70% with a July 2026 timeline, a second Tiruchirappalli plant of 37 MLD under trial run, and Musiri's 3.2 MLD plant at 70% (Tamil Nadu monthly progress report, June 2026, PDF pp.7, 8, 21). Nadanthaai Vaazhi Cauvery (WRD) aims 'to rejuvenate and to effectively curb sewage polluting the Cauvery River and its tributaries in Tamil Nadu'; the National River Conservation Directorate has approved Rs.934.301 crore, and the revised project report and the State share are 'under consideration of the Government' (WRD policy note 2025-26, pp.76-78).",
      },
    },
    {
      riverId: "kollidam",
      displayName: "Kollidam (Coleroon)",
      displayNameLocal: "கொள்ளிடம்",
      subHydroshedIds: ["SB125"],
      color: "#2563eb",
      narrative: "The Kollidam branches off the Cauvery at the Upper Anicut (Mukkombu), 'the neck of the Srirangam Island' (DCHB 2011, p.81), and carries the river's flood water (PWD policy note 2019-20, p.56). About 56 km of its mapped course runs inside or along the district, 38 km of it inside the line. The anicut Arthur Cotton built across it in 1836 was converted into a regulator in 1902; on 22 August 2018 the piers and shutters of vents 6 to 14 across the South Kollidam collapsed, and the State sanctioned a new regulator downstream at Rs.387.60 crore (PWD policy note 2019-20, pp.57-60). Its north-bank catchment, TN WRD's Nandiyar-Kulaiyar sub-basin, covers 1,103 sq km, mostly in Lalgudi and Mannachanallur taluks, holds 186 registered units, more than any other catchment in the district, and the Uppar dam. The register lists six river-sand quarry units within 500 m of its mapped course, at Koohur, Thalakudi, Uthamarseri and Keela Anbil.",
      attributes: {
        origin: "'Upper Anaicut or Mukkombu is the neck of the Srirangam Island where the River Kollidam branches off from Cauvery' (DCHB 2011, p.81).",
        length: "56 km inside or along the district, 38 km inside the boundary (OSM mapped course). No official length for the whole river was found in the sources read.",
        tributaries: "TN WRD lists the Uppar, Uppodai, Nandiyar, Upodaiyar and Kulaiyar for the Nandiyar-Kulaiyar sub-basin on its north bank, 1532.27 sq km across Trichy, Ariyalur and Perambalur (TN WRD, Cauvery basin page).",
        flowsInto: "No official source read in this pass states where the Kollidam meets the sea.",
        pollutedStretch: "CPCB's lists name no Kollidam stretch in this district. CPCB's 2025 Cauvery stretch includes a station it calls 'RIVER CAUVERY AT COLEROON', maximum BOD 16 mg/L over 2022 and 2023 and 8 mg/L in 2024 (Annexure II, p.66; Annexure XIV, p.135); the report gives no place for it.",
        restorationInitiatives: "Strengthening of the existing South Kollidam barrage, Rs.38.85 crore: 'the work has been completed' (PWD policy note 2020-21, p.73). The new regulator across the Southern and Northern arms of the Kollidam, Rs.387.60 crore under NABARD assistance, is to serve 12,01,507 acres in four delta districts and 56,953 acres in Tiruchirappalli and Ariyalur through the Pullambadi, Peruvalai and Ayyan channels (PWD policy note 2019-20, pp.59-60). The 2020-21 note records works 'in progress in fast pace' (p.74), and the WRD policy note 2024-25 pictures the 'New Regulator across Kollidam River' with an estimate of Rs. 414.00 crore (photo page after p.253). No public document read so far records its completion.",
      },
    },
    {
      riverId: "kulaiyar",
      displayName: "Kulaiyar",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "OpenStreetMap names this line the 'Kolaiyar River'; no official source read uses that name. TN WRD lists the Kulaiyar among the rivers of the Nandiyar-Kulaiyar sub-basin in which the line runs (TN WRD, Cauvery basin page), and the Cauvery River Atlas prepared for the National River Conservation Directorate lists 'Kulaiyar R' among the district's rivers and as a sub-basin north of the Kollidam (Tables 3 and 6, pp.20, 30). About 35 km of it is mapped, east through Lalgudi taluk to the Kollidam at the district's eastern edge; Lalgudi taluk extracts 41% of its groundwater recharge (2024-2025). The Kothari Sugars sugar mill, distillery and cogeneration plant at Sirumayangudi stand 0.9 to 1.3 km from its mapped course, and the register lists two river-sand quarry units on it, at Alambadi and Viragaloor.",
      attributes: {
        origin: "No official source read states where the Kulaiyar rises.",
        length: "35 km of mapped course, all but 0.3 km inside the district (OSM). No official length was found.",
        tributaries: "None named in the sources read. The Nandiyar shares its sub-basin (TN WRD, Cauvery basin page).",
        flowsInto: "The Kollidam: the mapped course ends on it at the district's eastern edge (OSM). No official source read names the confluence.",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Kulaiyar in the WRD, TNPCB or district documents read. A check dam across the Nandiyar in Iruthayapuram village, Lalgudi taluk, Rs.3.00 crore, was in progress in 2016-17 (PWD policy note 2016-17, p.240).",
      },
    },
    {
      riverId: "ayyar",
      displayName: "Ayyar",
      displayNameLocal: "அய்யாறு",
      subHydroshedIds: ["SB112"],
      color: "#d97706",
      narrative: "The Ayyar runs about 51 km of mapped course through Thuraiyur and Musiri taluks to the Cauvery at the Upper Anicut. Its sub-basin, TN WRD's Ayiaar, covers 1,105 sq km of the district, 83% of the whole, and both taluks it drains extract more groundwater than is recharged: Musiri 131.5% and Thuraiyur 127.4% (2024-2025). CWC has gauged it at Thandalaiputhur since November 2021: 20 of the 33 months with readings averaged no flow at all, including every month with readings from March 2025 to June 2026. The catchment holds 83 registered units and 134 named tanks.",
      attributes: {
        origin: "No official source read states where the Ayyar rises.",
        length: "51 km of mapped course inside the district (OSM). No official length was found. TN WRD gives the Ayiaar sub-basin as 1326.503 sq km across Namakkal and Trichy (Cauvery basin page).",
        tributaries: "TN WRD lists the Gundarnadhi with the Ayiaar for this sub-basin (Cauvery basin page).",
        flowsInto: "The Cauvery: the PWD policy note 2017-18 names the Sarabanga, Thirumanimuthar 'and Ayyar rivers which are all tributaries of the River Cauvery' (p.178). Its mapped course ends at the Upper Anicut (OSM).",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying. CWC's samples at Thandalaiputhur averaged BOD 1.4 to 2.6 mg/L a year from 2021 to 2023, on one to six samples a year.",
        restorationInitiatives: "A check dam across the Ayyar near Thandalaiputhur village, Musiri taluk, Rs.2.59 crore, was 85% complete in 2016-17 (PWD policy note 2016-17, p.240). The State's link canal from the Mettur dam through the Sarabanga, Thirumanimuthar, Karaipottanar and Ayyar, under investigation, would carry Mettur's flood surplus to tanks on the way; its second phase runs to Keerambur tank near Thuraiyur (WRD policy note 2025-26, pp.45-46).",
      },
    },
    {
      riverId: "koraiyar",
      displayName: "Koraiyar",
      displayNameLocal: "கோரையாறு",
      subHydroshedIds: [],
      color: "#b45309",
      narrative: "The Koraiyar drains a 632 sq km catchment 'covered by a large number of tanks' (DCHB 2011, p.4); only its last 5.8 km, through Tiruchirappalli city, is mapped here. It takes the city's treated sewage: the Corporation's 58.64 MLD plant discharges 55.00 MLD a day into the 'Korai river' (MAWS policy note 2025-26, p.99), which the 2023-24 note names the Koraiyar (p.124) and the 2024-25 note the 'Korayar channel' (p.122). TNPCB's 2019 action plan recorded the plant at 88.64 MLD design capacity at K. Sathanoor, 9 km from the Cauvery, discharging 'into river Koraitay' (p.161). No CPCB or TNPCB sampling station on the Koraiyar appears in the reports read. Its catchment here is TN WRD's Ponnaniyar sub-basin, shared with the Ariyar: 1,089 sq km, where Manapparai taluk extracts 143% of its groundwater recharge (2024-2025).",
      attributes: {
        origin: "'Koraiyar river rises from Karuppur Reddiyarpatti hill R.F at an elevation of about 500m' (DCHB 2011, p.4).",
        length: "5.8 km mapped inside the district, through Tiruchirappalli city (OSM). The whole river: 'the length is 75 km', with a catchment of 632 sq km (DCHB 2011, p.4).",
        tributaries: "None named in the sources read. It 'carries water from catchment areas of Puttanattam, Viralimalai, Malaikudippatti, Tennalur, Illupur, Kalluppatti, Arur, Kulakkattai gudi, Keeranur and Thuvarankurichi' (DCHB 2011, p.4).",
        flowsInto: "The Census handbook counts it among the Cauvery's tributaries in the district (DCHB 2011, p.4); the district's Disaster Management Plan describes the 'Kudamurutti river that collect water from koraiyar in Pudukottai District and Ariyar' (DDMP 2026, p.26). Its mapped course ends in the city where CWC's two Uyyakondan lines meet (OSM; CWC canal network).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or 2025 lists, and no CPCB or TNPCB monitoring station on the Koraiyar appears in them or in TNPCB's 2023 monthly data.",
        restorationInitiatives: "TNPCB's 2019 plan recommends that the Corporation 'shall provide additional Sewage Treatment Plant within the time frame as per the action plan' (p.179). The district administration's release of 4 July 2026 describes a Rs.81.72 crore 'New Peripheral Road Project Along Koraiyar and Uyyakondan River Banks'; it is a road project. No known public record of a restoration scheme for the Koraiyar itself in the documents read.",
      },
    },
    {
      riverId: "ariyar",
      displayName: "Ariyar",
      displayNameLocal: "அரியாறு",
      subHydroshedIds: [],
      color: "#a16207",
      narrative: "The Ariyar rises in the Manapparai area and drains about 832 sq km (DCHB 2011, p.4). OpenStreetMap maps it here in two pieces, 10.5 km on the Manapparai side and 1.4 km in Tiruchirappalli city; the course between them is not mapped. Its catchment here is TN WRD's Ponnaniyar sub-basin, shared with the Koraiyar: Manapparai taluk extracts 143% of its groundwater recharge and Marungapuri 119.6% (2024-2025), and the sub-basin holds the SIPCOT Manapparai and Tiruchirappalli outlines, 329 named tanks and 108 registered units. The district's Disaster Management Plan records that in the 2005 north-east monsoon the 'Ariyaru River breached the banks on Punganur' (DDMP 2026, p.26).",
      attributes: {
        origin: "'Ariyar river rises in Manapparai area from Pallivelli Mukku at an elevation of about 700m' (DCHB 2011, p.4).",
        length: "11.9 km mapped inside the district, in two pieces (OSM). No official length was found; the catchment is 'about 832 Sq.km' (DCHB 2011, p.4).",
        tributaries: "None named in the sources read. It 'carries water from Kadavur and Semmalai reserved forests, Vairampattai, Kulattur and Manapparai areas' (DCHB 2011, p.4).",
        flowsInto: "The Census handbook counts it among the Cauvery's tributaries in the district (DCHB 2011, p.4); the Disaster Management Plan has the Kudamurutti collecting water from the Koraiyar and the Ariyar (DDMP 2026, p.26).",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for the Ariyar in this district in the WRD, TNPCB or district documents read.",
      },
    },
    {
      riverId: "vellar",
      displayName: "South Vellar",
      displayNameLocal: "தெற்கு வெள்ளாறு",
      subHydroshedIds: ["SB132"],
      color: "#0d9488",
      narrative: "OpenStreetMap's 'Vellar River' in Marungapuri taluk lies in TN WRD's South Vellar sub-basin of the Agniyar basin, which TN WRD places in Pudukkottai, Trichy and Thanjavur with the Kundar, Vellar and Karaiyar (TN WRD, Agniyar basin page). About 18 km of it is mapped, 12 km inside the district. The 343 sq km of the sub-basin inside the district holds 512 named tanks, more than any other catchment on the map, and Marungapuri taluk extracts 119.6% of its groundwater recharge (2024-2025). The register lists 13 units here. The first phase of the State's link canal from the Cauvery to the Agniyar, South Vellar, Manimuthar, Vaigai and Gundar runs from the Kattalai barrage to the South Vellar; for its 5.355 km flood carrier in Tiruchirappalli and Pudukkottai and the Karur slice, the State reports about 87% of works complete (WRD policy note 2025-26, pp.41-42).",
      attributes: {
        origin: "No official source read states where this Vellar rises.",
        length: "18 km of mapped course, 12 km inside the district (OSM). No official length was found. TN WRD gives the sub-basin as 1770.01 sq km (Agniyar basin page).",
        tributaries: "TN WRD lists the Kundar and Karaiyar with the Vellar for this sub-basin (Agniyar basin page).",
        flowsInto: "No source read in this pass states where it ends.",
        pollutedStretch: "Not in CPCB's October 2025 list. The list names only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "Not a restoration scheme: the link canal's first phase 'from Cauvery (Kattalai Kathavanai) to South Vellar' has in-principle approval at Rs.6941.00 crore; 126.92 hectares of patta land have been acquired in Tiruchirappalli district (WRD policy note 2025-26, pp.41-42). No known public record of a restoration scheme for the river itself.",
      },
    },
    {
      riverId: "uyyakondan-channel",
      displayName: "Uyyakondan Extension Channel",
      displayNameLocal: "உய்யக்கொண்டான் வாய்க்கால்",
      subHydroshedIds: [],
      color: "#7c3aed",
      narrative: "The Uyyakondan has its head in Pettavaithalai village, Srirangam taluk (PWD policy note 2015-16, p.118), and runs east through Tiruchirappalli city to Thiruverumbur. The line drawn is what CWC calls the Uyya Kondan Extension Channel, 43.2 km, all inside the district; CWC files a further 11.7 km upstream as the Uyya Kondan Channel, shown on the canal layer, and places both under the Kattalai system. Within 2 km of the extension the register lists 23 units, among them the Indian Oil terminal at Valavanthankottai (0.3 km), the BHEL high pressure boiler plant at Navalpattu (0.4 km) and two galvanisers at Thuvakudi (1.8 to 1.9 km), three of the district's six red-category metal surface treatment units. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'the head of Uyyakondan Channel in Pettavaithalai Village in Srirangam Taluk of Trichy District' (PWD policy note 2015-16, p.118).",
        length: "43.2 km drawn, all inside the district (CWC's Uyya Kondan Extension Channel), and 11.7 km that CWC files upstream as the Uyya Kondan Channel (CWC canal network). No official length was found.",
        tributaries: "Not applicable to a channel. The rehabilitation of the sand vent at its head was to benefit 32,742 acres (PWD policy note 2015-16, p.118).",
        flowsInto: "No official source read states where it ends. CWC's line ends east of Thiruverumbur, in the Cauvery Delta sub-basin (CWC canal network).",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches. None of the CPCB or TNPCB documents read samples the channel or lists an outfall into it.",
        restorationInitiatives: "Rehabilitation of the sand vent at its head, Rs.137 lakh, was in progress in 2015-16 (PWD policy note 2015-16, p.118). The district administration's news of 29.08.2026 reports water hyacinth removal on the Uyyakondan irrigation channel under way as a first phase, on the Collector's orders (district Tamil website). The Rs.81.72 crore road along the Koraiyar and Uyyakondan banks (district release, 4 July 2026) is a road project.",
      },
    },
    {
      riverId: "pullambadi-channel",
      displayName: "Pullambadi Channel",
      displayNameLocal: "புள்ளம்பாடி வாய்க்கால்",
      subHydroshedIds: [],
      color: "#4338ca",
      narrative: "The Pullambadi channel is one of three the new Upper Anicut regulator is to serve: 56,953 acres in Tiruchirappalli and Ariyalur 'through Pullambadi, Peruvalai and Ayyan voikal' (PWD policy note 2019-20, p.60). CWC's canal network maps 52.7 km of its main channel inside the district, through Mannachanallur and Lalgudi taluks, and 144 km of the whole Pullambadi system here once its branches, distributaries and minors are counted, with 4,743 ha of its command area. Within 1 km of the main channel the register lists 24 units, among them the Pullambadi town panchayat slaughter house. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Upper Anicut (Mukkombu): CWC's main-channel line starts beside the head of the Kollidam (CWC canal network), and the new regulator there is to serve it (PWD policy note 2019-20, p.60).",
        length: "52.7 km of main channel inside the district; 144 km of the Pullambadi system in the district (CWC canal network). A WRD bridge work places the main channel at mile 49/3 in Kattur village, Ariyalur taluk (PWD policy note 2014-15, p.164).",
        tributaries: "Not applicable to a channel. CWC's Pullambadi Canal project: medium, approved 1957, culturable command area 5.99 thousand ha, potential created 8.95 thousand ha, serving Ariyalur and Tiruchirappalli (CWC water resource projects).",
        flowsInto: "No official source read states where it ends; the main channel continues into Ariyalur district (PWD policy note 2014-15, p.164).",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches.",
        restorationInitiatives: "No known public record of a rehabilitation scheme for the Pullambadi channel itself in the documents read, beyond the Upper Anicut regulator works that serve it (PWD policy notes 2019-20 and 2020-21).",
      },
    },
    {
      riverId: "new-kattalai-canal",
      displayName: "New Kattalai High Level Canal",
      displayNameLocal: "புதிய கட்டளை மேட்டு வாய்க்கால்",
      subHydroshedIds: [],
      color: "#047857",
      narrative: "One of four canals that take off at the Kattalai barrage at Mayanur in Karur district, with the South Bank, Kattalai High Level and North Bank canals; together they serve 1,01,312 acres (PWD policy note 2014-15, pp.27-28). It enters the district from Karur and runs east, south of the Cauvery, through Srirangam and Thiruverumbur taluks. CWC's canal network maps 55.7 km of it inside the district, 244 km of the whole Kattalai system here and 24,935 ha of the Kattalai command area. Within 1 km of it the register lists six units, one of them the High Energy Projectile Factory at Poolangudi, a red-category metal surface treatment unit. It crosses catchments, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The Kattalai barrage, 'constructed across Cauvery River at 250 m downstream of existing Kattalai bed regulator at Mayanur Village in Krishnarayapuram Taluk of Karur District' (PWD policy note 2014-15, p.27); the New Kattalai High Level canal is one of its four off-take canals (p.28).",
        length: "55.7 km inside the district (CWC canal network). No official length was found.",
        tributaries: "Not applicable to a canal. CWC's Kattalai project: major, culturable command area 30.09 thousand ha, potential created 49.45 thousand ha, serving Karur and Tiruchirappalli (CWC water resource projects).",
        flowsInto: "No official source read states where it ends. CWC's line continues east out of the district from Thiruverumbur taluk (CWC canal network).",
        pollutedStretch: "Not applicable: CPCB's list covers river stretches.",
        restorationInitiatives: "ERM works in the Kattalai High Level Canal Irrigation System, with the Noyyal sub-basin and Rajavoikkal systems, Rs.749.50 crore, 'have been completed' (WRD policy note 2025-26, p.17); the note does not say which canals of the system the works covered.",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Tiruchirappalli", TN_WRD_CATCHMENTS, "Rivers and canals"),
    { family: "prs", label: "Polluted stretch (CPCB)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: false },
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
          value: "red-metal-treatment",
          label: "Red: metal surface treatment (pickling, plating, galvanising)",
          color: "#e11d48",
        },
      ],
      "Orange category (hospitals, stone crushers, M-sand, river sand quarries and others)",
    ),
    { family: "industrial-estates", label: "SIPCOT estates (Tiruchirappalli park, Manapparai DTA and food park)", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "stp",
        label: "Sewage treatment plant on the register (Dalmia Cement's own plant, Kallakudi)",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "kattalai",
        label: "Kattalai system (New Kattalai High Level Canal, Uyyakondan)",
        color: "#15803d",
      },
      {
        value: "pullambadi-canal",
        label: "Pullambadi Canal",
        color: "#65a30d",
      },
      {
        value: "nandhiyar-channel",
        label: "Nandhiyar Channel",
        color: "#a3e635",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 4,150 rows for the district, 4,022 of them with a geometry. 602 outlines are 5 ha or larger and 449 of those carry a name; 813 smaller outlines are named too. The water-bodies layer shows every named outline and every outline of 5 ha or more, 1,415 in all. Area is computed from each outline. Named tanks are the 1,262 the all-tanks register names out of 3,110 tank outlines inside the district. Village panchayats cover 3,703 of the district's 4,506 sq km: town panchayats, municipalities, the corporation and reserve forest are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Cauvery and Kollidam reaches on the district line stay on the map. OSM's spellings are folded into one course each (Kaveri as the Cauvery, Aiyar as the Ayyar, Koraiaru and Koraiyar as the Koraiyar, Ariyar River and Ariyaru as the Ariyar). The line OSM names 'Kolaiyar River' is shown as the Kulaiyar, the name TN WRD gives a river of the sub-basin it runs in; no official source read uses 'Kolaiyar'. OSM's 'Vellar River' in Marungapuri taluk is shown as the South Vellar.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): 244 km of the Kattalai system, 144 km of the Pullambadi system, 5 km of the Cauvery Mettur system and 4 km of the Nandhiyar channel inside the district, with the Kattalai, Pullambadi Canal and Nandhiyar Channel command areas. The Uyyakondan Extension Channel, the Pullambadi Channel and the New Kattalai High Level Canal can be selected like rivers. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 502 units for the district (501 industrial units and one sewage treatment plant). Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code. The register does not say whether a unit is operating today.",
    "SIPCOT estates: SIPCOT GIS (sipcotgis.tn.gov.in), industrial complex outlines for the SIPCOT Industrial Park, Tiruchirapalli (Elanthapatti and Sooriyur villages, 149 acres), Manapparai DTA (959.4 acres) and the Manapparai Food Park (144.8 acres), areas as SIPCOT states them. The server's Manapparai layer returned an error when probed on 21 October 2026, so it is not drawn.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 110 wells, 66 CGWB manual (quarterly readings, 2021 to 2025), 14 CGWB telemetry and 30 state telemetry (six-hourly, 2026). Depth is in metres below ground level; each well shows its latest reading and date. Stations are placed by their coordinates, so six wells the portal tags as Tiruchirappalli but which lie outside the district are left out.",
    "Reservoirs: TN WRD's register on TNGIS, two waterspreads on or inside the district line (Uppar, in the Nandiyar-Kulaiyar sub-basin, and Ponnaniyar, which the register places in Karur district, just outside the line). Storage for Uppar comes from the state's daily reservoir dashboard, relayed by RIMES on a beta host, with the reading's date: depth in feet, storage in Mcft and percentage of capacity, as it prints them. The dashboard states no licence of any kind and is a relay rather than the issuing department. Its 'Ponnaiyar' point lies 1.4 km outside the Ponnaniyar waterspread and no capacity figure confirms the identity, so Ponnaniyar carries no reading.",
    "River flow and water quality: Central Water Commission, from the National Water Data Portal (NWIC). Musiri on the Cauvery: manual daily discharge from June 1972, shown as monthly means, and the annual mean of CWC's samples, 1978 to 2024. Thandalaiputhur on the Ayyar: daily discharge from November 2021 and samples from 2021 to 2023.",
    "Treatment plants: the register's one sewage treatment plant is Dalmia Cement Bharat's own plant at Kallakudi. The Corporation's plants are not on the register; they are described on the Cauvery and Koraiyar cards from the MAWS policy notes and the State's June 2026 progress report to the NGT.",
    "River cards: TN WRD policy notes 2024-25 and 2025-26 and PWD (Irrigation) policy notes 2014-15 to 2020-21; MAWS policy notes 2023-24 to 2025-26; TNPCB's 2019 action plan for the Cauvery (Mettur to Mayiladuthurai) and its 2023 monthly water quality data; CPCB's polluted river stretch reports of 2018, 2022 and October 2025; the 2011 District Census Handbook; CGWB's 2008 district brochure; the district's 2026 Disaster Management Plan and website; TN WRD's basin pages; and the Cauvery River Atlas prepared for the National River Conservation Directorate. Each card cites its pages.",
    "No TNPCB real-time water quality station lies in the district, and no known public source gives Tiruchirappalli industrial water intake or online effluent monitoring readings.",
  ],
};

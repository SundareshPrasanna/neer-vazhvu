import type { BasinManifest } from "./types";
import {
  districtFrame, TN_WRD_CATCHMENTS, CWC_CANALS, reservoirs, TNGIS_WATER_BODIES, TNGIS_WATERSHEDS, tnpcbRealtime,
  TN_GROUNDWATER_WELLS, tnpcbIndustries, INGRES_TALUKS, treatmentPlants, cwcCommandAreas, TN_ADMIN,
} from "./district-layers";

// Tiruppur district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is
// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under
// public/data/basins/tiruppur-rivers/, built by scripts/build_tiruppur_rivers_basin.py. The basin id is "tiruppur-rivers";
// the district's own scope is "tn-tiruppur". Scaffolded by scripts/new_district_basin.py.
export const TIRUPPUR_RIVERS: BasinManifest = {
  basinId: "tiruppur-rivers",
  cityIds: [],
  stateCode: "TN",
  displayName: "Tiruppur district: rivers, groundwater and industry",
  displayNameLocal: "திருப்பூர் மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",
  blurb:
    "Tiruppur district in one map: the Noyyal, which runs through Tiruppur city and then along the district's north-eastern line past the Orathupalayam dam, with its tributaries the Nallar and the Kousika; the Amaravathi, which leaves the Amaravathi dam in Udumalpet taluk and crosses the south and east of the district, with its headwater the Chinnar on the southern line and its tributary the Nallathangal Odai in Dharapuram taluk; the Aliyar in the south-western corner; the canals of the Parambikulam Aliyar, Amaravathy and Lower Bhavani projects; six reservoirs; the 12 sq km CEPI core zone on the Noyyal; groundwater extraction by taluk; and the 2,061 industrial units on Tamil Nadu's own register. Palladam and Tiruppur South taluks extract more groundwater than is recharged (120.9% and 105.0%, 2024-2025). 641 of the register's 645 red-category textile processing units lie in the Noyyal's catchment, 207 of them within 2 km of the river, and 14 of the 18 textile common effluent treatment plants the state lists at Tiruppur are on the register. CPCB scored Tiruppur 72.39 on its pollution index for industrial areas in 2018, a critically polluted area; TNPCB's later rounds score it between 23.31 and 46.99, and 25.214 after the 2025 monsoon (TNPCB CEPI plan, 2020, and score sheet, 2026). CPCB listed the Amaravathi along Madathukulam and Karur as a polluted stretch in 2022 (Priority V); the state's reports since September 2025 record that CPCB has delisted it. No CPCB list names the Noyyal. Click a river to scope every layer to its catchment.",
  mapCenter: [10.84, 77.41],
  mapZoom: 10,
  defaultFitFamilies: ["boundary"],
  areaKm2: 5171,
  areaNote:
    "Computed from the TNGIS district boundary (5,170.9 sq km); the district profile on tiruppur.nic.in gives 5087.26 sq km (District Abstract). The five catchments are TN WRD's sub-basins cut to that boundary, 5,170.4 sq km in all: Amaravathi 3,201, Noyel 1,577, Palar 242, Lower Bhavani 113 and Aliyar 39. Each continues outside the district; the Palar and Aliyar sub-basins belong to the Parambikulam Aliyar basin.",
  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],
  rivers: [
    {
      riverId: "noyyal",
      displayName: "Noyyal",
      displayNameLocal: "நொய்யல்",
      subHydroshedIds: ["SB126"],
      color: "#d97706",
      narrative: "The Noyyal is the river of Tiruppur city, which stands on its banks (Tiruppur District Survey Report, May 2019, p.5). About 85 km of its mapped course runs along or inside the district: it follows the district line upstream of Mangalam, runs wholly inside for 31 km from Mangalam through Tiruppur city, and then follows the north-eastern line past the Orathupalayam dam. TNPCB counts 76.4 km in the district, from Pendevipalayam village to the Muthur barrage (TNPCB CEPI action plan, January 2020, p.22). Its catchment here, 1,577 sq km, holds 1,569 of the register's 2,061 industrial units and 641 of its 645 red-category textile processing units, 207 of them within 2 km of the river; 8 of the 14 common effluent treatment plants on the register lie within 1 km of it. The 2020 plan records that the textile units of its 12 sq km core area treat their effluent with zero liquid discharge, and that untreated sewage of 86.9 MLD from 41 of Tiruppur Corporation's 60 wards was being discharged into the river (pp.22, 28). The state's June 2026 report lists four sewage treatment plants at Tiruppur, 86 MLD of capacity with 28.75 MLD in use (Tamil Nadu MPR to NMCG, p.20). TNPCB's sensors at Mangalam and Kasipalayam bridge read monthly mean BOD of 7.98 mg/l (August 2026) and 5.96 mg/l (October 2026), against the bathing criterion of 3 mg/l or less (TNPCB Cauvery action plan, 2019, p.143); these are sensor readings, not laboratory results. Palladam and Tiruppur South taluks, in this catchment, extract 120.9% and 105.0% of their groundwater recharge (over-exploited, 2024-2025).",
      attributes: {
        origin: "'the Vellingiri hills in the Western Ghats in Coimbatore District' (TNPCB CEPI action plan, 2020, p.22).",
        length: "85 km along or inside the district (OSM mapped course), 56 km of it inside the district line; TNPCB gives 76.4 km in the district (CEPI action plan, p.22). Whole river: 182.137 km (Cauvery River Basin Atlas, NRCD, 2025, p.65); WRD gives 179 km (WRD dam details, 2024, Noyyal Orathupalayam entry).",
        tributaries: "In Tiruppur the Koushika River and the Nallaru Odai, which join it 'near Mangalam and near Velliyampalayam Village respectively' (TNPCB CEPI action plan, p.22). The Atlas's main-stem diagram also shows the Chinnakarai joining above the Nallar (p.66); WRD lists Chinnakarainadhi among the Noyel sub-basin's streams (TN WRD, Cauvery basin page).",
        flowsInto: "The Cauvery 'at Noyyal Village in Karur District' (TNPCB CEPI action plan, p.22); the Atlas gives the confluence as Avadaiyaparai (p.66).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists, and none of the three reports names the river (text search). TNPCB's 2019 Cauvery plan treats the Noyyal as the source of pollution in the Cauvery in Karur district, from dyeing and bleaching units in Tiruppur district (p.139). In December 2006 the Madras High Court gave Tiruppur's common effluent treatment plants until 31 July 2007 to achieve zero liquid discharge and directed payments towards cleaning the Orathupalayam dam; in 2009 the Supreme Court gave the units three months to comply and directed the Pollution Control Board 'to ensure that no pollution is caused' (Supreme Court judgment of 6 October 2009, pp.3, 11; non-government copy, IELRC).",
        restorationInitiatives: "Extension, Renovation and Modernisation of the Noyyal River System (WRD): G.O.(Ms).No.209 of 22.11.2019, Rs.230 crore of State funds in three packages; Package III, LS 72 km to 158.35 km, covers Tiruppur South, Uthukuli and Kangeyam taluks, and all three packages report 100% physical progress (WRD project slides, slides 2 and 4); the policy note records the Noyyal sub-basin works as completed (WRD policy note 2025-26, p.28). Rehabilitation of the Muthur barrage shutters and the head sluices of the feeder canal to the Athupalayam reservoir, Kangeyam taluk, Rs.7.00 crore (PWD policy note 2016-17, p.138). The state's June 2026 report lists 18 textile common effluent treatment plants at Tiruppur, each in operation and connected to TNPCB's online monitoring (pp.53-54).",
      },
    },
    {
      riverId: "nallar",
      displayName: "Nallar",
      subHydroshedIds: [],
      color: "#0891b2",
      narrative: "The Nallar, which TNPCB calls the Nallaru Odai, rises at 'Annur in Coimbatore District' and joins the Noyyal 'near Velliyampalayam Village'; it also feeds the Nanjarayan lake (TNPCB CEPI action plan, 2020, p.22). Its mapped course runs 32.6 km, all inside the district, through Avinashi (18.2 km), Tiruppur North (8.4 km) and Uthukkuli (5.8 km) taluks to the Noyyal at Mudalipalayam, east of Tiruppur city; the Cauvery River Basin Atlas shows it joining the Noyyal above the Orathupalayam dam (p.66). The register places 398 industrial units within 2 km of it, among them 193 red-category textile processing units, 135 of those in Tiruppur North taluk, and three common effluent treatment plants within 0.5 km: Angeripalayam, S.Periyapalayam and Park. A different stream of the same name, in the Palar sub-basin of the Parambikulam Aliyar basin near Thirumurthi, is not drawn. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'Annur in Coimbatore District' (TNPCB CEPI action plan, 2020, p.22).",
        length: "32.6 km, all inside the district (OSM mapped course, named Nallaru). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Noyyal 'near Velliyampalayam Village' (TNPCB CEPI action plan, p.22); on the map it meets the Noyyal in Mudalipalayam village panchayat, Tiruppur South taluk.",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme for this Nallar in the documents read. The Nirar-Nallar scheme in WRD's policy note concerns the other Nallar, 'a tributary of Palar in Bharathapuzha basin' (WRD policy note 2025-26, pp.160-161).",
      },
    },
    {
      riverId: "kousika",
      displayName: "Kousika",
      subHydroshedIds: [],
      color: "#7c3aed",
      narrative: "The Kousika reaches the Noyyal at the district's north-western edge near Mangalam, upstream of Tiruppur city. TNPCB records that the 'Koushika River originating from Kurudi Hills in Coimbatore District' joins the Noyyal 'near Mangalam' (TNPCB CEPI action plan, 2020, p.22). About 7.2 km of its mapped course lies inside Avinashi taluk and 5.4 km runs within 300 m of the district line; the mapped course ends 0.14 km outside the line, 1.1 km from the Noyyal. The register places 16 red-category textile processing units within 2 km of it and none within 1 km. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'Kurudi Hills in Coimbatore District' (TNPCB CEPI action plan, 2020, p.22).",
        length: "13.2 km mapped, 7.2 km of it inside the district (OSM, named Kousika river). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "The Noyyal 'near Mangalam' (TNPCB CEPI action plan, p.22).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "CWC's planning wing replied in April 2021 that 'No project proposal on Kousika river of Tamil Nadu was submitted/under appraisal in WP&P Wing of CWC' (CWC reply under the RTI Act, 6 April 2021). No known public record of a restoration scheme in the documents read.",
      },
    },
    {
      riverId: "amaravathi",
      displayName: "Amaravathi",
      displayNameLocal: "அமராவதி",
      subHydroshedIds: ["SB113"],
      color: "#2563eb",
      narrative: "The Amaravathi leaves the Amaravathi dam in Udumalpet taluk and crosses the south and east of the district through Madathukkulam and Dharapuram taluks to Karur district. The district survey report traces its course: it 'debouches into the plains near Kallapuram', receives the Kudiriyar at Kumaragam, 'flows into the Dindigul district to emerge again into the Dharapuram taluk', and receives the Uppar after Dharapuram (Tiruppur District Survey Report, May 2019, p.15). About 120 km of its mapped course is inside the district, 68 km of it in Dharapuram taluk, and about 12 km between Madathukulam and Alangiyam runs within 300 m of the district line. Its sub-basin is the district's largest catchment, 3,201 of 5,171 sq km, but holds 474 of the 2,061 registered industrial units and 4 of the 645 red-category textile processing units, none of them within 2 km of the river. CWC maps 27,220 ha of the Amaravathy project's command area and 244 km of its canals inside the district. On the state dashboard on 21 October 2026 the Amaravathi reservoir read 15.0% of capacity (609 Mcft), and the reservoirs on its tributaries 1.6% (Uppar), 0.1% (Vattamalaikarai Odai) and 0.0% (Nallathangal Odai).",
      attributes: {
        origin: "'the Munnar Hills in Kerala' (TN WRD, Amaravathy dam page). The district survey report: 'The Chinnar river originates from Anamalai hills joins with another river called Tenar of Palani hills, and form a Amaravathi river' (Tiruppur District Survey Report, 2019, p.15).",
        length: "120 km inside the district (OSM mapped course, including the 18 km reach from Karatholuvu to Kongur that OpenStreetMap maps without a name and the build joins to the river). Whole river: 227 km (TN WRD, Amaravathy dam page); 195.132 km measured from Amaravathinagar (Cauvery River Basin Atlas, NRCD, 2025, p.52).",
        tributaries: "In Tiruppur the Kudiriyar, received 'on the right at Kumaragam', and the Uppar, after Dharapuram (District Survey Report, 2019, p.15). CGWB names 'the Uppar Odai, Shanmukha Nadi, Nallathangal Odai and Vattamalakkarai' as its major tributaries in the then Erode district (CGWB Erode brochure, 2008, p.6). The Nallathangal Odai has its own card.",
        flowsInto: "The Cauvery 'at Kattalai in the Kulitalai taluk' (District Survey Report, 2019, p.15); WRD gives Thirumakudalur near Karur (Amaravathy dam page).",
        pollutedStretch: "CPCB's 2022 list carried the Amaravathi 'ALONG MADHUTHUKKULAM AND ALONG KARUR' as Priority V, maximum BOD 4.0 mg/l on 2019 and 2021 data (p.35); the Madathukulam station, 'RIVER AMRAVATI AT 1KM D/S FROM EFF.DIS. PT. AT MADHUTHUKKULAM', read 3.4 mg/l (p.60). CPCB's own record for that station places it at 10.5412 N, 77.3687 E, on the river where it is the line between Madathukkulam taluk and Dindigul district (National Water Data Portal, CPCB water quality, 2021). The state's reports record that the action plan for the stretch was approved by the River Rejuvenation Committee and sent to CPCB in October 2024 (MPR, June 2026, p.74), and from September 2025: 'Based on the water quality data for the year 2022-2023, CPCB has delisted Amaravathi and Palar River from the list of PRS' (MPR, September 2025, p.63; June 2026, p.6). Neither CPCB's 2018 list nor its October 2025 list carries an Amaravathi stretch in Tamil Nadu.",
        restorationInitiatives: "The state's June 2026 report lists a 0.50 MLD sewage treatment plant for Madathukulam town panchayat, marked PRS, at DPR stage, and the Amaravathi dam among ten reservoirs proposed for desilting (Tamil Nadu MPR to NMCG, pp.32, 74). The Amaravathi dam is among the 35 dams the Dam Safety Review Panel inspected (WRD policy note 2025-26, p.69). No other restoration scheme specific to the Amaravathi in Tiruppur was found in the documents read.",
      },
    },
    {
      riverId: "chinnar",
      displayName: "Chinnar",
      subHydroshedIds: [],
      color: "#0d9488",
      narrative: "The Chinnar is a headwater of the Amaravathi on the district's southern edge: 16.5 of its 16.8 mapped km lie within 300 m of the district line and 11.3 km inside Udumalpet taluk, and its mapped course ends 1.6 km from the start of the Amaravathi's. The district survey report records that 'The Chinnar river originates from Anamalai hills joins with another river called Tenar of Palani hills, and form a Amaravathi river' (Tiruppur District Survey Report, 2019, p.15); TNPCB describes the Amaravathi as the 'continuation of the Pambar and Chinnar Rivers in Kerala' (TNPCB Cauvery action plan, 2019, p.138). The register places no industrial unit within 2 km of it. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "'Anamalai hills' (District Survey Report, 2019, p.15).",
        length: "16.8 km mapped, 11.9 km of it inside the district line (OSM, named Chinnar River). No official length was found.",
        tributaries: "None named in the documents read.",
        flowsInto: "It forms the Amaravathi with the Tenar (District Survey Report, 2019, p.15); TNPCB names the Pambar and the Chinnar (Cauvery action plan, p.138).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "No known public record of a restoration scheme in the documents read.",
      },
    },
    {
      riverId: "nallathangal",
      displayName: "Nallathangal Odai",
      displayNameLocal: "நல்லதங்காள் ஓடை",
      subHydroshedIds: [],
      color: "#0369a1",
      narrative: "The Nallathangal Odai is a tributary of the Amaravathi in Dharapuram taluk. WRD records that it rises on the northern slope of the Palani Hills and 'confluences with Amaravathi River near Nattakattupudur in Dharapuram', 46 km in all (WRD dam details, 2024). About 14.4 km of its mapped course lies inside the district, all of it in Dharapuram taluk, down to its meeting with the Amaravathi. The Nallathangal Odai reservoir, on its course in Ponnivadi village panchayat, benefits Dharapuram taluk; its construction was completed in 2007 and it was first opened for irrigation on 5.04.2008 (WRD dam details, 2024). It read 0.0% of capacity (0.0 Mcft, at 6.56 of 29.52 ft) on the state dashboard on 21 October 2026. The register places 5 units within 2 km of the stream, 3 of them green or white category and 2 red-category quarrying units. It has no WRD sub-basin of its own, so selecting it keeps every layer in view.",
      attributes: {
        origin: "The northern slope of the Palani Hills (WRD dam details, 2024, Nallathangal Odai Reservoir entry).",
        length: "14.4 km inside the district, all in Dharapuram taluk (OSM mapped course); 'Total length of Nallathangal Odai is 46kms' (WRD dam details, 2024).",
        tributaries: "None named in the documents read.",
        flowsInto: "The Amaravathi, 'near Nattakattupudur in Dharapuram' (WRD dam details, 2024). CGWB names it one of the Amaravathi's major tributaries (CGWB Erode brochure, 2008, p.6).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "Upstream in Dindigul district, PWD reported a new tank across the Nallathangal Odai near Kothayam village, Oddanchatram taluk, with a storage capacity of 36.10 Mcft at an estimated Rs.6.97 crore, in progress, to benefit 808 acres of new ayacut (PWD policy note 2014-15, p.36), and 80% of works completed in its scheme table (p.121). No later status was found in the documents read.",
      },
    },
    {
      riverId: "aliyar",
      displayName: "Aliyar",
      displayNameLocal: "ஆழியாறு",
      subHydroshedIds: ["SB86"],
      color: "#65a30d",
      narrative: "The Aliyar touches the district only in its south-western corner: 3.8 km of its mapped course lies inside Udumalpet taluk, in the Aliyar sub-basin of the Parambikulam Aliyar basin, and 7.7 km runs within 300 m of the district line. WRD records that it rises 'in the Anaimalai hills in Valparai Taluk of Coimbatore District' and 'finally joins the Bhrathaphuzha river which flows into the Arabian Sea' (TN WRD, Aliyar dam page). It is one of the rivers the Parambikulam Aliyar Project uses, a project that benefits 'Pollachi, Palladam, Udumalaipettai and Dharapuram' taluks (WRD policy note 2025-26, p.159); CWC maps 173,851 ha of the project's command area and 710 km of its canals inside the district. Selecting it scopes the map to its 39 sq km sub-basin.",
      attributes: {
        origin: "'the Anaimalai hills in Valparai Taluk of Coimbatore District' (TN WRD, Aliyar dam page).",
        length: "3.8 km inside the district (OSM mapped course). WRD: it flows 'in a north westerly direction for about 22.5km then joins the Kannadi river' (Aliyar dam page).",
        tributaries: "WRD records that the Palar, on which the Thirumurthy reservoir stands in Udumalpet taluk, 'is a tributary of Aliyar river' (WRD dam details, 2024).",
        flowsInto: "'joins the Kannadi river and finally joins the Bhrathaphuzha river which flows into the Arabian Sea' (TN WRD, Aliyar dam page).",
        pollutedStretch: "Not in CPCB's 2018, 2022 or October 2025 lists. The lists name only rivers CPCB monitored and found non-complying.",
        restorationInitiatives: "The Parambikulam Aliyar agreement between Tamil Nadu and Kerala 'was due for review on 09.11.1988 and thereafter once in 30 years'; 27 meetings have been held for the review (WRD policy note 2025-26, p.159). The Aliyar and Thirumoorthy dams are among the 35 dams the Dam Safety Review Panel inspected (p.69).",
      },
    },
  ],
  layers: [
    // Structural context
    ...districtFrame("Tiruppur", TN_WRD_CATCHMENTS, "Rivers"),
    CWC_CANALS,
    reservoirs("Reservoirs (TN WRD register)", "Reservoir with a CWC level chart (tap)", "Reservoir with no level chart (its card gives the day's storage where the state dashboard reports it)"),
    ...TNGIS_WATER_BODIES,
    ...TNGIS_WATERSHEDS,

    // Monitoring & evidence
    tnpcbRealtime("Real-time sensor stations (TNPCB)"),
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
    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },
    { family: "cepi-area", label: "CEPI critically polluted area: core zone (TNPCB plan, 2020)", floor: "pressures", geom: "fill", color: "#9f1239", defaultOn: false, outline: true },

    // Governance: groundwater category by taluk, treatment, admin
    INGRES_TALUKS,
    treatmentPlants([
      {
        value: "cetp-operating",
        label: "Common effluent treatment plants (textile dyeing and bleaching): operating",
        color: "#7e22ce",
      },
      {
        value: "stp",
        label: "Sewage treatment plants (Tiruppur Corporation)",
        color: "#4f46e5",
      },
    ]),
    cwcCommandAreas([
      {
        value: "parambikulam-aliyar-irrigation",
        label: "Parambikulam Aliyar Project",
        color: "#65a30d",
      },
      {
        value: "amaravathy",
        label: "Amaravathy reservoir project",
        color: "#2563eb",
      },
      {
        value: "lower-bhavani",
        label: "Lower Bhavani Project",
        color: "#15803d",
      },
      {
        value: "palar-porandalar",
        label: "Palar Porandalar reservoir",
        color: "#0d9488",
      },
    ]),
    ...TN_ADMIN,
  ],
  credits: [
    "District, taluk, block and village panchayat boundaries, sub-basin catchments, the four watershed levels, reservoirs, water bodies, named tanks and mine leases: TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency.",
    "Water bodies: the TNGIS all-water-bodies register, 1,484 outlines in the district (151 named or 5 ha and above, 1,333 smaller), 74 of which carry a name; area is computed from each outline. Named tanks are the 53 the all-tanks register names. The 265 village panchayats cover 3,971 of the district's 5,171 sq km: town panchayats, municipalities, the corporation and reserve forest are not village panchayats.",
    "Rivers: OpenStreetMap contributors (ODbL), clipped to the district plus 1.6 km so that the Noyyal, the Chinnar and the Aliyar, which run along the district line, stay on the map. OpenStreetMap maps the Amaravathi's 18 km reach from Karatholuvu to Kongur without a name; that course is joined to the Amaravathi. A second stream named Nallar, in the Parambikulam Aliyar basin near Thirumurthi, is not drawn.",
    "Canals and command areas: Central Water Commission's canal network and water resource project layers, from the National Water Data Portal (NWIC): the Parambikulam Aliyar system (710 km inside the district), the Amaravathy system (244 km), the Lower Bhavani system (95 km) and 0.2 km of the Palar Porandalar system; four command areas. Lengths and mapped areas inside the district are computed from CWC's lines and polygons; culturable command area is CWC's own figure.",
    "Industrial units and treatment plants: TNGIS industry register matched to land parcels, 2,061 units in the district (948 red, 679 orange and 434 green or white category), filed under TNPCB's Tiruppur North and Tiruppur South offices. Unit ids follow TNPCB's consent-register format, with registrations from 2015 to 2024. The register holds only units TNGIS could match to a land parcel, so every count is a lower bound. Sector is read from TNPCB's own industry type code.",
    "Treatment plants: the 14 common effluent treatment plants and 3 Tiruppur Corporation sewage treatment plants on the register. Each common plant shows its status in the state's June 2026 progress report to NMCG (operation, renewal date, compliance) and its consented quantity in TNPCB's 2020 list. The two lists name 18 textile common effluent treatment plants at Tiruppur, all in operation; Arulpuram, Kallikadu, Tiruppur Murugampalayam and Andipalayam are not on the register and are not drawn.",
    "Groundwater: IN-GRES dynamic groundwater assessment 2024-2025 (CGWB with IIT Hyderabad), stage of extraction by taluk.",
    "Groundwater wells: National Water Data Portal (NWIC), groundwater level datasets for Tamil Nadu: 8 CGWB and 15 Tamil Nadu state telemetry stations (six-hourly, 2026) and 39 CGWB manual wells (quarterly readings, January 2021 to January 2025). Depth is in metres below ground level; each well shows its latest reading and date.",
    "Reservoirs: TN WRD's register on TNGIS, six waterspreads: Amaravathi and Thirumurthi (Udumalpet taluk), Nallathangal Odai and Uppar (Dharapuram taluk), Vattamalaikarai Odai (Kangeyam taluk), and Noyyal Orathupalayam, which lies on the district line and which the register files under Erode district (the Cauvery River Basin Atlas lists it in Tiruppur). Storage for all six comes from the state's daily reservoir dashboard (TN-SMART, relayed by RIMES), with the reading's date: depth in feet, storage in Mcft and percentage of capacity, as it prints them. The dashboard's Uppar and Vattamalaikarai are matched to the register's Uppar(Erode) and Vattamalaikarai Odai by position.",
    "Real-time sensor stations: TNPCB's real-time water quality monitoring dashboard, two stations on the Noyyal (Mangalam upstream and Kasipalayam bridge), as monthly means from October 2024. These are sensor readings, not laboratory results.",
    "Polluted stretch: none is drawn. CPCB's 2018 and October 2025 lists carry no stretch in Tiruppur district; its 2022 report listed the Amaravathi along Madathukulam and Karur (Priority V), and the state's progress reports to NMCG since September 2025 record its delisting on 2022-2023 data. No CPCB edition names the Noyyal. Each is cited by page on the river cards.",
    "CEPI area: the core zone of TNPCB's January 2020 action plan for the Tiruppur CEPI area, drawn as the polygon through the eight boundary points the plan prints (p.6); it encloses 11.9 sq km against the plan's 12 sq km. Scores are CPCB's (2009, 2018) and TNPCB's (2019 to 2025).",
  ],
};

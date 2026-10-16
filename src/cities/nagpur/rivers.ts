import type { CityRiversContent } from "@/content/rivers/types";

// Nagpur. Two records that never meet: NMC's own monsoon-2023 round on the
// Nag, Pili and Pora (ESR 2023-24 Tables 6.13-6.16), and MPCB's monthly NWMP
// readings on the Kanhan, Kolar and Wainganga around the city. CPCB's tables
// carry no readings for the Nag; MPCB's index for its state stations is in the
// river notes of public/data/river-quality-nagpur.json.
//
// length_km_geom is the mapped length inside the rivers frame
// (public/geojson/nagpur-rivers.geojson, MRSAC drainage clipped to the frame;
// the Nag is its main connected course only); keep it in step with that file. Nag project figures: NMC Budget 2025-26 narrative (PDF pp.10-11)
// and Budget 2026-27 (scan, OCR checked on page images pp.B-5 to B-7); GoM
// Environment & CC GR RANYO-2024/PK82, 3 Mar 2025, p.2 (8 years from the GoI
// order of 14.03.2023). Status phrases are translated from NMC's Marathi.
export const RIVERS: CityRiversContent = {
  metaDescription:
    "The Nag, Pili and Pora through Nagpur: NMC's 2023 readings at 23 sites and MPCB's index for its Nag stations, with MPCB's monthly readings on the Kanhan, Kolar and Wainganga around the city, 2017-2024.",
  // 23 of the points are NMC's sampling sites, not CPCB stations.
  header: {
    scopeLabel: "The Nag, Pili and Pora through the city, and the Kanhan below it",
    stationsLabel: "sampling points",
  },
  map: { center: [21.17, 79.22], zoom: 10 },
  riverInfo: {
    nag: {
      display_name: "Nag",
      display_name_mr: "नाग",
      length_km_geom: 80.3,
      description:
        "The river the city is named after. It flows out of Ambazari lake and runs for 17 km through the city before joining the Kanhan (NMC Environment Status Report 2023-24). The Nag River Pollution Abatement Project, under the National River Conservation Plan with a JICA loan, received the Ministry of Jal Shakti's administrative approval on 14.03.2023 at Rs 1,926.99 crore (Centre 1,115.22, State 507.36, NMC 304.41) for 520 km of sewers and 92 MLD of new treatment capacity at three sites. The State's order of 3 March 2025 sets the implementation period at eight years from that approval; JICA's appraisal gives July 2028 for completion. NMC's 2026-27 budget records that the work order for package 5 (electric crematoria at Mokshdham) was issued on 20.10.2025 and work has begun; tenders for packages 3 and 4 have been published, two bids have been received for package 3 and technical evaluation is under way; the package 2 tender draft is under scrutiny; and the package 1 survey is complete, with design in progress.",
      upstream_terminus: "Ambazari lake, west Nagpur",
      downstream_terminus: "The Kanhan, east of the city (MPCB's 2011 Nag River Basin Action Plan places the confluence at Agargaon)",
      feeds: "The Kanhan, and through it the Wainganga",
      status:
        "No CPCB readings. NMC, monsoon 2023: dissolved oxygen 3.67 mg/L at Ambazari, 0.48 at the end point. MPCB index 2023-24: 75 at Ambazari, 36 downstream.",
      cpcb_nwmp_stations: [
        "No CPCB readings. MPCB state stations 185-187 (national codes 5979-5981): near Ambazari lake (index 75, 2023-24), Bhandewadi bridge (36), Asoli bridge (36)",
      ],
      color: "#2563eb",
    },
    pili: {
      display_name: "Pili",
      display_name_mr: "पिवळी",
      length_km_geom: 23.4,
      description:
        "Flows east from Gorewada across the north of the city and meets the Nag near Pawangaon; 18 km of it lie within city limits (NMC Environment Status Report 2023-24, which spells it Pilli). JICA's appraisal names the Nag and the Pili as the two rivers the Nag project is meant to clean.",
      upstream_terminus: "Gorewada, north-west Nagpur",
      downstream_terminus: "The Nag near Pawangaon",
      feeds: "The Nag",
      status:
        "No CPCB readings. NMC, monsoon 2023: dissolved oxygen 4.2 mg/L at Gorewada, 0.74 to 2.87 below it. MPCB index 2023-24: 45 at Wanjra layout.",
      cpcb_nwmp_stations: [
        "No CPCB readings. MPCB state stations 188-189 (national codes 5982-5983): Wanjra layout (index 45, 2023-24), Mankapur",
      ],
      color: "#7c3aed",
    },
    pora: {
      display_name: "Pora",
      display_name_mr: "पोहरा",
      length_km_geom: 35.5,
      description:
        "Rises near Hingna in the south-west of the city and flows to the south-east (NMC Environment Status Report 2023-24); NMC's budgets call it the Pohra. The Pohra River Pollution Abatement project under AMRUT 2.0 (a 45 MLD treatment plant and sewers for the South sewerage zone, Hudkeshwar and Narsala) had work orders issued on 25.06.2024; NMC's 2026-27 budget reports 176 km of 537 km of sewer laid, physical progress of 35% and Rs 162 crore spent, and NMC aims to complete it by March 2027.",
      upstream_terminus: "Near Hingna, south-west Nagpur",
      downstream_terminus: "Meets the Nag and Pili at the city's outskirts (NMC Environment Status Report 2023-24)",
      feeds: "The Nag, and through the Kanhan and Wainganga, Gosikhurd Dam (NMC Environment Status Report 2023-24)",
      status:
        "No CPCB or MPCB station. NMC, monsoon 2023: dissolved oxygen 4.8 mg/L at the first point, 0.81 at the end point.",
      cpcb_nwmp_stations: [],
      color: "#0d9488",
    },
    kanhan: {
      display_name: "Kanhan",
      display_name_mr: "कन्हान",
      length_km_geom: 141.0,
      description:
        "The river below the city that the Nag and the Pili drain into, and one of Nagpur's sources of drinking water: NMC's Kanhan treatment plant is rated 240 MLD (NMC Environment Status Report 2023-24). MPCB's 2011 Nag River Basin Action Plan places the Nag's confluence at Agargaon, where station 1909 samples; its 2019 Kanhan action plan says near Ambhora. The same 2019 plan records the Vidarbha Paper Mills at Sinora as 'Closed last 5 years'; CPCB's names for stations 2170 and 2171 refer to the mill.",
      upstream_terminus: "Madhya Pradesh (CPCB lists a Kanhan stretch in Chhindwara district)",
      downstream_terminus: "The Wainganga near Ambhora",
      feeds: "NMC's Kanhan water treatment plant (240 MLD capacity), then the Wainganga",
      status:
        "CPCB Priority IV (2025). MPCB monthly at Agargaon below the city: BOD up to 9.8 mg/L in 2023 and 7.4 in 2024; dry every June 2019-2024.",
      cpcb_nwmp_stations: [
        "2170 Sinora, upstream of Vidarbha Paper Mills (BOD 3.5 mg/L max, 2024)",
        "2171 Sinora, downstream of Vidarbha Paper Mills (4.0)",
        "1909 Agargaon, downstream of Nagpur (7.4)",
      ],
      color: "#0891b2",
    },
    kolar: {
      display_name: "Kolar",
      display_name_mr: "कोलार",
      length_km_geom: 72.8,
      description:
        "A tributary from the north that passes Koradi and joins the Kanhan at Waregaon in Kamptee taluka. MPCB's 2019 action plan covers the stretch along Koradi; CPCB's 2025 report lists one polluted location, at Waregaon bridge.",
      upstream_terminus: "North of Nagpur, past Koradi",
      downstream_terminus: "The Kanhan at Waregaon, Kamptee taluka",
      feeds: "The Kanhan",
      status:
        "CPCB Priority IV (2025, one location at Waregaon). MPCB monthly: BOD up to 7.1 mg/L in 2024; dry May to August 2019.",
      cpcb_nwmp_stations: ["1908 Waregaon bridge, before the Kanhan confluence (BOD 7.1 mg/L max, 2024)"],
      color: "#b45309",
    },
    wainganga: {
      display_name: "Wainganga",
      display_name_mr: "वैनगंगा",
      length_km_geom: 33.6,
      description:
        "The larger river east of the city; the Kanhan joins it near Ambhora. MPCB samples it after the confluence at station 1910. Both official coordinates for that station are far from Ambhora, so it has no map marker; its readings are in the panel.",
      upstream_terminus: "Madhya Pradesh",
      downstream_terminus: "Bhandara and Chandrapur districts (CPCB's polluted stretch runs to Ashti)",
      feeds: "Bhandara and Chandrapur districts downstream",
      status: "CPCB Priority IV (2025, Bhandara to Ashti). MPCB monthly at Ambhora: BOD up to 4.2 mg/L in 2024.",
      cpcb_nwmp_stations: ["1910 Ambhora, after the Kanhan confluence (BOD 4.2 mg/L max, 2024; no map marker)"],
      color: "#1e40af",
    },
  },
};

import type { CityRiversContent } from "@/content/rivers/types";

// Jaipur. A contrast, not a gradient: the city drinks the Banas from Bisalpur,
// about 120 km away, and its own river, the Dravyavati, has no published
// readings on its channel. The nearest series is CPCB 2952 at Newta dam, which
// takes water diverted from the Dravyavati at Gular dam (RSPCB/MNIT action
// plan, Dec 2018, PDF pp.19 and 42); it is shown under the Dravyavati and
// named as indirect, and has no map marker because CPCB's coordinate for it is
// at Kanota (public/data/river-quality-jaipur.json, built by
// neer-vazhvu-api/scripts/build_jaipur_river_quality.py). Jal Mahal (2944) is
// a lake on the Darbhawati and belongs to the water-bodies page.
//
// length_km_geom is the reach drawn in public/geojson/jaipur-rivers.geojson
// (OSM, scripts/osm-layers/jaipur.json, method walk), measured on OSM data of
// 20 Oct 2026; keep it in step with that file. The Dravyavati is the
// exception: OSM maps it as a water outline, so the drawn length is not a river
// length and JDA's corridor length (EIA/EMP Chapter 2, 2017, PDF p.2) is used.
// Contract figures and dates: Rajasthan High Court, S.B. CWP 14997/2024, order
// of 19.12.2024, PDF pp.6-9 and 21 (web copy hosted by verdictum.in); later
// order: D.B. CWP 2905/2024, 23.07.2026 (hosted by livelaw.in).
export const RIVERS: CityRiversContent = {
  defaultRiverId: "dravyavati",
  metaDescription:
    "Jaipur's rivers: the Dravyavati through the city, with no published readings on its channel; CPCB readings at Newta dam and at Bisalpur, the city's source, from 2018 to 2024, and at Kanota in 2021; and Ramgarh on the Banganga, empty in October 2025 and 2026.",
  header: { scopeLabel: "The Dravyavati, the Dhund, and the Banas and Banganga dams" },
  map: { center: [26.9, 75.82], zoom: 9 },
  riverInfo: {
    dravyavati: {
      display_name: "Dravyavati",
      display_name_hi: "द्रव्यवती",
      color: "#2563eb",
      length_km_geom: 47.5,
      description:
        "Jaipur's own river. The Jaipur Development Authority's (JDA) 2017 environmental report calls it 'the active river of Jaipur which, over the time turned into a Nallah (Amanisha Nallah)'. It rises in the Nahargarh hills, collects storm and waste water from the Naharika nallah, Ambabari, the walled city's Ganda nallah, Sanganer and the Jawahar nallah, and 'ultimately discharges into Dhund River'. The state approved the project report on 14.10.2015, and JDA signed the contract on 18.03.2016 with the TPL-SUCG Consortium (Tata Projects and SUCG), the only bidder: Rs 1,470.85 crore to design and build a 47.50 km corridor and Rs 206.08 crore for ten years of operation and maintenance, Rs 1,676.93 crore in all. JDA issued a commissioning certificate on 09.12.2022. The Rajasthan High Court's order of 19.12.2024 (S.B. Civil Writ Petition 14997/2024) records that no channel was built in the submergence areas of three dams on the river, at Sikar, Gular and Ramchandrapura, directs JDA and the company to file yearly operation and maintenance reports, and has a public interest case, 'In Re: Rejuvenation of Dravyavati River', registered on the court's own motion. On 23.07.2026 a Division Bench (D.B. Civil Writ Petition 2905/2024) asked JDA to explain why drain channels recommended by NEERI were not built near Ambawadi; the case was listed for 12.08.2026. The state budget for 2025-26 set aside Rs 50 crore to upgrade the river for tourism.",
      upstream_terminus: "The Nahargarh hills, north-west of the walled city",
      downstream_terminus:
        "The Dhund, south-east of the city (JDA's 2017 environmental report); RSPCB's 2018 action plan names the Morel, in Dausa district",
      feeds:
        "Nevta dam, through a gated diversion channel from Gular dam (RSPCB's 2018 action plan), and the Dhund",
      status:
        "No agency publishes water-quality readings on the channel. At Newta dam, which takes water diverted from it, CPCB's highest BOD was above the 3 mg/L bathing limit every year from 2018 to 2024, and 36.5 mg/L in 2024.",
      cpcb_nwmp_stations: [
        "None on the channel. 2952 River near Newta dam (indirect: the dam takes water diverted from the Dravyavati; BOD 36.5 mg/L max, 2024; no map marker, as CPCB's coordinate for it is at Kanota dam)",
      ],
    },
    dhund: {
      display_name: "Dhund",
      display_name_hi: "ढूंढ",
      color: "#b45309",
      length_km_geom: 29.4,
      description:
        "A seasonal river east and south of the city, into which the Dravyavati flows. Kanota dam stands on it, completed in 2001 (CWC National Register of Large Dams 2019, which spells the river 'dhoond'). On 8 October 2026 the state's daily dam report showed Kanota full, at 14.13 million cubic metres. The district disaster plan lists Kanota Industrial Area and Dayodha among the places Kanota dam may affect.",
      upstream_terminus: "East of the city, above Kanota dam (Bassi tehsil)",
      downstream_terminus:
        "South-east of the city, towards the Morel; we have not found an official document naming the junction",
      feeds: "Kanota dam, an irrigation dam (CWC National Register of Large Dams 2019)",
      status:
        "CPCB has published one year of readings, at Kanota dam in 2021: BOD 2.0 to 5.2 mg/L, dissolved oxygen 1.1 to 4.2 mg/L. CPCB's November 2022 list names 'Kanota, along Sumel' a Priority IV polluted stretch (BOD 9.5 mg/L); its 2018 and 2025 lists do not.",
      cpcb_nwmp_stations: ["4781 Kanota dam, village Sumel, tehsil Bassi (BOD 5.2 mg/L max, 2021 only)"],
    },
    banas: {
      display_name: "Banas",
      display_name_hi: "बनास",
      color: "#0891b2",
      length_km_geom: 54.1,
      description:
        "The river that carries most of Jaipur's water. Bisalpur dam on the Banas, completed in 1999 (CWC National Register of Large Dams 2019), is about 120 km from the city (CGWB, 2023). PHED's annual report puts the city's supply at 766.73 MLD on 31 December 2025, 590 MLD of it from Bisalpur and 176 MLD from 3,633 tube wells. The same reservoir also serves Ajmer, Tonk and irrigation.",
      upstream_terminus: "South-west of Bisalpur, beyond this map",
      downstream_terminus: "The Chambal at Rameshwar Ghat (RSPCB's 2018 action plan)",
      feeds: "Jaipur city by pipeline from Bisalpur: 590 of 766.73 MLD on 31 December 2025 (PHED)",
      status:
        "At Bisalpur, CPCB's highest BOD was 1.6 mg/L in 2024, against 36.5 at Newta dam; from 2018 to 2024 it stayed within the 3 mg/L bathing limit in five of the seven years.",
      cpcb_nwmp_stations: ["2951 Bisalpur dam, Tonk district (BOD 1.6 mg/L max, 2024)"],
    },
    banganga: {
      display_name: "Banganga",
      display_name_hi: "बाणगंगा",
      color: "#7c3aed",
      length_km_geom: 39.1,
      description:
        "A seasonal river north-east of the city. It fills Ramgarh lake, behind a dam the CWC National Register of Large Dams lists as completed in 1901, with a gross storage of 75 million cubic metres. The Supreme Court's judgment of 9 November 2017 records that its water went to irrigation until 1978 and then to Jaipur's drinking water, and CGWB's 2023 report says the lake 'has been dried up'; Jaipur's surface water now comes from Bisalpur.",
      upstream_terminus: "North of the city, through Shahpura, Bairath and Jamwa Ramgarh (CGWB, 2013)",
      downstream_terminus: "East into Dausa district (CGWB, 2013)",
      feeds: "Ramgarh lake, once a source of the city's drinking water",
      status:
        "Ramgarh held nothing on 8 October 2025 or 8 October 2026 (the state's daily dam report). No CPCB station.",
      cpcb_nwmp_stations: [],
    },
  },
};

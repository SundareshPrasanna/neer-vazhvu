import type { CityFloodContent } from "@/content/flood/types";

const DDMP_2025 = "https://dmrelief.rajasthan.gov.in/content/dam/dmr/files/documents/ddmp2025/Jaipur.pdf";
const IMD_JUL = "https://city.imd.gov.in/citywx/extreme/JUL/jaipur2.htm";
const IMD_AUG = "https://city.imd.gov.in/citywx/extreme/AUG/jaipur2.htm";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Jaipur flood risk - 326.0 mm of rain on 19 July 1981, IMD's heaviest day for the city, a district plan that puts waterlogging down to inadequate drainage, and district monsoon rain 88% and 75% above normal in 2024 and 2025.",
  // JAIPUR. Rain on the city, not a river in spate. Narrative only: no
  // primary_trigger and no dam_release_threshold (Hyderabad, Delhi and Madurai
  // precedent). There is no CWC gauge in the district (nearest: Tonk and the
  // Bisalpur inflow station, both on the Banas), the district plan sets no
  // numeric trigger (DDMP 2025 PDF pp.56, 149), and no drain design rainfall
  // was found. IMD's generic very-heavy band (115.6-204.4 mm) was considered
  // and rejected as a trigger; it is quoted only as context on the 2012 card.
  // Rain figures are IMD's Jaipur station (42348, Sanganer); district season
  // totals are IMD Jaipur's monsoon reports. Damage figures only where an
  // official document gives them: none for Jaipur in any year. Held out: the
  // 1 Aug 2024 basement deaths and the 2020 deaths (press only), the Lok Sabha
  // statement of 24 Aug 1981 (eparlib unreachable) and a 1981 annual total
  // (IMD's two figures disagree, see data_gaps).
  // Dravyavati design aim: JDA EIA/EMP Chapter 2 (2017), PDF p.2. Unbuilt dam
  // stretches: Rajasthan HC, S.B. CWP 14997/2024, order of 19.12.2024, PDF pp.6-7, 9.
  config: {
    scope_label: { en: "Nagar Nigam Jaipur area + the Dravyavati" },
    cross_links: {
      home_desc: { en: "590 of 766.73 MLD from Bisalpur dam, about 120 km away (PHED, 31 Dec 2025)" },
      rivers_label: { en: "Dravyavati, Dhund, Banas and Banganga" },
      rivers_desc: {
        en: "CPCB readings at Newta dam, Kanota and Bisalpur, and why the Dravyavati channel itself has none",
      },
      water_bodies_desc: { en: "Man Sagar, Ramgarh and the lakes and tanks in and around the city" },
    },
    headline: {
      en: "Jaipur floods from rain on the city, not from a river in spate. The district disaster management plan of 2025 says flooding in the district 'is of minor nature': low-lying parts of the city are waterlogged in the monsoon, 'largely due to inadequate drainage', and flooding 'does not result into submergence of houses'. It names 1981 and 2012 as the years heavy rain flooded the city. The heaviest day on the India Meteorological Department's (IMD) record for Jaipur is 326.0 mm on 19 July 1981, in a month that brought 956.9 mm against a normal of 600.3 mm for a whole year. In the last two monsoons IMD has reported on, Jaipur district's June to September rain was 986.6 mm (2024) and 918.5 mm (2025), 88% and 75% above the normal of 524.3 mm. The city's main drainage channel, the Dravyavati, is the subject of a rejuvenation project contracted in 2016, whose stated aim in the Jaipur Development Authority's 2017 environmental report is 'to make the river section capable of safely passing the hundred year flood'; the Rajasthan High Court's order of 19 December 2024 records that no channel was built in the submergence areas of three dams along it, at Sikar, Gular and Ramchandrapura. The plan says the city's low-lying pockets 'have been identified' and that pumps are placed there by the first week of June, but it does not list them, and we have not found a flood map of the city or a river gauge inside it.",
    },
    // Newest first.
    historical_events: [
      {
        year: 2025,
        trigger: {
          en: "A wet monsoon: Jaipur district's June to September rain was 918.5 mm, 75% above the normal of 524.3 mm",
        },
        impact: {
          en: "The state's relief department placed Jaipur in its 'abnormal rainfall' class, 60% or more above normal. IMD's list of stations with more than 204.4 mm in a day that season has no Jaipur station. We have not found an official account of flooding or damage in the city.",
        },
        source_url: "https://mausam.imd.gov.in/jaipur/mcdata/monsoon2025.pdf",
        source_label:
          "IMD Meteorological Centre Jaipur, Rajasthan Monsoon Report 2025, PDF pp.5 and 12; Disaster Management and Relief Department, administrative report 2025-26, PDF p.14",
      },
      {
        year: 2024,
        trigger: {
          en: "Jaipur district's June to September rain was 986.6 mm, 88% above the normal of 524.3 mm, which IMD classes as large excess",
        },
        impact: {
          en: "The state's relief department placed Jaipur and Jaipur-Gramin, as its report then listed them, in the 'abnormal rainfall' class. No Jaipur station is in IMD's list of days above 204.4 mm that season. We have not found an official account of flooding or damage in the city.",
        },
        source_url: "https://mausam.imd.gov.in/jaipur/mcdata/monsoon2024.pdf",
        source_label:
          "IMD Meteorological Centre Jaipur, Rajasthan Monsoon Report 2024, PDF pp.8 and 16; Disaster Management and Relief Department, administrative report 2024-25, PDF p.14",
      },
      {
        year: 2020,
        trigger: { en: "102.7 mm in the 24 hours IMD dates to 15 August 2020" },
        impact: {
          en: "August 2020 brought 428.8 mm at IMD's Jaipur station, more than double its August normal of 203.4 mm. We have not found an official account of the damage.",
        },
        source_url: IMD_AUG,
        source_label: "IMD, extreme weather events in August, Jaipur; IMD Climatological Tables 1991-2020, Jaipur (42348)",
      },
      {
        year: 2012,
        trigger: {
          en: "170.1 mm in the 24 hours IMD dates to 22 August 2012, in IMD's 'very heavy' band of 115.6 to 204.4 mm",
        },
        impact: {
          en: "August 2012 brought 545.2 mm, close to the August record of 554.5 mm set in 1892. The district disaster management plan calls 2012 'the last devastated Flood' and says heavy rain in 1981 and 2012 'caused extensive damage to property and life', without figures.",
        },
        source_url: IMD_AUG,
        source_label: "IMD, extreme weather events in August, Jaipur; Jaipur District Disaster Management Plan 2025, PDF pp.42 and 160",
      },
      {
        year: 1981,
        trigger: { en: "326.0 mm in the 24 hours IMD dates to 19 July 1981, the heaviest day on its Jaipur record" },
        impact: {
          en: "July 1981 brought 956.9 mm, the wettest month on IMD's Jaipur record and more than one and a half times the station's normal for a whole year. Rajasthan's State Disaster Management Plan of 2014 records that the rain that month flooded Jaipur, Tonk, Nagaur and Sawai Madhopur and caused extensive damage to property and life; we have not found official figures.",
        },
        source_url: IMD_JUL,
        source_label: "IMD, extreme weather events in July, Jaipur; Rajasthan State Disaster Management Plan 2014, p.42",
      },
    ],
    external_sources: [
      {
        name: "India Meteorological Department, Jaipur",
        description: {
          en: "District heavy-rain warnings, nowcasts and the Jaipur city forecast from the meteorological centre. IMD's 1991-2020 normal for its Jaipur station is 600.3 mm a year on 34.3 rainy days, 190.5 mm of it in July and 203.4 mm in August.",
        },
        url: "https://mausam.imd.gov.in/jaipur/",
        cadence: "Several times a day",
      },
      {
        name: "IMD Jaipur: Rajasthan Monsoon Report",
        description: {
          en: "IMD Jaipur's account of each monsoon: every district's June to September rain against its normal, and the stations with very heavy (115.6 to 204.4 mm) and extremely heavy (more than 204.4 mm) days. Reports for 2022 to 2025 are online; the 2026 report was not yet published on 20 October 2026.",
        },
        url: "https://mausam.imd.gov.in/jaipur/mcdata/monsoon2025.pdf",
        cadence: "Yearly, after the monsoon",
      },
      {
        name: "IMD: Jaipur's record days, month by month",
        description: {
          en: "One page per month with each year's heaviest 24 hours and monthly total at IMD's Jaipur station, and the all-time records. The source of the 1981, 2012 and 2020 figures on this page.",
        },
        url: IMD_JUL,
        cadence: "Updated by IMD",
      },
      {
        name: "Jaipur District Disaster Management Plan 2025",
        description: {
          en: "The district's plan: the flood and waterlogging chapter, the tehsils with flood-vulnerable villages and urban slum areas (Kotkhawda, Chaksu, Phagi, Bassi, Jamwaramgarh, Amer, Chomu, Shahpura, Phulera and Sanganer), the Nagar Nigam control room at the Banipark fire station, which runs round the clock in three shifts, and a table of Water Resources Department dams and anicuts with the villages each may affect.",
        },
        url: DDMP_2025,
        cadence: "Yearly",
      },
      {
        name: "Rajasthan Flood Action Plan 2024",
        description: {
          en: "The state's monsoon plan. It lists Jaipur among the state's flood-prone areas, and its railway annexure lists the Jaipur Bai yard on the Bandikui-Jaipur line as prone to waterlogging.",
        },
        url: "https://dmrelief.rajasthan.gov.in/content/dam/dmr/files/documents/Flood_plan_2024_12092024.pdf",
        cadence: "Yearly",
      },
      {
        name: "Disaster Management and Relief Department: administrative report",
        description: {
          en: "The relief department's yearly report: each district's monsoon rain class, from Water Resources Department data, and rain-related deaths for Rajasthan as a whole. A scanned document, in Hindi.",
        },
        url: "https://dmrelief.rajasthan.gov.in/content/dam/dmr/files/documents/adm-rpt-25-26.pdf",
        cadence: "Yearly",
      },
      {
        name: "Central Water Commission flood forecasting",
        description: {
          en: "River levels and forecasts. There is no station in Jaipur district. The nearest are the base station at Tonk (warning level 262.0 m, danger level 262.8 m) and an inflow forecast for Bisalpur reservoir on the Banas, the river the city drinks from. Neither measures water in the city.",
        },
        url: "https://ffs.india-water.gov.in/",
        cadence: "Hourly",
      },
    ],
    data_gaps: [
      {
        en: "The list of waterlogging spots. The district plan says the city's low-lying pockets 'have been identified' and that pumps are placed there by the first week of June, but it does not list them, and we have not found the list published by the Nagar Nigam or the Jaipur Development Authority. With it, each spot could be mapped and followed from one monsoon to the next.",
      },
      {
        en: "A flood map. We have not found a public map of where Jaipur floods, either modelled for return periods or drawn from past events, so this page carries no map. The plan names flood-vulnerable areas by tehsil, not by ward or street.",
      },
      {
        en: "The rainfall the drains are built for. We have not found, in any Nagar Nigam or JDA document, the rainfall intensity the city's storm drains are designed to carry. The Dravyavati's stated aim is to pass a hundred-year flood, but the documents we read do not give the flow that means.",
      },
      {
        en: "A gauge in the city. The Central Water Commission has no flood station in Jaipur district, and we have not found a public water-level gauge on the Dravyavati or the Dhund, so no river level is shown here as a warning threshold.",
      },
      {
        en: "Damage figures. The district plan says the floods of 1981 and 2012 caused extensive damage but gives no figures, and the relief department counts rain deaths for Rajasthan as a whole (133 in the 2024 monsoon, 193 in 2025), not by district. Jaipur figures appear only in news reports, so none is shown here.",
      },
      {
        en: "Jaipur's rainfall for 1981 as a whole. IMD's 1991-2020 tables give 1,403.9 mm for the year; IMD Jaipur's booklet 'Climate of Jaipur' gives 1,180 mm. This page uses only the July 1981 figures, on which both agree.",
      },
      {
        en: "A dam table for the district as it now stands. The 2025 plan's table of dams and anicuts follows the district's boundary before 2023 (it still lists Kotputli and Viratnagar), so it may not match the district as it now stands.",
      },
    ],
    data_gaps_caveat: {
      en: "This page shows what has been published: the district plan's wording, IMD's rainfall record and the dated history of each flood. It draws no hazard zones or waterlogging spots, because we have not found any published for the city.",
    },
  },
};

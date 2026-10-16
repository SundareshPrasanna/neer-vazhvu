import type { CityFloodContent } from "./types";

const DDMP_2024 = "https://cdn.s3waas.gov.in/s3d1f491a404d6854880943e5c3cd9ca25/uploads/2025/01/2025010886.pdf";
const NMC_DM_2025 = "https://nmcnagpur.gov.in/assets/300/2025/07/mediafiles/Apatti_Vyavsthapan_2025-26.pdf";
const IMD_TABLES = "https://www.imdpune.gov.in/library/public/Climatological%20Tables%201991-2020.pdf";
const MAHARAIN = "https://maharain.maharashtra.gov.in/";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Nagpur flood risk - 166 mm at the Nagpur City rain gauge on 23 September 2023, a bridge below Ambazari lake recorded in 2020 as able to carry only 60 of the 400 cubic metres a second its spillway was designed for, and red and blue flood lines that cover 3.55 km of the Nag.",
  // NAGPUR. Rain on three rivers that carry the city's storm water (the Nag,
  // Pili and Pora), and the channels they pass through. The headline leads with
  // the hydraulic record (Water Works Department letter of 24 Nov 2020, quoted in the
  // Bombay HC order of 11 Jul 2024, PIL 56/2023, read on the order's page image
  // in NMC's NGT O.A. 160/2024 filing, compiled pp. 63-64), not with the
  // affidavits on the spill channel, which set one department against another.
  // No primary_trigger: no public gauge on the Nag, Pili or Pora, and no drain
  // design standard. Rain figures are the state's revenue-circle gauges
  // (Maharain, matching DDMP 2024 p.59); IMD's own 23 Sep 2023 value was not
  // found. Held out: house counts (press only, 10,000 to 25,000), the
  // Rs 266.63 crore package (press only), the Rs 234.21 crore in the HC order
  // (its meaning is unclear), spillway capacity 320 m3/s (press), the CWPRS
  // 2025 findings (report not public) and the basement list's names.
  // WRD flood-line sheets: public/data/flood-lines-nagpur.json, which only the
  // map variant renders; the register is linked from external_sources here.
  config: {
    scope_label: { en: "NMC area + the Nag, Pili and Pora" },
    // flood-lines-nagpur.json: Nag RD 0-3,550 m (Maps 1-4), Pora 5.3 km (Narsala-Hudkeshwar).
    hazard_badge: {
      en: "Flood lines for 3.55 km of the Nag and 5.3 km of the Pora only; no citywide hazard map",
    },
    cross_links: {
      home_desc: { en: "Five treatment plants: four on Pench water from Totladoh, one on the Kanhan" },
      rivers_label: { en: "Nag, Pili and Pora rivers" },
      rivers_desc: {
        en: "Water quality along the city's three rivers, and downstream on the Kanhan and the Wainganga",
      },
      water_bodies_desc: {
        en: "The city's lakes, from Ambazari at the head of the Nag to the tanks across NMC",
      },
    },
    headline: {
      en: "Nagpur floods when heavy rain overtops the Nag, the Pili and the Pora, the three rivers that carry the city's storm water. In November 2020 the Assistant Chief Engineer of Nagpur's Water Works Department, in a letter to the Commissioner of the Nagpur Municipal Corporation (NMC) quoted in the Bombay High Court's order of 11 July 2024, recorded that the spillway of Ambazari lake, where the Nag begins, was designed to pass 400 cubic metres of water a second, but that the road bridge on the channel below it could carry only 60 in a flood; a meeting in October 2020 had decided that a new bridge would be designed. In the 24 hours to the morning of 23 September 2023 the state's rain gauges in the city recorded 166 mm at the Nagpur City circle (the Sitabardi circle carries the same daily figure) and 103 mm at Pardi; the district plan says the heavy rain fell between midnight and dawn. Ambazari lake, the Nag, the Pili and the Pora overflowed, and water entered homes from Dharampeth to Lakadganj. The Bombay High Court's order of 11 July 2024 records the Collector's affidavit that four people died, and the district disaster plan records 349 people rescued by 21 teams. Maharashtra's Water Resources Department publishes red and blue flood lines for the Nag, but only for a 3.55 km stretch at the city's eastern edge; we have not found a published flood line for the Pili, or a published map of the city's storm drains.",
    },
    // Newest first. Rain at the state's revenue-circle gauges (Maharain) unless
    // IMD is named; damage figures only where an official document gives them.
    historical_events: [
      {
        year: 2025,
        trigger: { en: "Heavy rain on 8 and 9 July 2025" },
        impact: {
          en: "The state's revenue-circle rain gauges recorded 179.0 mm at the Nagpur City circle (Sitabardi carries the same figure) and 153.5 mm at Pardi for 9 July. By the end of the month the Nagpur City circle had 541.4 mm, 177.9% of its July normal of 304.4 mm. We have not found an official account of the damage.",
        },
        source_url: MAHARAIN,
        source_label: "Maharain, Agriculture Department, Government of Maharashtra: circle-wise daily rainfall, Nagpur district, July 2025",
      },
      {
        year: 2024,
        trigger: { en: "Heavy rain around 20 July 2024" },
        impact: {
          en: "The circle gauges recorded 96.3 mm at Nagpur City (Sitabardi the same) and 103.8 mm at Pardi for 20 July. NMC's disaster plan records 73 water and heavy-rain calls in July 2024, out of 82 in the year from April 2024 to March 2025; no other month had more than four.",
        },
        source_url: NMC_DM_2025,
        source_label: "NMC City Disaster Management Plan 2025-26, p.119; Maharain circle rainfall, July 2024",
      },
      {
        year: 2023,
        trigger: {
          en: "Heavy rain between midnight and dawn on 23 September 2023: 166 mm at the Nagpur City circle in the 24 hours to that morning (the Sitabardi circle carries the same daily figure), 103 mm at Pardi",
        },
        impact: {
          en: "Ambazari lake, the Nag, the Pili, the Pora and local nalas overflowed, and water entered homes in Dharampeth, Shankar Nagar, Ambazari, Jhansi Rani Chowk, Panchsheel Chowk, Kachipura, Cotton Market and Lakadganj. The Bombay High Court's order of 11 July 2024 records the Collector's affidavit that four people died. Twenty-one teams rescued 349 people: NMC 152, the State Disaster Response Force 105, the National Disaster Response Force 45, the Army 36 and Aapda Mitra volunteers 11.",
        },
        source_url: DDMP_2024,
        source_label: "Nagpur District Disaster Management Plan 2024, pp.59 and 61; Bombay High Court (Nagpur Bench), PIL No. 56 of 2023, order of 11 July 2024, para 2",
      },
      {
        year: 2018,
        trigger: { en: "282.0 mm at the Nagpur City circle, recorded for 7 July 2018" },
        impact: {
          en: "Sitabardi recorded 185.0 mm and Pardi 122.0 mm the same day. The district disaster plan lists the flood of 6 July 2018 in many parts of the city and in Hingna and Kamptee, with '282.5 mm in 12 hours'. The Nagpur City circle's July total was 558.9 mm, 183.6% of its normal.",
        },
        source_url: DDMP_2024,
        source_label: "Nagpur District Disaster Management Plan 2024, p.45; Maharain circle rainfall, July 2018",
      },
      {
        year: 2013,
        trigger: { en: "Heavy rain, 31 July 2013" },
        impact: {
          en: "The district disaster plan lists flooding at Jhansi Rani Chowk, Vaishali Nagar, Samta Nagar, Kalamna and Hudkeshwar chowk, and in the areas along the Nag and the Pili. The Nagpur City circle's July 2013 total was 505.3 mm, 166% of its July normal, with 144.6 mm recorded for 20 July.",
        },
        source_url: DDMP_2024,
        source_label: "Nagpur District Disaster Management Plan 2024, p.45; Maharain circle rainfall, July 2013",
      },
      {
        year: 1994,
        trigger: { en: "304.0 mm of rain in 24 hours on 12 July 1994" },
        impact: {
          en: "The heaviest July day on the India Meteorological Department's (IMD) record for its Nagpur observatory, in the wettest July there, 678.9 mm. The district disaster plan lists a two-day flood at Mankapur from 12 July 1994.",
        },
        source_url: IMD_TABLES,
        source_label: "IMD, Climatological Tables 1991-2020, Nagpur (42867), p.264; District Disaster Management Plan 2024, p.45",
      },
      {
        year: 1911,
        trigger: { en: "315.0 mm of rain in 24 hours on 12 June 1911" },
        impact: {
          en: "The heaviest day on IMD's record for its Nagpur observatory, and 1911 is the wettest year there, at 1,931.4 mm. We have not found an account of flooding in the city from that year.",
        },
        source_url: IMD_TABLES,
        source_label: "IMD, Climatological Tables 1991-2020, Nagpur (42867), p.264",
      },
    ],
    external_sources: [
      {
        name: "Maharain: daily rain at the city's three revenue circles",
        description: {
          en: "The Agriculture Department's daily rainfall for the Nagpur City circle from 1997, and for the Sitabardi and Pardi circles from 2013, with each month's normal. Since October 2022 the Nagpur City and Sitabardi columns show the same value every day.",
        },
        url: MAHARAIN,
        cadence: "Daily",
      },
      {
        name: "India Meteorological Department, Nagpur",
        description: {
          en: "Forecasts and heavy-rain warnings from the regional meteorological centre in the city. IMD's 1991-2020 normal for its Nagpur observatory is 1,151.2 mm a year, 347.7 mm of it in July.",
        },
        url: "https://mausam.imd.gov.in/nagpur/",
        cadence: "Several times a day",
      },
      {
        name: "Maharashtra Water Resources Department: flood line maps",
        description: {
          en: "The state's register of red and blue flood-line sheets. Four sheets for the Nag, surveyed for NMC (three at 1:1,250 and a combined sheet at 1:2,000), cover 3.55 km at Pardi, Punapur and Bharatwada and print the 25-year and 100-year flood levels at landmarks along the river. A sheet for the Pora covers 5.3 km from Vihirgaon to Khedi. Descriptions are in Marathi: look for नाग नदी and पोरा नदी.",
        },
        url: "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps",
        cadence: "When sheets are added",
      },
      {
        name: "Nagpur District Disaster Management Plan 2024",
        description: {
          en: "The district's plan, in Marathi: rainfall at each city circle on 23 September 2023 and the rescue count, a flood history from 1991, and flood-prone villages taluka by taluka.",
        },
        url: DDMP_2024,
        cadence: "Yearly",
      },
      {
        name: "NMC City Disaster Management Plan 2025-26",
        description: {
          en: "NMC's own plan, in Marathi: 66 places at risk in heavy rain and, fire station by fire station, 77 places where water collects and 59 basements that take water. It names the places but gives no coordinates.",
        },
        url: NMC_DM_2025,
        cadence: "Yearly",
      },
      {
        name: "Nagpur district: red and blue line for the Kharbi-Godhni nalla",
        description: {
          en: "A separate flood-line sheet for a nalla in east Nagpur, prepared by the state irrigation department's investigation division and posted on the district website in December 2018. It is a reduced copy without a legible scale.",
        },
        url: "https://nagpur.gov.in/document/map-showing-red-line-blue-line-on-kharbi-godhni-sim-nalla-latitude-21-7-18-n-longitude-79-8-30-e/",
        cadence: "Static page",
      },
      {
        name: "Central Water Commission flood forecasting",
        description: {
          en: "River levels and forecasts. The nearest station is on the Kanhan at Satrapur, near Kamptee, above the point where the Nag joins it (levels only, no forecast). On the Wainganga, Bhandara is above the point where the Kanhan joins it, and Gosikhurd dam and Pauni are below it. There is no station on the Nag, the Pili or the Pora.",
        },
        url: "https://ffs.india-water.gov.in/",
        cadence: "Hourly",
      },
    ],
    data_gaps: [
      {
        en: "Flood lines for the Pili and most of the Nag. The state's register has red and blue flood-line sheets for the Nag only for 3.55 km at the city's eastern edge, and none for the Pili or for the Nag from Ambazari lake through the city centre, where most of the places named in the 2023 record lie. The sheets that exist are scanned images with no digital line file, so no flood line is drawn on this page.",
      },
      {
        en: "A map of the storm drains. The City Development Plan of 2015 records about 917 km of storm drains, surveyed in 2008 for NMC's drainage master plan and covering about 40% of the city's area. We have not found that network, or the master plan, published as a map or a file.",
      },
      {
        en: "A gauge on the city's rivers. We have not found a public water-level gauge on the Nag, the Pili or the Pora, so no river level can be shown here as a warning threshold.",
      },
      {
        en: "The rainfall the drains are built for. We have not found, in any NMC document, the rainfall intensity its storm drains are designed to carry, so the rain of 23 September 2023 cannot be set against it.",
      },
      {
        en: "Where the waterlogging places are. NMC's 2025-26 plan names 66 places at risk in heavy rain and 77 places where water collects, but gives no coordinates, so they are not mapped here.",
      },
      {
        en: "IMD's own reading for 23 September 2023. We have not found the observatory's figure for that day in a public document; the rainfall for that day on this page comes from the state's revenue-circle gauges.",
      },
      {
        en: "The hydraulic study of the 2023 flood. A study by the Central Water and Power Research Station has been reported in the press, but we have not found the report published.",
      },
      {
        en: "Damage counts. We have found counts of homes affected in 2023 only in news reports, and they differ widely, so none is shown here.",
      },
    ],
    data_gaps_caveat: {
      en: "This page shows what has been published: the rainfall and the record of each flood. It draws no modelled hazard zones or drain lines, because none has been published for the city that we have found.",
    },
  },
};

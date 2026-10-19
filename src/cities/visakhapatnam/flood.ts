import type { CityFloodContent } from "@/content/flood/types";

const IMD = "https://rsmcnewdelhi.imd.gov.in/download.php?path=uploads/report/26/";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Visakhapatnam flood risk - cyclones and deep depressions over a hilly coastal city, the geddas that drain it, and the flood maps and drainage records we have not found.",
  // VISAKHAPATNAM. Flooding here is rain and wind off the Bay of Bengal over a
  // city of hills and narrow valleys, drained by geddas (natural channels) to
  // the sea and the harbour. We have found no dam release that decides it, so
  // no release threshold, and we have found no GVMC drainage design standard, so
  // there is no rainfall trigger either: neither threshold card renders.
  //
  // EVENTS ARE OFFICIAL RAINFALL RECORDS. The cyclone and depression rows are
  // the 24-hour rainfall the India Meteorological Department recorded at its
  // Visakhapatnam stations, from its RSMC reports. The 2024 row is different:
  // it is the six-day cumulative district-average rainfall (129.0 mm, 29 Aug
  // to 3 Sep 2024) from the Government of Andhra Pradesh flood memorandum,
  // Table 6, not an IMD station reading. Each row links its own source; the
  // IMD source card says most, not all, of the rainfall figures are IMD's.
  // Impact figures are given only where an official document states them, and
  // Hudhud's water-infrastructure damage is the AP government's four-district
  // total (its table in IMD's report, Table 4), not a city figure.
  //
  // THE OLD FLOOD-PRONE WARD LISTS ARE NOT USED. GVMC's draft city disaster
  // plan (2015; gvmc.gov.in/wss/image_uploads/cdmp1.pdf, Table 5-2, PDF p97)
  // lists inundation-prone areas in 14 of its earlier 72 wards (13 rows across
  // its six zones; one row is wards 31 and 33), and the City Development Plan
  // (2006), copied into the district disaster plan (2018), uses an older
  // division numbering. Neither maps onto any current ward. They are history,
  // so they stay in the research notes.
  config: {
    scope_label: { en: "Geddas, the harbour and the Bay of Bengal" },
    headline: {
      en: "Visakhapatnam floods from the sky and the sea, not from a large river. Cyclones and deep depressions off the Bay of Bengal drop 11 to 28 cm of rain in a day over a city of hills and narrow valleys, and the water runs off through geddas, the natural channels that cut the city, to the harbour and the beach. When Hudhud crossed the coast over the city in 2014, the storm surge at the city's tide gauge was 1.4 m above the predicted tide. The newest GVMC list of inundation-prone areas we have found, in its 2015 draft disaster plan, uses ward numbers no longer in use, as does the older list in its 2006 City Development Plan. We have found no GVMC flood map or drainage design standard, so this page carries the dated record of events and the places to watch during one.",
    },
    historical_events: [
      {
        year: 2014,
        trigger: {
          en: "Very severe cyclonic storm Hudhud crossed the coast over Visakhapatnam on 12 October, between noon and 1 pm. Gusts reached 260 km/h and the surge at the Visakhapatnam tide gauge was 1.4 m above the predicted tide. IMD recorded 11 cm at its Visakhapatnam station and 12 cm at Visakhapatnam airport in the 24 hours to 8:30 am on 12 October, before landfall.",
        },
        impact: {
          en: "IMD's report carries the Government of Andhra Pradesh's damage table for the four affected districts: 194 trunk water pipelines (39.4 km) fully or partly damaged, 102 water pumping stations damaged and 197 overhead reservoirs fully damaged. That table records 46 deaths; the World Bank's 2015 project appraisal and the state disaster management authority's disaster history page give 61. These are four-district figures; we have not found an official city-only count of days without piped water.",
        },
        source_url: "https://rsmcnewdelhi.imd.gov.in/uploads/report/26/26_fac6af_hud.pdf",
        source_label: "IMD RSMC report on Cyclone Hudhud (2014)",
      },
      {
        year: 2020,
        trigger: {
          en: "A deep depression over the Bay of Bengal crossed near Kakinada on 13 October. On 12 October IMD recorded 17 cm at Bheemunipatnam and 15 cm at Visakhapatnam in 24 hours.",
        },
        impact: { en: "IMD's report states no impact figure for the city." },
        source_url: `${IMD}26_627fa8_Deep%20Depression%20over%20Bay%20of%20Bengal%20during%2011-14%20Oct%202020.pdf`,
        source_label: "IMD RSMC report, deep depression of 11-14 October 2020",
      },
      {
        year: 2021,
        trigger: {
          en: "Cyclonic storm Gulab crossed the coast north of Kalingapatnam on 26 September. Visakhapatnam recorded 28 cm in the 24 hours to 8:30 am on 27 September, the heaviest day in this list.",
        },
        impact: { en: "IMD's report states no official impact figure for the city." },
        source_url: `${IMD}26_dd64de_Cyclonic%20Storm%20GULAB%20over%20eastcentral%20and%20adjoining%20northeast%20Bay%20of%20Bengal.pdf`,
        source_label: "IMD RSMC report on Cyclonic Storm Gulab (2021)",
      },
      {
        year: 2023,
        trigger: {
          en: "Severe cyclonic storm Michaung crossed the coast near Bapatla on 5 December. Visakhapatnam recorded 15 cm in the 24 hours to 8:30 am on 6 December.",
        },
        impact: { en: "IMD's report states no impact figure for the city." },
        source_url: `${IMD}26_0580dd_Michaung%20Report_Final_Sir.pdf`,
        source_label: "IMD RSMC report on Cyclone Michaung (2023)",
      },
      {
        year: 2024,
        trigger: {
          en: "Heavy rain across Andhra Pradesh from 29 August to 3 September: 129 mm in Visakhapatnam district over the six days.",
        },
        impact: {
          en: "The state's memorandum records 94 people affected in the district, 4 houses fully damaged and 39.37 km of urban roads damaged.",
        },
        source_url: "https://apsdma.ap.gov.in/files/06104de92b01f273eead196a654d65dc.pdf",
        source_label: "Government of Andhra Pradesh memorandum on the floods of Aug-Sep 2024",
      },
      {
        year: 2025,
        trigger: {
          en: "Severe cyclonic storm Montha crossed the coast near Narsapur on the night of 28 October. Visakhapatnam recorded 19 cm in the 24 hours to 8:30 am on 28 October.",
        },
        impact: { en: "IMD's report states no impact figure for the city." },
        source_url: `${IMD}26_6964caedcba00.pdf`,
        source_label: "IMD RSMC report on Cyclone Montha (2025)",
      },
    ],
    drainage_map: {
      heading: { en: "A gedda, a river and the supply canal" },
      note: {
        en: "Three channels as OpenStreetMap maps them: the Meghadri Gedda, the Gosthani river and the Yeleru supply canal. OpenStreetMap also names other geddas, such as the Maddi Gedda at Rushikonda and the Thumuru Gedda, which are not drawn here. Volume II of GVMC's 2015 city disaster plan maps storm-water drainage in 14 zones (Figure 8), and a state GIS layer maps the drains of 2019 without names or capacities; we have not found public GVMC drain network data or a gedda register. This is not an engineering map.",
      },
      zoom: 11,
      layers: [
        {
          url: "/geojson/visakhapatnam-rivers.geojson",
          label: "Gedda, river and canal",
          kind: "line",
          color: "#0e7490",
          nameProp: "name",
        },
      ],
    },
    external_sources: [
      {
        name: "India Meteorological Department - cyclone warnings and reports",
        description: {
          en: "Track forecasts and coastal warnings during an event, and the after-event reports most of this page's rainfall figures come from (the 2024 figure is the state's).",
        },
        url: "https://rsmcnewdelhi.imd.gov.in/",
        cadence: "Several times a day during a cyclone",
      },
      {
        name: "Andhra Pradesh State Disaster Management Authority",
        description: {
          en: "The state's alerts and evacuation orders, and its post-event memoranda with district damage figures.",
        },
        url: "https://apsdma.ap.gov.in/",
        cadence: "During and after events",
      },
      {
        name: "APWRIMS - reservoir levels",
        description: {
          en: "Daily levels at Meghadrigedda, a reservoir inside the city, and at Yeleru, Raiwada and Thatipudi, the dams farther out that supply the city. A full Meghadrigedda during heavy rain is a sign to watch the low-lying areas below it.",
        },
        url: "https://apwrims.ap.gov.in/",
        cadence: "Daily",
      },
      {
        name: "VMRDA draft Master Plan 2041 - regional flood and storm-surge maps",
        description: {
          en: "The state planning society's storm-surge and river-flood inundation maps for the metropolitan region, and its count of villages in floodable zones (PDF pp.47-48 and 133). Drawn at region scale, not street level.",
        },
        url: "http://vmrda.gov.in/masterplan-2041/DMPreports.pdf",
        cadence: "One-off draft, June 2021",
      },
      {
        name: "INCOIS - storm surge and ocean state",
        description: { en: "Ocean-state and storm-surge forecasts for the coast during a cyclone." },
        url: "https://incois.gov.in/",
        cadence: "During events",
      },
    ],
    data_gaps: [
      {
        en: "NO CITY FLOOD MAP. We have found no GVMC flood map, return-period zones or current list of waterlogging spots. The only modelled maps we have found that cover the city are regional ones by the Andhra Pradesh State Development Planning Society (APSDPS), reproduced in VMRDA's draft Master Plan 2041 (June 2021, PDF pp.47-48): storm-surge inundation for a 235 km/h super cyclone, which names Visakhapatnam Urban, Visakhapatnam Rural, Pedagantyada and Bheemunipatnam among the coastal mandals prone to damage, and river-flood inundation at 100-year and 2-year return periods. The plan counts 11 villages in the floodable zone of the Meghadrigedda reservoir (PDF p.133), but the village list is not in the published PDF. These maps are drawn at region scale and do not show street waterlogging. The NRSC flood hazard atlas for Andhra Pradesh covers river flooding seen from satellite and states that local and flash floods may not be captured.",
      },
      {
        en: "NO DRAINAGE MASTER PLAN OR GEDDA REGISTER. The 2006 City Development Plan counted 22 major geddas and about 1,400 km of storm-water drains and proposed a drainage master plan. Since then we have found no published master plan, gedda register or drain capacity. What we have found: Volume II of GVMC's 2015 city disaster plan maps storm-water drainage in 14 zones at city scale (Figure 8); VMRDA's draft Master Plan 2041 gives GVMC 2,714.5 km of existing storm-water drains and 238 km proposed in project reports (PDF p.132, Table 8-11, citing the 2016 AMRUT service-level improvement plans); and a state GIS layer maps the drains of 2019 without names or capacities.",
      },
      {
        en: "OLD WARD NUMBERS. GVMC's draft city disaster plan (2015) lists inundation-prone areas in 14 of its earlier 72 wards (in use until 2021), and the 2006 City Development Plan, copied word for word into the 2018 district disaster plan, uses an older division numbering. Neither matches today's wards. GVMC moved to 120 wards in 2026; we have not found a public map of them.",
      },
      {
        en: "NO CITY-ONLY DAMAGE FIGURES. We have not found city-only damage figures for Gulab (2021), Michaung (2023) or Montha (2025) in state or municipal documents.",
      },
    ],
    data_gaps_caveat: {
      en: "This page shows the dated cyclone record and the city's mapped drainage channels. We have not found a GVMC flood map, a current list of waterlogging spots or drain capacity data, so no flood zones are drawn or modelled here; the gaps above name the regional maps and older lists we did find.",
    },
    cross_links: {
      home_desc: { en: "Where the city's water comes from, and the canal it shares with industry" },
      rivers_label: { en: "The Meghadri Gedda, the Gosthani and the Yeleru canal" },
      rivers_desc: {
        en: "CPCB readings at two reservoirs, the Naval Dockyard creek and the canal, and the industrial outfalls along the coast",
      },
      water_bodies_desc: { en: "The city's tanks and reservoirs, from Mudasarlova (handed over in May 1903) to Meghadrigedda" },
    },
  },
};

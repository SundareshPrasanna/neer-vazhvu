import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Ahmedabad flood risk - 82 of AMC's 148 known waterlogging spots flooded on 23 July 2026, the Sabarmati against CWC's warning level at Subhash Bridge, and the 1875 flood that took the first Ellis Bridge.",
  // AHMEDABAD. Two mechanisms in the record: rain on the streets (July 2026,
  // 1868) and the Sabarmati itself (1875, 2006). The trigger card is CWC's
  // warning level at Subhash Bridge (FFS static API, checked 14 Oct 2026), not
  // the city plan's cusec ladder, which does not say where flow is measured.
  // No drainage_map: AMC publishes no storm-water geometry. No live_register:
  // AMC's storm figures appear only in state press releases.
  // Held out: "147 locations in 2025" (no source), JICA's 159 locations in July
  // 2022 (secondary), Dharoi outflows (FFS states no unit), and the 1875
  // computed discharge (the Gazetteer itself doubts the formula).
  config: {
    scope_label: { en: "AMC area + the Sabarmati" },
    cross_links: {
      home_desc: { en: "1,850 MLD a day, and the Narmada canal that carries 84% of it" },
      rivers_label: { en: "Sabarmati river system" },
      rivers_desc: {
        en: "Measured quality from Dharoi to Vautha, and CPCB's polluted-stretch class below the city",
      },
      water_bodies_desc: {
        en: "The city's lakes, several of which AMC now links to its storm-water drains to hold rain",
      },
    },
    headline: {
      en: "Ahmedabad's most recent flood came from rain on its streets, not from the river. On 23 July 2026 the Ahmedabad Municipal Corporation (AMC) reported a city average of 163.24 mm of rain, with 315.5 mm at Bakrol between 8 am and 7 pm, and 82 of the 148 places it already lists as waterlogging spots went under water. By the evening of 25 July it reported 133 of them cleared and 15 still being drained. Over the same three days the Sabarmati at Subhash Bridge stayed more than 2.5 m below the Central Water Commission's (CWC) warning level, and fell as the Vasna barrage gates were opened so the city's drains could empty into it. The river has flooded the city before: in September 1875 it rose twenty-two feet above its summer level and carried away most of the first Ellis Bridge, and CWC's highest reading at the city gauge is from August 2006. AMC's list of the 148 spots, a flood map of the city and a live page for its rain gauges have not been found in public yet.",
    },
    primary_trigger: {
      value: 44.09,
      unit: { en: "m river level" },
      label: { en: "CWC warning level, Sabarmati at Subhash Bridge" },
      note: {
        en: "CWC reads the Sabarmati at Subhash Bridge every hour. Its warning level there is 44.09 m and its danger level 45.34 m; the highest level on record is 47.45 m, on 20 August 2006. In CWC's hourly readings for June to October of each year from 2017 to 2026, the river crossed the warning level once, on the afternoon of 25 July 2017, peaking at 44.8 m. It reached 44.0 m on 7 September 2025. Its highest reading in 2026, to 14 October, was 41.88 m on 7 September, and during the July storm it stayed at or below 41.53 m.",
      },
    },
    // Newest first. Damage figures only where an official document gives them.
    historical_events: [
      {
        year: 2026,
        trigger: {
          en: "Three days of heavy rain from 23 July, heaviest on the first day in the North West and South West zones either side of the S.G. Highway",
        },
        impact: {
          en: "On 23 July, 82 of the 148 waterlogging spots AMC had already identified flooded and 66 stayed clear. AMC's three-day totals reached 625 mm in the South West zone and 585 mm in the North West, against an India Meteorological Department (IMD) normal of 783.6 mm for a whole year. The Vasna barrage gates were opened to take storm water, and the state's 24 July releases say all 42 storm-water pumping stations were running, with 245 pumps. AMC's Commissioner said Bopal and Ghuma still drain through storm-water lines built in their gram panchayat days and that more will be built there; the district's minister in charge said tenders for about Rs 900 crore of drainage works for the newly added areas and the west would be issued soon.",
        },
        source_url:
          "https://gujaratinformation.gujarat.gov.in/PressReleaseDetailsL/?id=47962&DepId=0&DistrictId=2&LanguageId=2",
        source_label: "Gujarat Information Department releases quoting AMC, 23 to 25 July 2026 (47962, 47970, 47971, 48233)",
      },
      {
        year: 2006,
        trigger: { en: "The Sabarmati in flood, August 2006" },
        impact: {
          en: "CWC's gauge at Subhash Bridge recorded 47.45 m on 20 August 2006, the highest level on record there and 2.11 m above the danger level. The city's World Heritage nomination dossier (January 2016) lists the year as 'Floods in Sabarmati after 1992, little damage to Sabarmati riverfront project', a project its timeline dates from 2004.",
        },
        source_url: "https://ffs.india-water.gov.in/",
        source_label: "CWC flood forecasting, station 020-MAHGAND; UNESCO nomination dossier, p.46",
      },
      {
        year: 1927,
        trigger: { en: "414.8 mm of rain in 24 hours on 27 July 1927" },
        impact: {
          en: "It is still the highest 24-hour total on IMD's month-by-month records for Ahmedabad. The World Heritage nomination dossier names 1927, and later 1973, among the years of heavy floods in the Sabarmati. We have not found official damage figures for either year.",
        },
        source_url: "https://city.imd.gov.in/citywx/extreme/JUL/ahmedabad2.htm",
        source_label: "IMD, extreme weather events in July, Ahmedabad",
      },
      {
        year: 1875,
        trigger: {
          en: "The Sabarmati in flood, 21 to 25 September 1875, after 21.25 inches of rain in four days at Idar in the river's catchment",
        },
        impact: {
          en: "The 1879 Bombay Gazetteer calls it the highest flood on record. At 5 pm on 23 September the river stood twenty-two feet above its ordinary summer level. The first Ellis Bridge lost 20 of its 23 spans, twelve people died, and inside the city 3,887 houses were ruined; outside the walls 101 villages on both banks were affected.",
        },
        source_url: "https://archive.org/details/dli.ministry.08145",
        source_label: "Gazetteer of the Bombay Presidency, Vol. IV, Ahmedabad (1879), pp.11 to 13",
      },
      {
        year: 1868,
        trigger: { en: "Twenty-seven inches (about 686 mm) of rain in four days from 10 August 1868" },
        impact: {
          en: "The Gazetteer records that the Sabarmati, though much swollen, did not flood the city, but the rain and a wind that at times blew with extreme violence destroyed 9,566 houses. As in July 2026, the damage came from rain on the city rather than from the river.",
        },
        source_url: "https://archive.org/details/dli.ministry.08145",
        source_label: "Gazetteer of the Bombay Presidency, Vol. IV, Ahmedabad (1879), p.10",
      },
    ],
    external_sources: [
      {
        name: "Central Water Commission flood forecasting: Sabarmati at Subhash Bridge",
        description: {
          en: "Station 020-MAHGAND reads the river level at Subhash Bridge every hour, against a warning level of 44.09 m and a danger level of 45.34 m. It is the only live public reading of the river inside the city that we have found.",
        },
        url: "https://ffs.india-water.gov.in/",
        cadence: "Hourly",
      },
      {
        name: "Gujarat water department: daily dam report",
        description: {
          en: "Level, storage, inflow and river outflow in cusecs for Dharoi, the Sabarmati's dam upstream of the city, with the department's warning status for each dam. A separate hourly report runs alongside it.",
        },
        url: "https://wrd-dam.gujarat.gov.in/index.php",
        cadence: "Daily, with hourly reports",
      },
      {
        name: "State Emergency Operation Centre: 24-hour rainfall by taluka",
        description: {
          en: "The state's daily rainfall report, published through GSDMA, with a row for Ahmedabad City: 886 mm this season to 12 October 2026, 107% of the 1996-2025 average of 826 mm. Each report runs from 6 am to 6 am.",
        },
        url: "https://www.gsdma.org/rainfalldata-2?Type=2",
        cadence: "Daily in monsoon",
      },
      {
        name: "India Meteorological Department, Ahmedabad",
        description: {
          en: "District forecasts and heavy-rain warnings from the meteorological centre in the city. IMD's 1991-2020 normal for Ahmedabad is 783.6 mm a year, 310.1 mm of it in July.",
        },
        url: "https://mausam.imd.gov.in/ahmedabad/",
        cadence: "Several times a day",
      },
      {
        name: "Gujarat Information Department: Ahmedabad releases",
        description: {
          en: "Where AMC's figures during a storm are published: rainfall by zone and gauge, waterlogging spots flooded and cleared, underpasses closed and pumps running. In Gujarati, issued during and after the event.",
        },
        url: "https://gujaratinformation.gujarat.gov.in/",
        cadence: "During storms",
      },
      {
        name: "Ahmedabad city disaster management plan 2026 (GSDMA)",
        description: {
          en: "Sets alert signals by river discharge for areas along the Sabarmati: white (alert) at 86,597 cusecs and blue (be ready to evacuate) at 1,16,892 for Paldi, Juna and Nava Vadaj, Gyaspur and the Ellis Bridge police station area, and red (evacuate now) at 1,45,000. Jamalpur, Raikhad, Kochrab and Subhash Bridge get each signal one step later. The district plan carries the same table.",
        },
        url: "https://gsdma.org/asset/uploads/MDMP/AHMEDABAD%20MDMP%202026.pdf",
        cadence: "Yearly",
      },
      {
        name: "Sabarmati River Front Development Corporation (SRFDCL)",
        description: {
          en: "The riverfront company's account of the channel: 263 m wide, with diaphragm walls more than 10 m into the riverbed, and able to 'sustain flood levels of 4.75 lac cusecs without spillage into the city'. Its background page adds that the floods of the recent past have been releases from Dharoi, announced twelve hours before the water reaches Ahmedabad.",
        },
        url: "https://sabarmatiriverfront.com/environmental-improvement.html",
        cadence: "Static page",
      },
      {
        name: "Ahmedabad Municipal Corporation budget documents",
        description: {
          en: "Where AMC states the size of its storm-water system: 1,010 km of drains and 35 storm-water pumping stations in the 2026-27 budget, and 950 km and 34 stations in 2023-24. The 2026-27 budget sets a 'Flood Proof City' goal, with Rs 1,931.82 crore for drainage and storm-water works.",
        },
        url: "https://ahmedabadcity.gov.in/SP/Budget",
        cadence: "Yearly",
      },
    ],
    data_gaps: [
      {
        en: "The list of waterlogging spots. AMC counted 107 places prone to waterlogging in its 2023-24 budget and 148 previously identified spots in July 2026, but we have not found either list published with names or locations. With the list, each spot could be mapped and its record followed from one monsoon to the next.",
      },
      {
        en: "A flood map. We have not found a public map of where Ahmedabad floods, either modelled (like Chennai's return-period zones) or drawn from past events, so this page carries no map.",
      },
      {
        en: "A live rain-gauge page. AMC reads rain at more than 40 named locations across the city (its 23 July 2026 release lists them), but we have not found a page where those readings are posted as they come in. In July 2026 they reached the public through state press releases.",
      },
      {
        en: "The rainfall the drains are built for. We have not found, in any AMC document, the rainfall intensity its storm-water drains are designed to carry. Kolkata publishes 6 mm an hour for its old sewers, which lets a storm be read against the network; without an Ahmedabad figure, the rain of 23 July 2026 cannot be set against what the drains were built for.",
      },
      {
        en: "The drainage network itself. AMC's 2026-27 budget puts the storm-water network at 1,010 km with 35 storm-water pumping stations, but we have not found a map or geometry file of it. The state's July 2026 releases count 42 storm-water pumping stations; both counts are given here with their dates, and a dated list of stations would show what each includes.",
      },
      {
        en: "Where the plan's river discharge is measured. The disaster plan's alert ladder is given in cusecs without saying whether the flow is measured at Dharoi or in the city, or when the thresholds were set. A dated note on both would let it be read alongside CWC's river levels and SRFDCL's stated capacity of 4.75 lakh cusecs.",
      },
      {
        en: "Damage figures for past river floods. For 1927, 1973 and 2006 we have found the years and, for 2006, CWC's river level, but no official count of homes or people affected. Those events appear here without damage figures rather than with numbers from news reports.",
      },
    ],
  },
};

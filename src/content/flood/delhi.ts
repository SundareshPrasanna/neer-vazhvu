import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Delhi flood risk - Yamuna barrage-release thresholds at the Old Railway Bridge, the 2023 record flood, and Hathnikund lead-time context.",
  // Delhi: barrage-release + embankment-gap driven, like Madurai's shape
  // (release threshold + lag), unlike Chennai's modeled-hazard-zone shape.
  // English-only for now; hi strings land with the translation pass and
  // fall back to en until then. Sources verified live 2026-07-20 (Delhi
  // audit refresh). The contested Sept-2025 Hathnikund peak figure
  // (3,29,313 vs 29,313 cusecs across sources) is deliberately not stated.
  config: {
    scope_label: { en: "Yamuna basin scope" },
    cross_links: {
      home_desc: { en: "Supply chain, allocation ledger and the CAG scoreboard" },
      rivers_label: { en: "Yamuna river system" },
      rivers_desc: { en: "5 channels in scope - the river, the Munak carrier and the great drains" },
      water_bodies_desc: { en: "893 census water bodies + the floodplain wetlands that buffer (or amplify) inundation" },
    },
    headline: {
      en: "Delhi's flood risk is barrage-release-driven with a 36-72 hour fuse: water released at Hathnikund (Haryana) takes two to three days to reach the Old Railway Bridge gauge, where 204.50 m means warning, 205.33 m danger, and 206.00 m evacuation. Only ~7% of the floodplain length is embanked, and the 2018 Drainage Master Plan that was meant to fix internal drainage remains largely on paper.",
    },
    dam_release_threshold_cusecs: 100000,
    dam_release_note: {
      en: "The first flood warning is issued when Hathnikund barrage discharge crosses ~1,00,000 cusecs (Flood Control Order 2026). The July 2023 record showed the thresholds can fail conservative: the river hit 208.66 m - 1.17 m above the 1978 record - at releases the CWC's own post-mortem called moderate, with the ITO barrage's jammed gates deepening the flooding in central Delhi.",
    },
    historical_events: [
      {
        year: 2025,
        trigger: {
          en: "September 2025 monsoon spell with very high Hathnikund discharge",
        },
        impact: {
          en: "A July-2023-like flood spell repeated within two years - evacuations along the floodplain and renewed questions about why 2023's lessons had not changed outcomes (SANDRP's analysis is the sharpest public account).",
        },
        source_url: "https://sandrp.in/2025/09/09/sept-2025-why-yamuna-repeated-july-2023-like-flood-spell-in-delhi/",
        source_label: "SANDRP - Sept 2025 repeat flood analysis",
      },
      {
        year: 2023,
        trigger: {
          en: "Record 153 mm July rainfall + sustained Hathnikund releases; ITO barrage gates 1, 2 and 5 jammed shut",
        },
        impact: {
          en: "Yamuna peaked at 208.66 m on 13 July - highest since records began in 1963, breaking 1978's 207.49 m. Ring Road, Civil Lines, ITO and Rajghat inundated; ~27,000 evacuated. CWC's case study is the official post-mortem.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC - Delhi Floods 2023 case study",
      },
      {
        year: 2013,
        trigger: {
          en: "Mid-June upper-basin downpour - an unusually early-season Hathnikund surge",
        },
        impact: {
          en: "207.32 m at the Old Railway Bridge - the highest level between 1978 and 2023 (the comparison every 2023 report reached for). Floodplain settlements evacuated; an early-monsoon warning the 2023 post-mortems would cite.",
        },
        source_url: "https://www.tribuneindia.com/news/delhi/yamuna-at-all-time-high-delhi-on-edge-as-low-lying-areas-flooded-525092",
        source_label: "The Tribune (2023 all-time-high report with historical levels)",
      },
      {
        year: 2010,
        trigger: {
          en: "Sustained September flows in a strong-monsoon year, weeks before the Commonwealth Games",
        },
        impact: {
          en: "Annual peak discharge ~3,466 cumecs at the Delhi Railway Bridge (the CWC's model-calibration flood). The river flooded the low floodplain beside the Games-readied embankments, putting the Games Village's floodplain siting into the national argument it has stayed in since.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table; 2010 calibration event)",
      },
      {
        year: 1995,
        trigger: {
          en: "September peak releases from Tajewala (pre-Hathnikund barrage)",
        },
        impact: {
          en: "Annual peak discharge ~7,028 cumecs - the largest flow between 1978 and 2023 in the CWC's series. Trans-Yamuna colonies flooded; with 1988 it pushed the embankment-extension debate.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table)",
      },
      {
        year: 1988,
        trigger: {
          en: "Late-September basin-wide rain - the sharpest late-80s surge",
        },
        impact: {
          en: "Annual peak discharge ~5,642 cumecs; large evacuations from the floodplain and trans-Yamuna. With 1995 it defines the high-flow band the river revisited for three decades before 2023 broke the level record outright.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table)",
      },
      {
        year: 1978,
        trigger: {
          en: "Peak monsoon flows in the undammed upper Yamuna (pre-Tehri era)",
        },
        impact: {
          en: "The benchmark flood: 207.49 m at the Old Railway Bridge, a record that stood 45 years until 2023. Model city planning still references the 1978 flood line.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (historical benchmark section)",
      },
    ],
    external_sources: [
      {
        name: "CWC Flood Forecasting (Old Railway Bridge gauge)",
        url: "https://ffs.india-water.gov.in/",
        description: {
          en: "India's oldest flood-forecast station (operating since 1958). Live levels + forecasts during monsoon; the single best public flood signal for Delhi.",
        },
        cadence: "live (monsoon)",
      },
      {
        name: "DDMA - flood preparedness & alerts",
        url: "https://ddma.delhi.gov.in/ddma/floods",
        description: {
          en: "Delhi Disaster Management Authority's flood page: thresholds, helpline (1077), and seasonal orders. No machine-readable feed.",
        },
        cadence: "seasonal",
      },
      {
        name: "Delhi Drainage Master Plan (IIT Delhi, 2018)",
        url: "https://ifc.delhi.gov.in/sites/default/files/inline-files/main_report_dmp_version51.pdf",
        description: {
          en: "The 153-page plan for Delhi's 3,737 km of drains across 11 agencies - the reference document for internal (rainfall) flooding, still largely unimplemented.",
        },
        cadence: "one-shot (2018)",
      },
    ],
    data_gaps: [
      {
        en: "No public real-time Hathnikund release feed - the 36-72 h lead-time signal exists only in news reports and alerts (highest-leverage RTI target)",
      },
      {
        en: "No public flood model or inundation forecast for Delhi (no iFLOWS/CFM-DSS equivalent)",
      },
      {
        en: "No public hotspot inventory with geometry; NRSC's 2023 satellite inundation maps sit behind a NICNET-only portal",
      },
      {
        en: "The internal-drainage story (waterlogging) has no live data: 11 agencies, no unified drain-condition feed",
      },
    ],
  },
};

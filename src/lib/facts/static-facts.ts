import type { Fact } from "@/types/facts";

/**
 * Static facts for Tiers 2, 3, and 4 - numbers that don't change on a live cadence.
 * These are compiled at build time and served with the page.
 *
 * Tier 1 (live) facts are computed separately in `src/lib/facts/live-facts.ts`
 * at request time from Supabase, then merged with these before rendering.
 *
 * Every fact should match the canonical model in `src/types/facts.ts`.
 * Numbers and wording are sourced from `docs/water-facts-spec.md`.
 */

const RETRIEVED_AT = "2026-04-19";

export const STATIC_FACTS: Fact[] = [
  // =================== TIER 2 - ANNUAL ===================
  {
    id: "cgwb-over-exploited-blocks",
    tier: 2,
    category: "groundwater",
    title: "CGWB over-exploited blocks",
    value: "13 of 16",
    unit: "blocks",
    interpretation:
      "81% of Chennai's groundwater blocks are classified \"Over-Exploited\" by CGWB - water drawn exceeds natural recharge. Only 2 blocks remain \"Safe.\"",
    data_date: "2024-01-01",
    published_date: "2025-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cgwb.gov.in/",
    source_label: "CGWB Dynamic Ground Water Resource Assessment 2024",
    method_id: "cgwb-block-assessment",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "81% of Chennai's groundwater blocks (13 of 16) are classified \"Over-Exploited\" by the Central Ground Water Board in its 2024 assessment - water drawn exceeds natural recharge. Only 2 blocks remain \"Safe.\" Source: CGWB Dynamic Ground Water Resource Assessment 2024.",
    title_ta: "CGWB அதிகமாக பயன்படுத்தப்பட்ட வட்டங்கள்",
    interpretation_ta:
      "சென்னையின் நிலத்தடி நீர் வட்டங்களில் 81% (16-இல் 13) CGWB-ஆல் \"அதிகம் பயன்படுத்தப்பட்டவை\" எனக் குறிப்பிடப்பட்டுள்ளன. 2 வட்டங்கள் மட்டுமே பாதுகாப்பானவை.",
  },
  {
    id: "over-exploited-block-names",
    tier: 2,
    category: "groundwater",
    title: "Blocks in crisis",
    value: "13",
    unit: "named blocks",
    interpretation:
      "Ambattur, Tondiarpet, Velacheri, Mambalam, Mylapore, Egmore, Aminjikarai, Maduravoyal, Guindy, Perambur, Ayanavaram, Purasaivakkam, and Thiruvottiyur are drawing groundwater faster than it recharges.",
    data_date: "2024-01-01",
    published_date: "2025-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cgwb.gov.in/",
    source_label: "CGWB 2024 assessment",
    method_id: "cgwb-block-assessment",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Thirteen Chennai blocks are classified Over-Exploited by CGWB in its 2024 assessment: Ambattur, Tondiarpet, Velacheri, Mambalam, Mylapore, Egmore, Aminjikarai, Maduravoyal, Guindy, Perambur, Ayanavaram, Purasaivakkam, and Thiruvottiyur. Source: CGWB Dynamic Ground Water Resource Assessment 2024.",
  },
  {
    id: "cooum-do-2022",
    tier: 2,
    category: "rivers",
    title: "Cooum oxygen collapse",
    value: "0.0",
    unit: "mg/L",
    interpretation:
      "At Cooum's Central Jail station, dissolved oxygen dropped to 0.0 mg/L in 2022 - aquatic life cannot survive. CPCB's Class D criterion for Propagation of Wildlife and Fisheries requires DO >= 4 mg/L.",
    data_date: "2022-01-01",
    published_date: "2024-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cpcb.nic.in/water-quality-criteria/",
    source_label: "CPCB NWMP station 10045, 2024 annual report",
    method_id: "cpcb-nwmp",
    confidence: "high",
    claim_status: "observed",
    threshold: {
      value: 4,
      source: "CPCB Class D",
      label: "Propagation of Wildlife and Fisheries (DO >= 4 mg/L)",
    },
    quote_text:
      "At Cooum's Central Jail station (CPCB NWMP 10045), dissolved oxygen dropped to 0.0 mg/L in 2022 - aquatic life cannot survive. CPCB's Class D criterion for Propagation of Wildlife and Fisheries requires DO >= 4 mg/L. Source: CPCB National Water Monitoring Programme, 2024 annual report.",
  },
  {
    id: "cooum-bod-2021",
    tier: 2,
    category: "rivers",
    title: "Cooum sewage load peak",
    value: "177",
    unit: "mg/L",
    interpretation:
      "Peak annual midpoint BOD on the Cooum reached 177 mg/L at Amanjikarai in 2021 - a clean river is below 2 mg/L.",
    data_date: "2021-01-01",
    published_date: "2022-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cpcb.nic.in/",
    source_label: "CPCB NWMP station 10042",
    method_id: "cpcb-nwmp",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Biochemical oxygen demand on the Cooum reached an annual midpoint of 177 mg/L at Amanjikarai station (CPCB NWMP 10042) in 2021. A clean river has BOD below 2 mg/L. Source: CPCB National Water Monitoring Programme.",
  },
  {
    id: "buckingham-do-2024",
    tier: 2,
    category: "rivers",
    title: "Buckingham Canal DO collapse",
    value: "0.3",
    unit: "mg/L",
    interpretation:
      "Dissolved oxygen at Buckingham Canal (Ice House) fell to 0.3 mg/L in 2024 - the canal effectively functions as an open drain.",
    data_date: "2024-01-01",
    published_date: "2025-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cpcb.nic.in/",
    source_label: "CPCB NWMP station 0054",
    method_id: "cpcb-nwmp",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Dissolved oxygen at the Buckingham Canal Ice House monitoring station (CPCB NWMP 0054) was 0.3 mg/L in 2024 - the canal functions as an open drain. Source: CPCB National Water Monitoring Programme, 2024 data.",
  },
  {
    id: "data-gap-gw",
    tier: 2,
    category: "transparency",
    title: "Data Transparency Watch: groundwater",
    value: "18",
    unit: "months",
    interpretation:
      "Chennai's ward-level groundwater depth data was last published in November 2025, covering 2024. No 2025 data has been released - 18 months of monitoring is currently unavailable to the public.",
    data_date: "2026-04-19",
    published_date: "2025-11-27",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://data.opencity.in/dataset/chennai-ward-wise-groundwater-levels",
    source_label: "OpenCity Chennai / CMWSSB",
    method_id: "opencity-gw-gap",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Chennai's ward-level groundwater depth data was last published in November 2025, covering the 2024 calendar year. No 2025 data has been released as of April 2026 - 18 months of monitoring currently unavailable to the public. Source: OpenCity Chennai / CMWSSB piezometer network.",
  },

  // =================== TIER 3 - HISTORICAL ===================
  {
    id: "day-zero-2019",
    tier: 3,
    category: "events",
    title: "2019 Day Zero",
    value: "~19",
    unit: "MCFT usable",
    interpretation:
      "On 19 June 2019, Chennai's 4 main reservoirs fell to ~19 MCFT of usable storage - effectively dry. City-wide piped supply collapsed; 700-900 CMWSSB tankers made 9,700 trips/day to fill the gap.",
    data_date: "2019-06-19",
    published_date: "2019-06-19",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cmwssb.tn.gov.in/lake-level",
    source_label: "CMWSSB archive",
    method_id: "cmwssb-archive",
    confidence: "high",
    claim_status: "historical",
    quote_text:
      "On 19 June 2019, Chennai's four main reservoirs (Poondi, Cholavaram, Red Hills, Chembarambakkam) fell to approximately 19 MCFT of usable storage - effectively dry. City-wide piped supply collapsed, and CMWSSB tankers made ~9,700 trips per day to fill the gap. Source: CMWSSB lake level archive.",
  },
  {
    id: "2015-floods",
    tier: 3,
    category: "events",
    title: "2015 Chennai floods",
    value: "up to 494",
    unit: "mm at one station",
    interpretation:
      "In December 2015, Chennai region rainfall ranged from 77 to 494 mm across monitoring stations, with a 24-hour regional average of 286 mm. Over 3 million people lost basic services; economic damage estimated at US$3 billion. World Weather Attribution found no detectable climate-change signal in the one-day extreme rainfall.",
    data_date: "2015-12-01",
    published_date: "2016-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.worldweatherattribution.org/chennai-floods-december-2015/",
    source_label: "World Weather Attribution",
    method_id: "wwa-2015",
    confidence: "high",
    claim_status: "historical",
    quote_text:
      "December 2015 Chennai floods: 24-hour rainfall across monitoring stations ranged from 77 mm to 494 mm, with a regional average of 286 mm. Over 3 million people lost basic services; economic damage estimated at US$3 billion. World Weather Attribution analysis found no detectable climate-change signal in the one-day extreme rainfall. Source: World Weather Attribution.",
  },
  {
    id: "cflows-hazard-zones",
    tier: 3,
    category: "flood",
    title: "Flood hazard mapping vintage",
    value: "Nov 2019",
    unit: "CFLOWS 1.0",
    interpretation:
      "Chennai's public flood hazard map is based on the CFLOWS (Chennai Flood Warning System) 1.0 model operationalized in November 2019 by IIT Bombay, IIT Madras, and NCCR. The model has not received a public update since. 11 of 200 wards are classified very-high hazard.",
    data_date: "2019-11-03",
    published_date: "2019-11-03",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.nccr.gov.in/sites/default/files/C-FLOWS%20Brochure.pdf",
    source_label: "NCCR / OpenCity Chennai",
    method_id: "cflows-1.0",
    confidence: "high",
    claim_status: "modelled",
    quote_text:
      "Chennai's public flood hazard map is based on the CFLOWS 1.0 model, operationalized in November 2019 by IIT Bombay, IIT Madras, and NCCR. No public model update has been released since. 11 of 200 wards are classified very-high hazard. Source: NCCR C-FLOWS brochure; OpenCity Chennai.",
  },
  {
    id: "pallikaranai-loss",
    tier: 3,
    category: "water-bodies",
    title: "Pallikaranai Marsh decline",
    value: "~6,000 to ~593",
    unit: "hectares",
    interpretation:
      "Pallikaranai Marsh shrunk from an estimated ~6,000 hectares (mid-1900s baseline) to ~593 hectares as reported in 2016 research. A 90%+ loss attributed to decades of encroachment, landfilling, and sewage dumping. Current extent may differ as restoration and further loss have occurred since.",
    data_date: "2016-01-01",
    published_date: "2016-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url:
      "https://www.researchgate.net/publication/312003950_Characterization_and_Management_Concerns_of_Water_Resources_around_Pallikaranai_Marsh_South_Chennai",
    source_label: "Nagendran et al. 2016",
    method_id: "pallikaranai-2016",
    confidence: "medium",
    claim_status: "historical",
    quote_text:
      "Pallikaranai Marsh shrunk from an estimated ~6,000 hectares (mid-1900s baseline) to ~593 hectares as reported in 2016 research (Nagendran et al.). A 90%+ loss attributed to decades of encroachment, landfilling, and sewage dumping. Current extent may differ. Source: ResearchGate publication 312003950.",
  },
  {
    id: "restoration-projects",
    tier: 3,
    category: "restoration",
    title: "Major river restoration projects",
    value: "Rs 4,450 Cr",
    unit: "committed",
    interpretation:
      "Chennai Rivers Restoration Trust is executing 9 major projects - 3 complete, 3 in progress, 3 planned - with a combined budget of Rs 4,450 crore.",
    data_date: "2024-01-01",
    published_date: "2024-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://crrt.tn.gov.in/",
    source_label: "Chennai Rivers Restoration Trust",
    method_id: "crrt-projects",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Chennai Rivers Restoration Trust (CRRT) is executing 9 major river restoration projects with a combined budget of Rs 4,450 crore: 3 completed, 3 in progress, 3 planned. Source: crrt.tn.gov.in.",
  },

  // =================== TIER 4 - INFRASTRUCTURE ===================
  {
    id: "stp-capacity-vs-demand",
    tier: 4,
    category: "sewage",
    title: "Sewage treatment capacity",
    value: "745 MLD installed",
    unit: "· ~1,073 MLD generated (estimate)",
    interpretation:
      "Chennai operates 13 sewage treatment plants with 745 MLD installed capacity (CMWSSB, 2026). Independent academic estimates place daily sewage generation at ~1,073 MLD, implying a ~328 MLD gap that flows untreated into rivers, canals, and the sea.",
    data_date: "2026-04-19",
    published_date: "2026-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cmwssb.tn.gov.in/sewerage-system",
    source_label: "CMWSSB (installed); academic estimates (generation)",
    method_id: "cmwssb-stp-inventory",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Chennai has 13 operational sewage treatment plants with 745 MLD of installed treatment capacity (CMWSSB, 2026). Independent academic estimates place the city's daily sewage generation at ~1,073 MLD, implying a ~328 MLD gap. Source: CMWSSB sewerage system page (installed); academic estimates (generation).",
  },
  {
    id: "desalination-capacity-status",
    tier: 4,
    category: "supply",
    title: "Desalination capacity and status",
    value: "200 MLD installed",
    unit: "· operating output varies",
    interpretation:
      "Minjur (100 MLD, since 2010) and Nemmeli (100 MLD) represent 200 MLD of installed desalination capacity - roughly 20% of Chennai's piped supply when both plants run at full capacity. Operating output varies: CMWSSB has cut Nemmeli production during periods of high reservoir storage (TNIE, Feb 2026).",
    data_date: "2026-02-09",
    published_date: "2026-02-09",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cmwssb.tn.gov.in/water-supply-system",
    source_label: "CMWSSB water supply page (installed); TNIE Feb 2026 (operating status)",
    method_id: "cmwssb-desalination",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Chennai has 200 MLD of installed desalination capacity: Minjur (100 MLD, since 2010) and Nemmeli (100 MLD). This is roughly 20% of piped supply when both plants run at full capacity. Operating output varies - CMWSSB cut Nemmeli production in February 2026 when reservoir storage was high. Source: CMWSSB water supply page; The New Indian Express, 9 Feb 2026.",
  },
  {
    id: "reservoir-total-capacity",
    tier: 4,
    category: "supply",
    title: "Total reservoir capacity",
    value: "13,222",
    unit: "MCFT",
    interpretation:
      "Chennai's 6 storage reservoirs (Poondi, Cholavaram, Red Hills, Chembarambakkam, Kannankottai-Thervoy Kandigai, Veeranam) have a combined capacity of 13,222 MCFT (approximately 374 million cubic metres) per the CMWSSB lake level page as of April 2026.",
    data_date: "2026-04-19",
    published_date: "2026-04-17",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cmwssb.tn.gov.in/lake-level",
    source_label: "CMWSSB lake level page",
    method_id: "cmwssb-reservoirs",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Chennai's six storage reservoirs - Poondi, Cholavaram, Red Hills, Chembarambakkam, Kannankottai-Thervoy Kandigai, and Veeranam - have a combined capacity of 13,222 MCFT (approximately 374 million cubic metres) per CMWSSB's lake level page as of April 2026. Source: cmwssb.tn.gov.in/lake-level.",
  },
  {
    id: "piped-supply-demand",
    tier: 4,
    category: "supply",
    title: "Piped supply vs demand",
    value: "~1,040 vs 2,232",
    unit: "MLD",
    interpretation:
      "CMWSSB delivers approximately 1,040 MLD against an estimated city demand of 2,232 MLD - a ~52% gap filled by groundwater extraction, desalination, and the ~15,000-tanker informal water market.",
    data_date: "2024-01-01",
    published_date: "2024-01-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://cmwssb.tn.gov.in/water-supply-system",
    source_label: "CMWSSB + academic estimates",
    method_id: "cmwssb-supply-demand",
    confidence: "medium",
    claim_status: "estimated",
    quote_text:
      "CMWSSB delivers approximately 1,040 MLD of piped water against an estimated city demand of 2,232 MLD - a ~52% gap filled by groundwater extraction, desalination, and the ~15,000-tanker informal water market. Source: CMWSSB water supply page; academic estimates.",
  },
];

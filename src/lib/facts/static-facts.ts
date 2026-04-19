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
  // Tier 2 (annual, year-stamped) facts are now computed from existing data
  // files - see src/lib/facts/derived-facts.ts. They refresh automatically
  // when gwr-blocks.json or river-quality.json is regenerated.

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

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
    // CFLOWS 1.0 is the *current* (and only) public flood hazard model
    // for Chennai - it never received a public update. That makes it
    // infrastructure-grade methodology context, not "history". Reads
    // wrong under the History bucket; lives more honestly under
    // Infrastructure.
    id: "cflows-hazard-zones",
    tier: 4,
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
    value: "745",
    unit: "MLD installed - ~1,073 MLD generated (est)",
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
    unit: "- operating output varies",
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

  // =================== COAST & SEAWATER INTRUSION ===================
  // Findings from Anagha V.S., Singh & Frappart (2026), "Shoreline and
  // salinity shifts along the Chennai coast", Environmental Challenges.
  // A 1990-2024 satellite + CGWB study of the 86 km Uthandi-Pulicat
  // coast. Tagged tier 3 (reference/historical) and carried with the
  // study's own caveats (HFE-D cannot separate modern intrusion from
  // legacy/salt-pan salinity; turtle biological record ends 2011), so
  // these read as context, not live-state claims.
  {
    id: "coastal-port-downdrift-erosion",
    tier: 3,
    category: "coastal",
    title: "Port-driven down-drift erosion",
    value: "21.3 & 16",
    unit: "m/yr (Ennore - Kattupalli, north flank)",
    interpretation:
      "Ennore and Kattupalli ports interrupt the natural south-to-north sand drift, starving the coast immediately north of each. A 1990-2024 satellite shoreline analysis measures down-drift erosion of 21.3 m/yr north of Ennore and 16 m/yr north of Kattupalli, with the north-Kattupalli sector retreating nearly 1 km. Chennai Port, by contrast, gained land (~34.8 m/yr accretion) behind extensive seawalls.",
    data_date: "2024-01-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-shoreline",
    confidence: "high",
    claim_status: "modelled",
    quote_text:
      "A 1990-2024 satellite study of the Chennai coast finds that the Ennore and Kattupalli ports, by interrupting natural south-to-north sand drift, drive down-drift erosion of 21.3 m/yr (north of Ennore) and 16 m/yr (north of Kattupalli); the north-Kattupalli sector retreated nearly 1 km. Chennai Port instead gained land (~34.8 m/yr) behind seawalls. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
  {
    id: "coastal-erosion-share",
    tier: 3,
    category: "coastal",
    title: "Share of Chennai coast eroding",
    value: "58.65%",
    unit: "of 86 km - mean -1.89 m/yr (1990-2024)",
    interpretation:
      "Across the 86 km from Uthandi (south) to Pulicat (north), 58.65% of the monitored coastline eroded and ~40.5% accreted over 1990-2024, measured with the Digital Shoreline Analysis System on Landsat and Sentinel-2 imagery. Erosion concentrates on the port-dominated northern zones (Ennore-Kattupalli-Pulicat), where mean rates reach 4.34 m/yr.",
    data_date: "2024-01-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-dsas",
    confidence: "high",
    claim_status: "modelled",
    quote_text:
      "Over 1990-2024, 58.65% of the 86 km Chennai coastline (Uthandi to Pulicat) eroded and ~40.5% accreted, at a net mean of -1.89 m/yr, per a Digital Shoreline Analysis System study of Landsat and Sentinel-2 imagery. Erosion is concentrated in the port-dominated northern zones. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
  {
    id: "coastal-aquifer-salinisation",
    tier: 3,
    category: "coastal",
    title: "Coastal aquifer under saline stress",
    value: "100%",
    unit: "of GW samples saline or mixing (2014-2022)",
    interpretation:
      "Every CGWB groundwater sample within 7 km of the coast across 2014, 2018, 2020, and 2022 plotted in a saline or mixing facies on the Hydrochemical Facies Evolution diagram, with peak Na-Cl seawater signatures in 2014 and 2020 (the 2020 resurgence tied to the 2019 drought). The study is explicit that this method cannot separate modern seawater intrusion from legacy salt, salt-pan runoff, and unlined Buckingham Canal leakage, so it reads as chronic multi-source salinity, not a single cause.",
    data_date: "2022-05-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-hfed",
    confidence: "medium",
    claim_status: "modelled",
    quote_text:
      "Across 2014-2022, 100% of CGWB groundwater samples within 7 km of the Chennai coast plotted in saline or mixing zones on a Hydrochemical Facies Evolution diagram, peaking in 2014 and 2020. The authors caution the method cannot separate modern seawater intrusion from legacy salt, salt-pan, and Buckingham Canal sources. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
  {
    id: "coastal-gwl-decline",
    tier: 3,
    category: "coastal",
    title: "Coastal groundwater level decline",
    value: "-18 & -17",
    unit: "cm/yr (Vepery - Tondiarpet, 2002-2021)",
    interpretation:
      "Of 14 CGWB monitoring wells inside the 7 km coastal buffer, levels fell significantly at Vepery (-18 cm/yr) and Tondiarpet (-17 cm/yr) over 2002-2021 (both p<0.05), and sit persistently below mean sea level at Vepery and Pallikaranai. The authors argue chronic urban over-abstraction is a co-equal driver of salinisation alongside the sea - so stabilising the shoreline alone cannot reverse the intrusion.",
    data_date: "2021-01-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-gwl",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "CGWB piezometric records show coastal groundwater levels falling significantly at Vepery (-18 cm/yr) and Tondiarpet (-17 cm/yr) over 2002-2021 (p<0.05), sitting below mean sea level at Vepery and Pallikaranai. The study concludes chronic urban over-abstraction is a co-equal driver of seawater intrusion, meaning shoreline stabilisation alone cannot reverse it. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
  {
    id: "coastal-sea-level-rise",
    tier: 3,
    category: "coastal",
    title: "Sea-level rise off Chennai",
    value: "3.45 mm/yr",
    unit: "~100 mm above 1990 baseline",
    interpretation:
      "Satellite altimetry over the Chennai coast shows mean sea level rising 3.45 mm/yr, about 100 mm above the 1990 baseline by 2025 and accelerating after 2010. On a microtidal, sediment-starved shore this adds steady hydrodynamic pressure that amplifies the port-driven erosion and seawater intrusion documented in the same study.",
    data_date: "2025-01-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-msl",
    confidence: "high",
    claim_status: "observed",
    quote_text:
      "Satellite altimetry shows mean sea level off Chennai rising 3.45 mm/yr - about 100 mm above the 1990 baseline by 2025, accelerating after 2010 - adding hydrodynamic pressure to an already sediment-starved, eroding coast. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
  {
    id: "coastal-turtle-hatching",
    tier: 3,
    category: "coastal",
    title: "Olive Ridley hatching vs erosion",
    value: "84% to 20%",
    unit: "hatching success, high-erosion beaches",
    interpretation:
      "In the Neelankarai-Adyar Olive Ridley turtle nesting corridor, hatching success falls from ~84% on stable beaches to ~20% where shoreline erosion reaches ~80% (R² = 0.63), part of a multi-stressor squeeze that also includes sand temperatures above the 32°C embryonic-stress threshold. The biological record runs only to 2011, so the study frames this as an association, not proven causation.",
    data_date: "2011-01-01",
    published_date: "2026-06-01",
    retrieved_at: RETRIEVED_AT,
    computed_at: null,
    source_url: "https://www.sciencedirect.com/science/article/pii/S2667010026001083",
    source_label: "Anagha, Singh & Frappart 2026 (Environmental Challenges)",
    method_id: "envc-2026-turtle",
    confidence: "medium",
    claim_status: "historical",
    quote_text:
      "Along Chennai's Neelankarai-Adyar turtle coast, Olive Ridley hatching success drops from ~84% on stable beaches to ~20% in high-erosion zones (R² = 0.63), compounded by sand temperatures above the 32°C embryonic-stress threshold. The biological record ends in 2011, so the link is associative. Source: Anagha, Singh & Frappart (2026), Environmental Challenges.",
  },
];

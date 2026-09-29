import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Kolkata flood risk - Victorian drains rated for 6 mm of rain an hour, KMC's live weekly waterlogging register, and the combined sewer system that ties flooding to river pollution.",
  // Kolkata is the first city here whose flood trigger is NOT a dam or barrage
  // release. It impounds nothing and there is no upstream gate to watch: the
  // trigger is rainfall INTENSITY against a drainage system's stated design
  // capacity. Hence `primary_trigger` rather than dam_release_*.
  config: {
    scope_label: { en: "KMC drainage area" },
    // The independent check on the hero. The hero says reanalysis rainfall beat
    // the 6 mm/h standard for N hours a year; this says which streets actually
    // flooded and where KMC actually sent a machine. Modelled exceedance and
    // observed failure are different evidence and the page carries both.
    live_register: {
      heading: { en: "Where the city actually flooded, this week" },
      note: {
        en: "KMC's Mechanical Sewer Cleansing wing publishes, every week, the waterlogging pockets it sent de-silting machines to, with a borough and ward attribution on every row. KMC overwrites the file in place, so no upstream archive exists and our weekly capture is the only record of past weeks.",
      },
      src: "/data/kolkata-waterlogging-register.json",
      sourceLabel: "KMC Weekly Drainage Activity Chart",
      sourceHref:
        "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
    },
    headline: {
      en: "Kolkata's flood risk is drainage-capacity-driven, not release-driven. KMC's own sewerage document states the main network 'was designed to discharge a rainfall of 6 mm. per hour' - across 180 km of century-old brick sewer, with most drainage pumping stations built 50 to 100 years ago. Measured hourly rainfall beat that standard for a mean of 31.8 hours a year over 2000-2025, and the record splits sharply: 19.2 hours a year in 2000-2012 against 44.5 in 2013-2025. Most of the core city is on a COMBINED system, carrying sewage and stormwater in one conduit, which is the single fact tying the city's flooding, its river pollution and its dependence on the East Kolkata Wetlands together.",
    },
    primary_trigger: {
      value: 6,
      unit: { en: "mm of rain per hour" },
      label: { en: "Drainage design standard" },
      note: {
        en: "Above roughly 6 mm in an hour the sewers cannot carry the flow and it backs up into the streets. The standard is a design property quoted from KMC's 2009 Sewerage and Drainage document, and KMC scopes it precisely: to the British-era brick trunk network, 180 km of it, not to every drain in the city. No design standard is published for the areas added since, so read this as a statement about the core city. The wettest hour on record delivered 40.2 mm - 6.7 times capacity.",
      },
    },
    historical_events: [
      {
        year: 2026,
        trigger: { en: "Routine monsoon week, 20-26 July" },
        impact: {
          en: "KMC's own weekly register names waterlogging pockets across most of the city's boroughs in an ordinary week, machine deployments and all. The current week's counts are above, read from the register itself. Kolkata's flooding is not an event, it is a weekly operating condition.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
        source_label: "KMC Weekly Drainage Activity Chart, 20-26 Jul 2026",
      },
      {
        year: 2021,
        trigger: { en: "Cyclone Yaas plus a spring tide on the Hooghly" },
        impact: {
          en: "Tidal surge up the Hooghly overtopped embankments and flooded low-lying areas, a reminder that Kolkata's flood exposure is coastal-surge as well as rainfall. Storm surge needs a different framing from the drainage standard and is not yet modelled here.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
        source_label: "Context: KMC Sewerage and Drainage",
      },
      {
        year: 2009,
        trigger: { en: "KMC's own account of why the city floods every year" },
        impact: {
          en: "KMC lists the causes itself: siltation, collapsing brick sewers, destruction of wetlands increasing runoff, century-old pumps, and silted outfall canals. Storm-water drainage pumping stations went from 1 (Southern Avenue) in 2004-05 to 4 by 2009.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
        source_label: "KMC, Sewerage and Drainage (2009)",
      },
    ],
    external_sources: [
      {
        name: "KMC Weekly Drainage Activity Chart",
        cadence: "Weekly (Mon-Sun), overwritten in place",
        description: {
          en: "The live weekly register of waterlogging pockets KMC sent de-silting machines to, with a borough/ward attribution on every row. KMC overwrites it in place each week, so no upstream archive exists - our weekly capture is the only record of past weeks.",
        },
        url: "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
      },
      {
        name: "KEIIP Early Warning System (kflood.in) - OFFLINE",
        description: {
          en: "KEIIP's own programme site links a flood Early Warning System at kflood.in. The domain does not resolve - NXDOMAIN, checked 26 July 2026. A flood early-warning system built under a publicly-funded programme, still advertised by the programme that built it, with nothing behind the link. Kolkata therefore has no public real-time flood warning surface at all.",
        },
        url: "https://www.keiip.in/",
        cadence: "Dead link - domain does not resolve",
      },
      {
        name: "West Bengal flood-line map sheets",
        cadence: "Static scanned sheets, not georeferenced",
        description: {
          en: "West Bengal's legal red/blue flood-boundary map sheets exist as scanned A0 plots and are not georeferenced, so they cannot be rendered as a hazard layer here.",
        },
        url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
      },
    ],
    data_gaps: [
      {
        en: "No public flood model. There is no CFLOWS-equivalent hazard-zone or return-period modelling for Kolkata, so this page carries no hazard choropleth and no 5/10/25/50/100-year extents.",
      },
      {
        en: "The storm-water drain network is PDF-only. KMC publishes 80 per-ward drainage maps as PDFs; the vector network exists on paper but not as data. The 182 drain segments shown come from OpenStreetMap, against Chennai's 10,308 surveyed segments.",
      },
      {
        en: "Rainfall intensity is reanalysis, not gauges. ERA5-family products smooth short convective bursts, so exceedance counts are a LOWER BOUND on the true figure. Kolkata has no public sub-daily rain-gauge network comparable to Hyderabad's 185 stations.",
      },
      {
        en: "Cyclone and storm-surge exposure is real but unframed. The 2021 Yaas surge showed tidal flooding is a second, separate mechanism; it needs its own source and method rather than being folded into the drainage standard.",
      },
      {
        en: "The register records where KMC SENT machines, not everywhere the city flooded. It is an operational log, and reading it as a complete flood inventory would understate the problem.",
      },
      {
        en: "There is no working public flood early-warning system. KEIIP's programme site still links one at kflood.in, but the domain does not resolve (checked 26 July 2026). A city that floods as a weekly operating condition has no live public warning surface.",
      },
    ],
    cross_links: {
      home_desc: { en: "The drainage-capacity hero: how often the sky beats 6 mm an hour" },
      rivers_label: { en: "Kolkata river system" },
      rivers_desc: { en: "The Hooghly, and the Adi Ganga at zero dissolved oxygen" },
      water_bodies_desc: { en: "5,526 OSM water bodies against KMC's 1993 departmental tank list" },
    },
  },
};

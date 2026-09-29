import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Pune flood risk - 1,014 km of PMC nalla network, the 1961 Panshet breach with no official death toll, and statutory flood lines that exist only as scanned paper sheets.",
  // PUNE. The fourth narrative city, and the second whose flooding is drainage
  // driven rather than release driven - so like Hyderabad it renders neither a
  // dam_release_threshold_cusecs nor a primary_trigger. Pune HAS four dams
  // upstream and discharge from Khadakwasla is a real mechanism, but no public
  // release-to-inundation threshold exists for it, and inventing one would be
  // exactly the failure those optional fields were made to avoid.
  //
  // The route was OFF until this landed, on the recorded reason that Maharashtra
  // WRD publishes Pune's statutory flood lines only inside a statewide register
  // of SCANNED PDF SHEETS with no vector form, so the hazard layer does not exist. That reason was about the
  // wrong variant: the narrative stack needs no hazard polygons, and Pune holds
  // 1,014 km of nalla geometry that was rendering nowhere. The flood-line gap
  // stays, as a data gap on the page.
  config: {
    scope_label: { en: "PMC nalla network + the Mula-Mutha" },
    cross_links: {
      home_desc: { en: "PMC's own water budget, and why the shortfall is smaller than the leak" },
      rivers_label: { en: "Mula-Mutha river system" },
      rivers_desc: { en: "Seven rivers and the canal, with CPCB's priority classes and the 2024 readings behind them" },
      water_bodies_desc: { en: "791 lakes, tanks and reservoirs, from OpenStreetMap because no authority publishes a register for this city" },
    },
    headline: {
      en: "Pune's flood risk is drainage-driven, and the city cannot see it happen. PMC's nalla network is 3,075 open storm-water channels carrying 1,014 km, and every flood in the record below came down one of them. What the city lacks is instruments and maps. Dattawadi, the ONLY telemetric gauge inside Pune city, has an 84-day recording hole running 29 May to 22 August 2024, so it did not capture the 25 July 2024 flood at all - a gauge at Nighoje outside the city did, peaking at 568.92 m against a 563.02 m median. And Maharashtra's water resources department publishes the city's statutory red and blue flood lines only as scanned map sheets inside a statewide register - organised by river, no vector file behind any of them - so the legal boundary of the floodplain cannot be drawn on any map, including this one.",
    },
    drainage_map: {
      heading: { en: "The nalla network, and the rivers it drains into" },
      note: {
        en: "PMC's own storm-water layer: 3,075 nalla segments totalling 1,014 km, plotted against the seven rivers and the canal they discharge into. Segment lengths here are computed from the geometry and agree with PMC's own length column to 0.4%, which is a check on the geometry rather than a restatement of it. TWO HONEST LIMITS ON THIS MAP. Not one of the 3,075 segments is named in the source, so Ambil Odha - the nalla the 2019 flash flood came down - cannot be picked out of it. And this is the OPEN drainage only: PMC publishes a further 141,341 buried pipe segments, left off deliberately because they are far too dense to draw and answer a maintenance question rather than a flooding one.",
      },
      zoom: 11,
      layers: [
        {
          url: "/geojson/pune-drainage.geojson",
          label: "Nalla network (3,075 segments, 1,014 km)",
          kind: "line",
          color: "#2563eb",
          nameProp: "nalla_id",
        },
        {
          url: "/geojson/pune-rivers.geojson",
          label: "Rivers and the Mutha Right Bank Canal",
          kind: "line",
          color: "#0891b2",
          nameProp: "name",
        },
      ],
    },
    // Dates and mechanisms only. No casualty or damage figures: Pune has no
    // per-event impact register, and the one number that circulates for 1961
    // is explicitly not an official count (see the gaps below, and
    // /pune/origins chapter 3).
    historical_events: [
      {
        year: 1961,
        trigger: {
          en: "The Panshet dam breached on the morning of 12 July while still under construction, sending its reservoir down the Ambi into the Mutha and through the city.",
        },
        impact: {
          en: "Contemporary accounts describe close to half the built city inundated. HOW MANY PEOPLE DIED IS NOT KNOWN, and that is the state's own position rather than a gap in our research: the Government of Maharashtra's current Pune District Disaster Management Plan records the disaster and states that no official casualty figure exists. A round number has circulated in retellings for sixty-five years and has never been anybody's official count.",
        },
        source_label: "Government of Maharashtra, Pune District Disaster Management Plan",
      },
      {
        year: 2019,
        trigger: {
          en: "A cloudburst over the Ambil Odha, a nalla running through the south of the city, on 25 September.",
        },
        impact: {
          en: "The flood came down the drain rather than the river, which is the mechanism this page exists to show. The Ambil Odha is in PMC's nalla layer above, but unnamed there like every other segment, so it cannot be highlighted.",
        },
      },
      {
        year: 2024,
        trigger: {
          en: "Heavy rainfall over the Khadakwasla catchment with discharge from the dam, on 25 July and again on 4 August.",
        },
        impact: {
          en: "The city's own instrumentation missed it. Dattawadi, the only gauge inside Pune city, was in an 84-day recording hole from 29 May to 22 August 2024 and captured nothing; Khadakwasla_1 had a 96-day hole over the same window. Nighoje on the Indrayani did record the event, peaking at 568.92 m on 25 July against a 563.02 m median.",
        },
        source_label: "India-WRIS / NWDP groundwater level telemetry, Maharashtra",
        source_url: "https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-6-hourly-maharashtra",
      },
      {
        year: 2025,
        trigger: { en: "Intense rainfall on 21 August." },
        impact: {
          en: "The most recent event in the register. In June of the same year the Bombay High Court ordered Pune's flood lines redrawn, which is the process that would eventually produce the vector hazard layer this page cannot show.",
        },
      },
    ],
    external_sources: [
      {
        name: "Maharashtra WRD flood line maps",
        description: {
          en: "The statutory red (100-year) and blue (25-year) flood lines, published as one statewide register of scanned PDF map sheets (513 as of September 2026, all districts, organised by river) with Pune's sheets inside it. No vector form - see the data gaps below.",
        },
        url: "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps",
        cadence: "irregular",
      },
      {
        name: "Maharashtra WRD Pravah dam-safety bulletin",
        description: {
          en: "Daily storage and discharge for the Khadakwasla chain. This is the feed behind the reservoir cards on the Pune dashboard, and discharge from Khadakwasla is the upstream half of the city's flood mechanism.",
        },
        url: "https://mwrdpravah.in/damsafety/control/pdfLatestReportEng",
        cadence: "daily",
      },
    ],
    data_gaps: [
      {
        en: "NO VECTOR FLOOD LINE, and this is the largest gap on the page. Maharashtra WRD publishes its statutory red and blue flood lines as one statewide register of scanned PDF map sheets - 513 sheets across all districts as of September 2026, organised by river, with Pune's Mula, Mutha, Pawna and Indrayani sheets inside it - and no shapefile, GeoJSON or KML anywhere; text extraction returns no characters at all from the Mutha sheets. So the legal floodplain boundary cannot be drawn, joined to a ward, or compared against what is built inside it. Digitising the raster sheets is a project rather than a fetch. Retire this gap when the redraw the Bombay High Court ordered in June 2025 produces a vector file.",
      },
      {
        en: "NO NAMED NALLAS. PMC's storm-water layer carries an id, an object id, a project phase and a length, and no name on any of its 3,075 segments. Ambil Odha, Nagzari and Bhairoba nalla are what the flood reporting is about, and none of them can be identified in the data.",
      },
      {
        en: "NO DRAINAGE DESIGN STANDARD. Kolkata publishes that its sewers were built to carry 6 mm of rain an hour, which makes measured rainfall directly comparable against the network and is what that city's hero is built on. No equivalent published figure has been found for Pune's nallas, so this page carries no capacity threshold.",
      },
      {
        en: "NO MODELLED INUNDATION. There is no Pune equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS, so no hazard choropleth and no depth or return-period extents.",
      },
      {
        en: "NO PER-EVENT IMPACT REGISTER. The dates and mechanisms above are well attested; deaths, displacement and damage are not published per event in any source found. The event cards therefore carry no casualty or damage figures rather than repeating numbers from news retellings.",
      },
      {
        en: "THE CITY GAUGE IS UNRELIABLE. Beyond the 84-day 2024 hole at Dattawadi, Pimpale Gurav sits at exactly 555.16 m for ten consecutive days and then jumps 18 m. Pune district has 120 telemetric groundwater stations and exactly one inside the corporation, so there is almost no redundancy when one fails.",
      },
    ],
  },
};

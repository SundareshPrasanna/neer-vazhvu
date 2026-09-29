import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Hyderabad flood risk - the GHMC nala network, major water-logging locations, and the encroachment data the city defines but does not publish.",
  // Hyderabad is the first narrative city whose flooding is NOT
  // dam-release-driven, which is why dam_release_threshold_cusecs is now
  // optional. Its floods are rainfall landing on a drain network that is
  // built over: the 2020 events were attributed to blocked and encroached
  // nalas rather than to unprecedented rain. Every figure below is either
  // in-repo or carries its source; no threshold is invented.
  config: {
    scope_label: { en: "Musi basin + GHMC nala network" },
    cross_links: {
      home_desc: { en: "Daily draw from six sources, and the twelve-year record behind it" },
      rivers_label: { en: "Musi river system" },
      rivers_desc: { en: "The Musi and the Esi - the rivers the twin reservoirs impound, and the channel the city discharges into" },
      water_bodies_desc: { en: "2,978 gazetted lakes, of which 1,626 have no final boundary notification - unsettled edges are where encroachment happens" },
    },
    headline: {
      en: "Hyderabad's flood risk is drainage-driven, not release-driven. The city sits on a tank cascade that was engineered to slow water down, and its 96 mapped nalas carry 245 km of what is left of that drainage. GHMC's own data layer defines fields for encroachments on each nala - government, private and religious, plus cases in court - and publishes all five as zero for all 96 drains. In the city that created HYDRAA in 2024 specifically to demolish encroachments, that is an unfilled column, not a clean record.",
    },
    // Both layers are GHMC's OWN registers, held in the repo since the data
    // acquisition pass and previously rendered nowhere. The 3,960-segment
    // canals-drains file is deliberately NOT mounted here: 3,926 of its
    // features are unnamed generic "Stream" segments from a different source
    // and would bury the 96 named nalas under noise.
    drainage_map: {
      heading: { en: "The drainage network, and where it backs up" },
      note: {
        en: "GHMC's 96 named storm-water nalas carry 245 km across five zones, and GHMC separately publishes 23 major water-logging locations. Plotting them together shows what the narrative above describes: the recurring flood points sit on the nala network, not away from it. Names are GHMC's own; the water-logging register carries no dates or depths, so these are locations rather than a severity ranking.",
      },
      zoom: 11,
      layers: [
        {
          url: "/geojson/hyderabad-nalas.geojson",
          label: "Storm-water nalas",
          kind: "line",
          color: "#2563eb",
          nameProp: "Nala_Name",
        },
        {
          url: "/geojson/hyderabad-waterlogging.geojson",
          label: "Major water-logging points",
          kind: "point",
          color: "#dc2626",
          nameProp: "name",
        },
        {
          // TGDPS automatic weather stations - a live feed, not a static
          // layer. 161 gauges inside one city is the densest urban rain
          // network on the platform; most Indian cities are measured by a
          // single IMD grid square.
          url: "/data/hyderabad-aws-stations.json",
          label: "Rain gauges (TGDPS)",
          kind: "point",
          color: "#059669",
          nameProp: "location",
          arrayProp: "stations",
          latProp: "latitude",
          lngProp: "longitude",
        },
      ],
    },
    historical_events: [
      {
        year: 2020,
        trigger: {
          en: "Extreme October rainfall over a drainage network narrowed by construction on nalas and lake beds",
        },
        impact: {
          en: "The floods that put nala encroachment at the centre of Hyderabad's water politics and led, four years later, to the creation of HYDRAA with powers to demolish structures in lake full-tank-level and buffer zones.",
        },
        source_url: "https://www.thehansindia.com/news/cities/hyderabad/hydbad-set-for-epoch-making-milestone-in-sewage-treatment-1009747",
        source_label: "Contemporary reporting on the post-2020 response",
      },
      {
        year: 1908,
        trigger: {
          en: "The Great Musi Flood, 28 September 1908 - and a cascade failure, not simply a rainfall event",
        },
        impact: {
          en: "Roughly 59,000 houses damaged, and 221 of the 788 tanks strung along the Musi breached - the chain failing link by link, each collapse feeding the next. M. Visvesvaraya was appointed Special Consulting Engineer on 15 April 1909 and proposed impounding reservoirs to hold back 'all floods in excess of what the river channel could carry'. Osman Sagar was begun in 1913 and completed in 1918; Himayat Sagar followed on the Esi. Both were built as flood control first and water supply second.",
        },
        source_url: "https://en.wikipedia.org/wiki/Great_Musi_Flood_of_1908",
        source_label: "Great Musi Flood of 1908",
      },
    ],
    external_sources: [
      {
        name: "TGDPS automatic weather stations",
        url: "https://tgdps.telangana.gov.in/GHMC.jsp",
        cadence: "daily",
        description: {
          en: "161 rain gauges inside the city, each with coordinates and a daily cumulative total. Every other city on this platform infers rainfall from a single 0.25-degree grid cell about 28 km across; for localised flooding that is the difference between seeing a storm and averaging it away.",
        },
      },
      {
        name: "GHMC nala network and major water-logging locations",
        url: "https://data.opencity.in/dataset/hyderabad-canals-drains-and-tanks-lakes",
        cadence: "undated extract",
        description: {
          en: "96 named nalas totalling 245,238 m, plus 23 designated major water-logging points and 3,960 canal and drain segments. Republished by OpenCity; the KMLs carry no edition date, so treat as an undated GHMC extract rather than current-year.",
        },
      },
      {
        name: "HMDA gazetted lake register - full tank levels and buffer zones",
        url: "https://lakes.hmda.gov.in/",
        cadence: "episodic (notifications issued in batches)",
        description: {
          en: "A lake without a final FTL notification has no legally settled boundary to prosecute building against. 1,626 of 2,978 are in that state, and the weakest coverage - 34.5% - is Rangareddy, the Outer Ring Road growth corridor.",
        },
      },
    ],
    data_gaps: [
      {
        en: "GHMC's per-nala encroachment counts are published as a schema and left empty: Govt_Encr, Pvt_Encr, Rel_Encr, Total_Encr and Court_Case all read zero for all 96 drains. Those fields are stripped from our data rather than rendered, because showing them would read as 'zero encroachments'. Because the city has already specified the schema, this is an unusually precise thing to request.",
      },
      {
        en: "No public flood-hazard model. There is no Hyderabad equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS, so this page carries no modelled inundation extent.",
      },
      {
        en: "No stated drainage design capacity. Kolkata publishes that its sewers were built for 6 mm of rain an hour, which makes rainfall directly comparable against the network. No equivalent figure has been found for Hyderabad's nalas.",
      },
      {
        en: "The 23 water-logging points are locations, not a time series - there is no public record of how often each floods, so they cannot be ranked by frequency.",
      },
    ],
  },
};

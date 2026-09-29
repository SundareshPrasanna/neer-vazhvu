import type { CityFloodContent } from "./types";

export const FLOOD: CityFloodContent = {
  metaDescription:
    "Surat flood risk - the Ukai release chain, the weir-cum-causeway, five khadis against SMC's published danger levels, and what the corporation does not publish.",
  // SURAT. The one city on the platform whose publisher states an operational
  // threshold at every link of the chain - Ukai's full reservoir level, the
  // weir-cum-causeway's overflow level, and a danger level for each of five
  // khadis - and the one whose flood story is therefore ALREADY on the
  // dashboard, as the flood-headroom hero. Not repeated here.
  //
  // NO THRESHOLD CARD ON PURPOSE. primary_trigger and
  // dam_release_threshold_cusecs are both config numbers, and the hero's
  // honesty contract is that no threshold rendered anywhere for Surat is ours:
  // every one is read from surat-flood-chain.json at render, so config and
  // source cannot drift apart silently. Restating 6.00 m here would break
  // exactly that. The khadis are named below without their numbers.
  //
  // NO EVENT LIST. August 2006 is Surat's defining flood and every figure for
  // it currently traces to news coverage or advocacy reporting, so it is held
  // out under the defensible-numbers rule rather than printed. That is why the
  // events card is guarded on length in flood-risk-content.
  config: {
    scope_label: { en: "Tapi basin + the Ukai release chain" },
    headline: {
      en: "Surat's flooding arrives from upstream. Rain lands on eight municipal zones, Ukai decides what passes downstream, the weir-cum-causeway inside the city is either under water or not, and five khadis - Kakara and Bhedwad in Udhana, Mithi and Bhatena in Limbayat, Simada in Varachha - carry it to the streets. The corporation publishes a live reading and its own trigger level at every one of those links, which is what the dashboard's headroom card is built on. This page carries the rest: where to watch during an event, and what is not published at all.",
    },
    historical_events: [],
    external_sources: [
      {
        name: "Surat Municipal Corporation - live rainfall, dam, weir and khadi levels",
        description: {
          en: "The operational feed. Five tables through the day in monsoon: Ukai's level and inflow/outflow, the weir-cum-causeway and whether the causeway is open, zone-wise rainfall across the eight zones, the season total, and each khadi against its published danger level. This is the source behind the headroom hero.",
        },
        url: "https://www.suratmunicipal.gov.in/Home/RainfallInfo",
        cadence: "Through the day in monsoon",
      },
      {
        name: "Narmada, Water Resources, Water Supply and Kalpsar Department, Government of Gujarat",
        description: {
          en: "Ukai is not the corporation's dam. SMC attributes its dam and weir rows to the Irrigation Department and the Collector's office, and the release decision that sets Surat's flood risk is taken at state level, in this department.",
        },
        url: "https://guj-nwrws.gujarat.gov.in/",
        cadence: "Departmental, no fixed cadence",
      },
      {
        name: "India Meteorological Department",
        description: {
          en: "Nowcasts and district rainfall warnings for Surat, upstream of anything SMC's own gauges record. The corporation reports rain that has already fallen on the city; a release decision at Ukai is made against rain that has fallen on the catchment.",
        },
        url: "https://mausam.imd.gov.in/",
        cadence: "Multiple times daily",
      },
      {
        name: "Central Water Commission - flood forecast",
        description: {
          en: "The national flood-forecast portal. Listed as the place to look rather than as a known feed: no level or inflow forecast station for the Tapi at Surat has been identified on it, which is itself recorded as a gap below.",
        },
        url: "https://ffs.india-water.gov.in/",
        cadence: "Daily in flood season",
      },
    ],
    data_gaps: [
      {
        en: "NO MODELLED INUNDATION. There is no Surat equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS. No hazard choropleth, no depth extents, no return-period map, and no published waterlogging-spot register. This route therefore carries no map at all rather than an empty one.",
      },
      {
        en: "NO KHADI GEOMETRY. SMC publishes a danger level for each of the five monitored khadis and a live reading against it, and no centreline, no catchment and no cross-section for any of them. The numbers are precise and the creeks cannot be drawn.",
      },
      {
        en: "NO WARD GEOMETRY. Three competing ward schemes exist for Surat and none has downloadable boundaries: WFS is disabled on the corporation's own GIS server. Every ward-keyed surface on this platform is therefore off for Surat, not thinned.",
      },
      {
        en: "NO STORM-WATER NETWORK, NO DESIGN STANDARD. Neither the drainage geometry nor a published carrying capacity has been found. Kolkata publishes that its sewers were built for 6 mm of rain an hour, which is what makes measured rainfall comparable against a network; no equivalent figure is available here.",
      },
      {
        en: "THE LIVE FEED HAS NO ARCHIVE. SMC's page holds a rolling window of about ten readings, with no dated URL, no API and no download. Every day the scraper does not run is lost permanently, so the series on this platform starts the day it first ran and never implies a longer record than that.",
      },
      {
        en: "NO CWC FORECAST STATION IDENTIFIED for the Tapi at Surat. The release that drives the city's flooding is decided upstream at Ukai, and no public forecast of it - as opposed to a reading of what has already been released - has been found.",
      },
      {
        en: "AUGUST 2006 IS NOT PRIMARY-SOURCED. Surat's defining flood, and the obvious thing to render today's release against, is deliberately absent. Every figure for it currently traces to Wikipedia, news coverage or advocacy reports. It returns from the People's Committee on Gujarat Floods report or the Surat Citizens' Council Trust report, and not before.",
      },
    ],
    cross_links: {
      home_desc: {
        en: "The live chain link by link, and how much room is left at the tightest point on it",
      },
      rivers_label: { en: "Tapi and Mindhola" },
      rivers_desc: {
        en: "Six editions of CPCB monitoring across eight stations, and two CETPs against their own consent conditions",
      },
      water_bodies_desc: {
        en: "805 mapped bodies inside SMC limits from the SAC wetland atlas, and the naming gap that comes with them",
      },
    },
  },
};

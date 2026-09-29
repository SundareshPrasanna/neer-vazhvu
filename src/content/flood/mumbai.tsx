import { Fragment } from "react";
import { SourceLink as L } from "@/components/flood/source-link";
import type { CityFloodContent } from "./types";

/**
 * Mumbai's flooding is rainfall (monsoon cloudburst) + high tide + choked
 * drainage, not a dam release, so its page is a map rather than the narrative
 * stack. Four layers: chronic flooding spots + flood-prone subways
 * (public/data/mumbai-flood-hotspots.geojson, BMC's Disaster Management
 * flood-spot register), the 26 July 2005 deluge reference points
 * (public/geojson/mumbai-flood-2005-hotspots.geojson, from the Chitale Committee
 * record + retrospectives), and the OSM-mapped drain/nalla network
 * (public/geojson/mumbai-drainage.geojson, ~380 KB, loaded on first toggle).
 * NOT shipped: modelled hazard-zone / return-period polygons and the official
 * BRIMSTOWAD as-built drain survey - BMC publishes neither, and iFLOWS-Mumbai
 * is not public. Those stay in "data we don't have". English-only for now;
 * Marathi follows in the i18n pass.
 */
export const FLOOD: CityFloodContent = {
  metaDescription:
    "Mumbai flood risk - BMC chronic-flooding register, the 26/7/2005 reference layer, and WRD red/blue flood-line sheets.",
  map: {
    center: [19.076, 72.8777],
    zoom: 11,
    scope: "Greater Mumbai (BMC) · chronic monsoon flooding spots",
    summary: "110 BMC-registered spots (of 496 on the 2026 pre-monsoon list) · 26/7/2005 layer · OSM drain network",
    layersTitle: "Layers",
    collapsible: true,
    layers: [
      {
        url: "/data/mumbai-flood-hotspots.geojson",
        kind: "point",
        style: { color: "#0f172a", weight: 1, fillOpacity: 0.85, radius: 6 },
        categoryProp: "category",
        nameProp: "name",
        nameFallback: "(unnamed point)",
        suffix: { prop: "ward", prefix: " · Ward " },
        lines: [
          { prop: "category_label", muted: true, always: true },
          { prop: "location", muted: true },
        ],
        popup: true,
        popupNote:
          "BMC publishes this spot inventory, not per-spot flood dates - event history is a named gap we are pursuing.",
        rows: [
          { value: "chronic_spot", fillColor: "#dc2626", label: "Chronic flooding spots", swatch: "w-2.5 h-2.5 rounded-full bg-red-600", accent: "accent-red-600", on: true },
          { value: "subway", fillColor: "#2563eb", label: "Flood-prone subways", swatch: "w-2.5 h-2.5 rounded-full bg-blue-600", accent: "accent-blue-600", on: true },
          { value: "flooding_spot", fillColor: "#ea580c", label: "Other monitored spots", swatch: "w-2.5 h-2.5 rounded-full bg-orange-600", accent: "accent-orange-600", on: true },
        ],
      },
      {
        url: "/geojson/mumbai-flood-2005-hotspots.geojson",
        kind: "point",
        style: { color: "#78350f", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.8, radius: 7 },
        nameProp: "name",
        nameFallback: "(unnamed)",
        lines: [
          { prop: "depth_label", prefix: "26/7/2005: " },
          { prop: "note", muted: true },
        ],
        popup: true,
        rows: [{ label: "26 July 2005 deluge", swatch: "w-2.5 h-2.5 rounded-full bg-amber-500", accent: "accent-amber-500" }],
      },
      {
        url: "/geojson/mumbai-drainage.geojson",
        kind: "line",
        style: { color: "#0284c7", weight: 1.2, opacity: 0.55 },
        nameProp: "name",
        rows: [{ label: "Drains + nallas (OSM)", swatch: "w-2.5 h-0.5 bg-sky-600", accent: "accent-sky-600" }],
      },
    ],
    elevationNote:
      "Ground height above sea level from satellite (FABDEM 30 m, buildings and forests removed). The blue bands are where water collects - most of BMC's chronic spots sit below 5 m. Read as bands, not spot heights (~2 m vertical accuracy).",
    sidebar: {
      heading: "{city} flood risk",
      intro:
        "Mumbai floods when an intense monsoon cloudburst coincides with a high tide that shuts the city's gravity outfalls, and an under-capacity, often-choked stormwater drainage network cannot clear the water. The 26 July 2005 deluge (944 mm at Santacruz in 24 hours) is the reference event. The map shows Greater Mumbai's (BMC) chronic spots that waterlog almost every monsoon. The wider metropolitan region floods too - the Ulhas and Waldhuni inundate Ulhasnagar, Kalyan-Dombivli, Ambernath and Badlapur each monsoon - but no equivalent published spot inventory exists for the other corporations yet (see below).",
      shows: {
        heading: "What this shows",
        items: [
          "110 officially registered flooding spots from BMC's Disaster Management flood-spot register - the city's own names, wards and coordinates, each spot tied to an automatic rain gauge (94 chronic, 5 subways, 11 others)",
          "Context: BMC's 2026 pre-monsoon list counts 496 flood-prone spots citywide, 403 reported mitigated, 93 expected to waterlog in very heavy rain - and the list has grown 386 (2024) → 453 (2025) → 496 (2026) even as mitigation is claimed at 80%+ each year; 547 IoT-tracked dewatering pumps deployed in 2026",
          "The money: Urban Flooding & Water Resource Management is the largest sector of Mumbai's climate budget - Rs 15,048 crore allocated in FY 2025-26 (FY 2024-25: Rs 9,708 crore budgeted, Rs 7,439 crore spent) - over the same two years the flooding-spot list grew by 110",
          "26 July 2005 deluge reference points - the localities the reference event hit hardest, with reported inundation depths where the record gives one",
          "The mapped storm-drain + nalla network (~350 km from OpenStreetMap) - the choked-drainage half of the flooding equation",
        ],
      },
      gaps: {
        heading: "Data we don't have",
        items: [
          <Fragment key="iflows">
            <strong>iFLOWS-Mumbai is not public.</strong> The city&apos;s integrated flood-warning system (built with
            public money) briefs officials only - no public dashboard or API.
          </Fragment>,
          "No official BRIMSTOWAD as-built drain survey. The drainage layer here is OSM-mapped drains and nallas - real geometry, but community-traced coverage, not BMC's network with capacities and condition.",
          "No public modelled flood hazard-zone / return-period (5/10/25/50/100-year) polygons.",
          <Fragment key="spot-list">
            <strong>The full 496-spot pre-monsoon list is not published with locations.</strong>{" "}
            The 110 mapped here are BMC&apos;s registered/monitored subset (its DM API); the remaining ~386 exist only as
            counts in briefings. An RTI to BMC&apos;s Storm Water Drains department would yield the ward-wise list.
          </Fragment>,
          "26/7/2005 point coordinates are estimated locality centroids - no reviewed source publishes coordinates, and no official GIS inundation extent for the event is public.",
          <Fragment key="region">
            <strong>No regional flood-spot inventory beyond BMC.</strong> The eastern Ulhas/ Waldhuni corridor
            (Ulhasnagar, Kalyan-Dombivli, Ambernath, Badlapur) and Vasai-Virar flood chronically, but the other
            corporations publish no equivalent list of observed waterlogging spots, so only Greater Mumbai&apos;s points
            are mapped here. The state flood-line sheets below are a different kind of record: legal river-floodplain
            boundaries (where a 25-year or 100-year flood <em>would</em> reach), not registers of where flooding recurs -
            the two complement rather than substitute for each other.
          </Fragment>,
        ],
      },
      // Official WRD red/blue flood-line map sheets for the MMR's rivers - the legal no-build boundaries.
      floodLines: true,
      sources: {
        heading: "External sources",
        separator: "·",
        items: [
          {
            href: "https://mumbairain.tropmet.res.in/",
            label: "IITM Mumbai-rain (4-radar nowcast)",
            note: "India's only city-scale polarimetric-radar + MESONET rainfall mesh, 15-min cadence. The single best public flood-precursor signal for Mumbai.",
          },
          { href: "https://dm.mcgm.gov.in/", label: "MCGM Disaster Management", note: "ward rain gauges, tide table, monsoon advisories." },
          { href: "https://mausam.imd.gov.in/mumbai/", label: "IMD Mumbai", note: "Colaba + Santacruz observatories; nowcast + warnings." },
        ],
      },
      footer: {
        heading: "Layer sources",
        items: [
          <Fragment key="spots">
            Flooding spots: <L href="https://dm.mcgm.gov.in/">BMC Disaster Management flood-spot register</L>{" "}
            (official API, fetched July 2026).
          </Fragment>,
          <Fragment key="counts">
            2026 pre-monsoon counts (496 / 403 mitigated / 93 open):{" "}
            <L href="https://curlytales.com/india/trending/ahead-of-monsoon-bmc-flags-unsafe-buildings-flood-spots-and-landslide-zones-in-mumbai/">
              Municipal Commissioner&apos;s pre-monsoon briefing (Apr 2026, via HT/Curly Tales)
            </L>
            ; trend 386 (2024) / 453 (2025):{" "}
            <L href="https://www.oneindia.com/mumbai/mumbai-waterlogging-news-citys-flood-prone-areas-rise-to-453-as-monsoon-nears-4132175.html">
              Oneindia
            </L>{" "}
            +{" "}
            <L href="https://www.freepressjournal.in/mumbai/bmc-boosts-dewatering-pumps-to-547-mithi-river-desilting-pending-as-waterlogging-spots-rise-10">
              Free Press Journal
            </L>{" "}
            (also the 547-pump figure).
          </Fragment>,
          <Fragment key="deluge">
            26/7/2005 layer:{" "}
            <L href="https://cat.org.in/wp-content/uploads/2017/03/Mumbai-Marooned-An-Enquiry-into-Mumbais-Floods-2005.pdf">
              Concerned Citizens&apos; Commission, Mumbai Marooned (2005)
            </L>
            ,{" "}
            <L href="https://nidm.gov.in/journal/PDF/Journal/Journal20092/Journal20092b.pdf">
              Gupta, Disaster &amp; Development 3(2), NIDM 2009
            </L>
            ,{" "}
            <L href="https://www.oecd.org/content/dam/oecd/en/publications/reports/2010/11/flood-risks-climate-change-impacts-and-adaptation-benefits-in-mumbai_g17a1f04/5km4hv6wb434-en.pdf">
              Hallegatte et al., OECD (2010)
            </L>
            .
          </Fragment>,
          <Fragment key="budget">
            Climate-budget figures:{" "}
            <L href="https://data.opencity.in/dataset/mumbai-climate-action-plan/resource/d2da01c0-4afc-4039-9a16-7aeca5947929">
              BMC Climate Budget Report 2025-26
            </L>{" "}
            (Climate Action Cell, via OpenCity).
          </Fragment>,
          "Drainage: OpenStreetMap via Overpass (ODbL) - community-traced, not BMC's BRIMSTOWAD as-built network.",
        ],
        paras: [
          <Fragment key="about">
            Methodology and the full source list live at <L href="/mumbai/about#data-sources">/mumbai/about</L>.
          </Fragment>,
        ],
      },
    },
  },
};

import type { CityFloodContent } from "./types";

/**
 * Bengaluru's flood page is a map, not the narrative stack: KSRSAC KMLs
 * republished by OpenCity (CC-public-domain, Nov 2025) give 399 flood-hotspot
 * points (named-prone / unnamed-vulnerable / named-low-lying) and the BBMP
 * primary + secondary stormwater drain (rajakaluve) network. Copy is in the
 * frb.* translation keys (en/ta/kn).
 *
 * NOT shipped:
 * - 5/10/25/50/100/200-year return-period polygons. They come out of the
 *   DST-funded IISc-KSNDMC Urban Flood Model (Current Science vol. 120 no. 9,
 *   May 2021), but the rasters are not republished anywhere. Acquisition path
 *   is an RTI / partnership ask through T.V. Ramachandra's group at IISc CES;
 *   stated in the sidebar's "data we don't have".
 * - The tertiary drain network (~5,800 features, 17 MB): too heavy for direct
 *   GeoJSON; queued for a PMTiles follow-up.
 */
export const FLOOD: CityFloodContent = {
  metaDescription:
    "Bengaluru flood risk - KSRSAC flood hotspots, rajakaluve drainage network, and historical inundation.",
  map: {
    center: [12.9716, 77.5946],
    zoom: 11,
    scope: { key: "frb.scope_label" },
    summary: { key: "frb.summary_counts" },
    layersTitle: { key: "frb.layers" },
    layers: [
      {
        url: "/geojson/bangalore-swd-primary.geojson",
        kind: "line",
        style: { color: "#1d4ed8", weight: 2.5, opacity: 0.85 },
        nameProp: "name",
        nameFallback: "Primary stormwater drain",
        fit: true,
        rows: [{ label: { key: "frb.primary_drains" }, swatch: "w-4 h-1 rounded bg-blue-700", accent: "accent-blue-700", on: true }],
      },
      {
        url: "/geojson/bangalore-swd-secondary.geojson",
        kind: "line",
        style: { color: "#3b82f6", weight: 1.2, opacity: 0.55 },
        fit: true,
        rows: [{ label: { key: "frb.secondary_drains" }, swatch: "w-4 h-0.5 rounded bg-blue-500", accent: "accent-blue-500", on: true }],
      },
      {
        url: "/data/bangalore-flood-hotspots.geojson",
        kind: "point",
        divider: true,
        style: { color: "#0f172a", weight: 1, fillOpacity: 0.85 },
        categoryProp: "category",
        nameProp: "name",
        nameFallback: "(unnamed point)",
        lines: [{ prop: "category_label", muted: true, always: true }],
        // The unnamed-vulnerable cloud starts off: it crowds out the named-locality story.
        rows: [
          { value: "named_flood_prone", fillColor: "#dc2626", radius: 6, label: { key: "frb.named_prone" }, swatch: "w-2.5 h-2.5 rounded-full bg-red-600", accent: "accent-red-600", on: true },
          { value: "named_low_lying", fillColor: "#ea580c", radius: 5, label: { key: "frb.named_low_lying" }, swatch: "w-2.5 h-2.5 rounded-full bg-orange-600", accent: "accent-orange-600", on: true },
          { value: "vulnerable_unnamed", fillColor: "#facc15", radius: 4, label: { key: "frb.vulnerable" }, swatch: "w-2.5 h-2.5 rounded-full bg-yellow-400 border border-slate-700", accent: "accent-yellow-400" },
        ],
      },
    ],
    elevationNote:
      "Ground height above sea level from satellite (FABDEM 30 m, buildings and forests removed). Bengaluru's floods follow its valleys - the blue bands are the low ground the rajakaluves drain. Read as bands, not spot heights (~2 m vertical accuracy).",
    sidebar: {
      heading: { key: "frb.heading" },
      intro: { key: "frb.intro" },
      shows: {
        heading: { key: "frb.what_shows" },
        items: [
          { key: "frb.bullet_primary" },
          { key: "frb.bullet_secondary" },
          { key: "frb.bullet_named_prone" },
          { key: "frb.bullet_named_low" },
          { key: "frb.bullet_vulnerable" },
        ],
      },
      gaps: {
        heading: { key: "frb.gaps_heading" },
        items: [
          { key: "frb.gap_return_period" },
          { key: "frb.gap_tertiary" },
          { key: "frb.gap_live_rainfall" },
          { key: "frb.gap_bbmp_kaluve" },
        ],
      },
      sources: {
        heading: { key: "frb.external_heading" },
        separator: "-",
        items: [
          { href: "https://www.ksndmc.org/", label: "KSNDMC - Karnataka SDMA", note: { key: "frb.ksndmc_note" } },
          { href: "https://bhuvan.nrsc.gov.in/", label: "ISRO Bhuvan", note: { key: "frb.bhuvan_note" } },
          {
            href: "https://documents1.worldbank.org/curated/en/099052725120011568/pdf/P506272-cb80605f-d4d0-40be-af6e-40c57fddc414.pdf",
            label: "World Bank P506272",
            note: { key: "frb.wb_note" },
          },
          {
            href: "https://wgbis.ces.iisc.ac.in/energy/water/paper/urbanfloods_bangalore/",
            label: "IISc CES - T.V. Ramachandra urban-flood papers",
            note: { key: "frb.iisc_note" },
          },
          { href: "https://vai.bmtpc.org/Flood.html", label: "BMTPC Vulnerability Atlas", note: { key: "frb.bmtpc_note" } },
        ],
      },
      footer: {
        paras: [
          {
            key: "frb.source_para",
            link: { slot: "opencity", href: "https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban", label: "OpenCity Bengaluru" },
          },
          { key: "frb.about_para", link: { slot: "about_link", href: "/bangalore/about#data-sources", label: "/bangalore/about" } },
        ],
      },
    },
  },
};

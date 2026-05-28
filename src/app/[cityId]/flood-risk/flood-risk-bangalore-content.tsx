"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const FloodLeafletMap = dynamic(
  () => import("./flood-risk-bangalore-leaflet-map").then((m) => m.FloodLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

interface Props {
  cityDisplayName: string;
}

/**
 * Bengaluru-specific flood-risk page. Diverges from the Madurai
 * narrative-only stub because Bengaluru has KSRSAC-sourced KMLs
 * republished by OpenCity (CC-public-domain, Nov 2025): 399 flood
 * hotspot points (named-prone / unnamed-vulnerable / named-low-lying)
 * plus the BBMP primary + secondary stormwater drain (rajakaluve)
 * network.
 *
 * Returns NOT shipped here:
 * - 5/10/25/50/100/200-year flood return-period polygons. These
 *   come out of the DST-funded IISc-KSNDMC Urban Flood Model
 *   (Current Science vol. 120 no. 9, May 2021) but the underlying
 *   rasters are not republished anywhere. Acquisition path is an
 *   RTI / partnership ask through T.V. Ramachandra's group at
 *   IISc CES; documented in the sidebar's "data we don't have".
 * - Tertiary stormwater drain network (~5,800 features, 17 MB).
 *   Too heavy for direct GeoJSON ship; queued for a PMTiles
 *   follow-up.
 */
export function FloodRiskBangaloreContent({ cityDisplayName }: Props) {
  // Default layer state: primary + secondary drains + named hotspots
  // visible; the broader unnamed-vulnerable cloud off (turn on for
  // exploratory view, off to keep the named-locality story readable).
  const [layerState, setLayerState] = useState({
    showPrimary: true,
    showSecondary: true,
    showHotspotsNamedProne: true,
    showHotspotsLowLying: true,
    showHotspotsVulnerable: false,
  });

  const toggle = (key: keyof typeof layerState) => () =>
    setLayerState((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header / context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {cityDisplayName} · Flood risk
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          399 hotspots · 163 primary drains · 870 secondary drains · KSRSAC via
          OpenCity (Nov 2025)
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1 h-full">
          <FloodLeafletMap
            center={[12.9716, 77.5946]}
            zoom={11}
            layerState={layerState}
          />

          {/* Layer-toggle panel - top-right overlay */}
          <div className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-3 space-y-2 text-xs max-w-[230px]">
            <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
              Layers
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showPrimary}
                onChange={toggle("showPrimary")}
                className="accent-blue-700"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-1 rounded bg-blue-700" />
                Primary drains (163)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showSecondary}
                onChange={toggle("showSecondary")}
                className="accent-blue-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 rounded bg-blue-500" />
                Secondary drains (870)
              </span>
            </label>
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layerState.showHotspotsNamedProne}
                  onChange={toggle("showHotspotsNamedProne")}
                  className="accent-red-600"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
                  Named flood-prone (70)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layerState.showHotspotsLowLying}
                  onChange={toggle("showHotspotsLowLying")}
                  className="accent-orange-600"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" />
                  Named low-lying (129)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layerState.showHotspotsVulnerable}
                  onChange={toggle("showHotspotsVulnerable")}
                  className="accent-yellow-400"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 border border-slate-700" />
                  Vulnerable (200, unnamed)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-900 p-4 space-y-4 text-sm">
          <section>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Bengaluru&apos;s flood risk
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Bengaluru sits on a ridge that drains into three valleys -
              Vrishabhavathi (west), Koramangala-Challaghatta (south-east), and
              Hebbal-Nagavara (north). When monsoon rainfall exceeds the storm-
              drain network&apos;s capacity, water backs up at the named
              hotspots on this map. The 2022 monsoon submerged Whitefield /
              Manyata Tech Park / Outer Ring Road East for days; the 2024
              events extended into Yelahanka and Bommanahalli.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              What this map shows
            </h3>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-[13px] mt-1">
              <li>
                <span className="font-medium">163 primary stormwater drains</span>{" "}
                (rajakaluves) - the main BBMP-wide drainage spine, NGT-protected with a 50 m buffer order.
              </li>
              <li>
                <span className="font-medium">870 secondary drains</span> -
                feeder network connecting wards to the rajakaluves.
              </li>
              <li>
                <span className="font-medium">70 named flood-prone localities</span> -
                BBMP&apos;s curated list of named hotspots with documented
                flooding history (e.g. Bhadrappa Layout, Sampangirama Nagar).
              </li>
              <li>
                <span className="font-medium">129 named low-lying areas</span> -
                additional KSRSAC dataset of named low-elevation neighbourhoods
                (e.g. JRD Tata Nagar, Devi Nagara).
              </li>
              <li>
                <span className="font-medium">200 unnamed vulnerable points</span> -
                KSRSAC&apos;s broader vulnerability layer; toggle off by default
                because the unnamed cloud crowds out the named-locality story.
                Named-locality cross-reference is a follow-up RTI to BBMP.
              </li>
            </ul>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Data we don&apos;t have
            </h3>
            <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1.5 text-[12px] mt-1">
              <li>
                <span className="font-medium">
                  5 / 10 / 25 / 50 / 100 / 200-year return-period polygons.
                </span>{" "}
                The DST-funded IISc-KSNDMC Urban Flood Model (Current Science
                vol. 120 no. 9, May 2021) produces these by valley but the
                underlying rasters aren&apos;t republished. Acquisition path:
                RTI / partnership ask through T.V. Ramachandra&apos;s group at
                IISc CES.
              </li>
              <li>
                <span className="font-medium">Tertiary drains (~5,800 features).</span>{" "}
                Available from KSRSAC as a 17 MB GeoJSON - too heavy for raw
                browser load; queued for a PMTiles follow-up.
              </li>
              <li>
                <span className="font-medium">Live rainfall + SWD water-level.</span>{" "}
                KSNDMC has 100 ARG + 12 AWS + 25 SWD sensors inside BBMP at
                15-minute cadence. The Bengaluru Megha Sandesha app surfaces
                &quot;now&quot; only - bulk historical and a public REST feed
                are partnership-only.
              </li>
              <li>
                <span className="font-medium">BBMP rajakaluve survey-number GIS.</span>{" "}
                KSRSAC&apos;s primary-drains KML here is the public
                summary; the underlying survey-number-resolution dataset
                stays with BBMP SWD Department. RTI ask logged.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              External monitoring sources
            </h3>
            <ul className="text-slate-600 dark:text-slate-400 space-y-2 text-[13px] mt-1">
              <li>
                <a
                  href="https://www.ksndmc.org/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  KSNDMC - Karnataka SDMA
                </a>{" "}
                · 100 ARG / 12 AWS / 25 SWD sensors in BBMP, 15-min cadence
                (live via Megha Sandesha app)
              </li>
              <li>
                <a
                  href="https://bhuvan.nrsc.gov.in/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ISRO Bhuvan
                </a>{" "}
                · satellite flood-inundation layers for major historical events
                (2005, 2022, 2024)
              </li>
              <li>
                <a
                  href="https://documents1.worldbank.org/curated/en/099052725120011568/pdf/P506272-cb80605f-d4d0-40be-af6e-40c57fddc414.pdf"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  World Bank P506272
                </a>{" "}
                · Karnataka Water Security &amp; Resilience Program ($426M,
                2025) - references 372 flood hotspots 2013-2020 + 183 lakes as
                balancing reservoirs
              </li>
              <li>
                <a
                  href="https://wgbis.ces.iisc.ac.in/energy/water/paper/urbanfloods_bangalore/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  IISc CES - T.V. Ramachandra urban-flood papers
                </a>{" "}
                · valley-wise catchment + low-lying-ward analysis (ETR114 /
                ETR123 / ETR131)
              </li>
              <li>
                <a
                  href="https://vai.bmtpc.org/Flood.html"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  BMTPC Vulnerability Atlas
                </a>{" "}
                · Karnataka district-level flood hazard map (national context)
              </li>
            </ul>
          </section>

          <section className="border-t border-slate-200 dark:border-slate-700 pt-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              All spatial data on this page is sourced from{" "}
              <a
                href="https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban"
                target="_blank"
                rel="noopener"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                OpenCity Bengaluru
              </a>
              , which republishes KSRSAC&apos;s public-domain KMLs. Last source
              refresh: 27 November 2025.
            </p>
            <p>
              See{" "}
              <Link
                href="/bangalore/about#data-sources"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                /bangalore/about
              </Link>{" "}
              for the full data-source index and the IISc partnership ask
              logged as a Tier-1 follow-up.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

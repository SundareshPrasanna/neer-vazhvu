"use client";

import { useState } from "react";
import { FloodLinesSection } from "@/components/flood/flood-lines-section";
import dynamic from "next/dynamic";
import Link from "next/link";

const FloodMumbaiLeafletMap = dynamic(
  () => import("./flood-risk-mumbai-leaflet-map").then((m) => m.FloodMumbaiLeafletMap),
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
 * Mumbai-specific flood-risk page. Diverges from both the Madurai
 * dam-release narrative (the generic FloodRiskContent) and Bangalore's
 * drain-network map: Mumbai's flooding is rainfall (monsoon cloudburst) +
 * high-tide + choked-drainage driven.
 *
 * Ships four layers: chronic flooding spots + flood-prone subways
 * (public/data/mumbai-flood-hotspots.geojson), the 26 July 2005 deluge
 * reference points (public/geojson/mumbai-flood-2005-hotspots.geojson, sourced
 * from the Chitale Committee record + retrospectives), and the OSM-mapped
 * drainage/nalla network (public/geojson/mumbai-drainage.geojson). NOT
 * shipped: modelled hazard-zone / return-period polygons and the official
 * BRIMSTOWAD as-built drain survey - BMC publishes neither, and
 * iFLOWS-Mumbai (the city's integrated flood warning system) is not public.
 * Those stay documented in "data we don't have". Copy is English-only for
 * now; Marathi follows in the i18n pass.
 */
export function FloodRiskMumbaiContent({ cityDisplayName }: Props) {
  // Mobile: the layer panel covered over half the map width and blocked
  // pinch-zoom gestures; it starts collapsed there. Desktop keeps it open.
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerState, setLayerState] = useState({
    showChronic: true,
    showSubway: true,
    showFlooding: true,
    show2005: false,
    showDrainage: false,
    showElevation: false,
  });
  const toggle = (key: keyof typeof layerState) => () =>
    setLayerState((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header / context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Greater Mumbai (BMC) · chronic monsoon flooding spots
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          110 BMC-registered spots (of 496 on the 2026 pre-monsoon list) · 26/7/2005 layer · OSM drain network
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative h-[45vh] shrink-0 md:h-full md:flex-1 md:shrink">
          {/* Mobile: the map needs an explicit height - as a flex-basis-0 item
              next to the tall text sidebar it collapses to 0px and only its
              floating controls remain visible. Desktop keeps filling the row. */}
          <FloodMumbaiLeafletMap center={[19.076, 72.8777]} zoom={11} layerState={layerState} />

          {/* Layer-toggle panel */}
          <div className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-3 space-y-2 text-xs max-w-[230px]">
            <button
              type="button"
              onClick={() => setLayersOpen((v) => !v)}
              aria-expanded={layersOpen}
              className="md:pointer-events-none flex w-full items-center justify-between gap-2 font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide"
            >
              Layers
              <span className="md:hidden text-slate-400">{layersOpen ? "−" : "+"}</span>
            </button>
            <div className={`${layersOpen ? "block" : "hidden"} md:block space-y-2`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showChronic}
                onChange={toggle("showChronic")}
                className="accent-red-600"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
                Chronic flooding spots
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showSubway}
                onChange={toggle("showSubway")}
                className="accent-blue-600"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" />
                Flood-prone subways
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showFlooding}
                onChange={toggle("showFlooding")}
                className="accent-orange-600"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-600" />
                Other monitored spots
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.show2005}
                onChange={toggle("show2005")}
                className="accent-amber-500"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                26 July 2005 deluge
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showDrainage}
                onChange={toggle("showDrainage")}
                className="accent-sky-600"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-sky-600" />
                Drains + nallas (OSM)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layerState.showElevation}
                onChange={toggle("showElevation")}
                className="accent-sky-700"
              />
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-sky-800 via-lime-400 to-amber-800" />
                Ground elevation (FABDEM)
              </span>
            </label>
            {layerState.showElevation && (
              <div className="pl-6 space-y-1">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                  {[
                    ["#075985", "0-2 m"],
                    ["#0ea5e9", "2-5 m"],
                    ["#6ee7b7", "5-10 m"],
                    ["#a3e635", "10-20 m"],
                    ["#facc15", "20-50 m"],
                    ["#d97706", "50-100 m"],
                    ["#92400e", "100 m +"],
                  ].map(([c, l]) => (
                    <span key={l} className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
                      {l}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Ground height above sea level from satellite (FABDEM 30 m, buildings and
                  forests removed). The blue bands are where water collects - most of BMC&apos;s
                  chronic spots sit below 5 m. Read as bands, not spot heights (~2 m vertical
                  accuracy).
                </p>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full md:w-[380px] border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 overflow-y-auto bg-white dark:bg-slate-900 p-4 space-y-4 text-sm">
          <section>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {cityDisplayName} flood risk
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Mumbai floods when an intense monsoon cloudburst coincides with a high tide that
              shuts the city&apos;s gravity outfalls, and an under-capacity, often-choked
              stormwater drainage network cannot clear the water. The 26 July 2005 deluge (944 mm
              at Santacruz in 24 hours) is the reference event. The map shows Greater
              Mumbai&apos;s (BMC) chronic spots that waterlog almost every monsoon. The wider
              metropolitan region floods too - the Ulhas and Waldhuni inundate Ulhasnagar,
              Kalyan-Dombivli, Ambernath and Badlapur each monsoon - but no equivalent published
              spot inventory exists for the other corporations yet (see below).
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              What this shows
            </h3>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-[13px] mt-1">
              <li>
                110 officially registered flooding spots from BMC&apos;s Disaster Management
                flood-spot register - the city&apos;s own names, wards and coordinates, each spot
                tied to an automatic rain gauge (94 chronic, 5 subways, 11 others)
              </li>
              <li>
                Context: BMC&apos;s 2026 pre-monsoon list counts 496 flood-prone spots citywide,
                403 reported mitigated, 93 expected to waterlog in very heavy rain - and the list
                has grown 386 (2024) &rarr; 453 (2025) &rarr; 496 (2026) even as mitigation is
                claimed at 80%+ each year; 547 IoT-tracked dewatering pumps deployed in 2026
              </li>
              <li>
                The money: Urban Flooding &amp; Water Resource Management is the largest sector of
                Mumbai&apos;s climate budget - Rs 15,048 crore allocated in FY 2025-26 (FY 2024-25:
                Rs 9,708 crore budgeted, Rs 7,439 crore spent) - over the same two years the
                flooding-spot list grew by 110
              </li>
              <li>26 July 2005 deluge reference points - the localities the reference event hit hardest, with reported inundation depths where the record gives one</li>
              <li>The mapped storm-drain + nalla network (~350 km from OpenStreetMap) - the choked-drainage half of the flooding equation</li>
            </ul>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Data we don&apos;t have
            </h3>
            <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1.5 text-[12px] mt-1">
              <li>
                <strong>iFLOWS-Mumbai is not public.</strong> The city&apos;s integrated
                flood-warning system (built with public money) briefs officials only - no public
                dashboard or API.
              </li>
              <li>
                No official BRIMSTOWAD as-built drain survey. The drainage layer here is
                OSM-mapped drains and nallas - real geometry, but community-traced coverage,
                not BMC&apos;s network with capacities and condition.
              </li>
              <li>No public modelled flood hazard-zone / return-period (5/10/25/50/100-year) polygons.</li>
              <li>
                <strong>The full 496-spot pre-monsoon list is not published with locations.</strong>{" "}
                The 110 mapped here are BMC&apos;s registered/monitored subset (its DM API); the
                remaining ~386 exist only as counts in briefings. An RTI to BMC&apos;s Storm Water
                Drains department would yield the ward-wise list.
              </li>
              <li>26/7/2005 point coordinates are estimated locality centroids - no reviewed source publishes coordinates, and no official GIS inundation extent for the event is public.</li>
              <li>
                <strong>No regional flood-spot inventory beyond BMC.</strong> The eastern Ulhas/
                Waldhuni corridor (Ulhasnagar, Kalyan-Dombivli, Ambernath, Badlapur) and Vasai-Virar
                flood chronically, but the other corporations publish no equivalent list of observed
                waterlogging spots, so only Greater Mumbai&apos;s points are mapped here. The state
                flood-line sheets below are a different kind of record: legal river-floodplain
                boundaries (where a 25-year or 100-year flood <em>would</em> reach), not registers
                of where flooding recurs - the two complement rather than substitute for each
                other.
              </li>
            </ul>
          </section>

          {/* Official WRD red/blue flood-line map sheets for the MMR's
              rivers - the legal no-build boundaries. Self-hides for cities
              without a flood-lines data file. */}
          <FloodLinesSection cityId="mumbai" />

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              External sources
            </h3>
            <ul className="text-slate-600 dark:text-slate-400 space-y-2 text-[13px] mt-1">
              <li>
                <a
                  href="https://mumbairain.tropmet.res.in/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  IITM Mumbai-rain (4-radar nowcast)
                </a>{" "}
                · India&apos;s only city-scale polarimetric-radar + MESONET rainfall mesh, 15-min cadence. The single best public flood-precursor signal for Mumbai.
              </li>
              <li>
                <a
                  href="https://dm.mcgm.gov.in/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  MCGM Disaster Management
                </a>{" "}
                · ward rain gauges, tide table, monsoon advisories.
              </li>
              <li>
                <a
                  href="https://mausam.imd.gov.in/mumbai/"
                  target="_blank"
                  rel="noopener"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  IMD Mumbai
                </a>{" "}
                · Colaba + Santacruz observatories; nowcast + warnings.
              </li>
            </ul>
          </section>

          <section className="border-t border-slate-200 dark:border-slate-700 pt-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Layer sources
            </h3>
            <ul className="space-y-1">
              <li>
                Flooding spots:{" "}
                <a href="https://dm.mcgm.gov.in/" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  BMC Disaster Management flood-spot register
                </a>{" "}
                (official API, fetched July 2026).
              </li>
              <li>
                2026 pre-monsoon counts (496 / 403 mitigated / 93 open):{" "}
                <a href="https://curlytales.com/india/trending/ahead-of-monsoon-bmc-flags-unsafe-buildings-flood-spots-and-landslide-zones-in-mumbai/" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Municipal Commissioner&apos;s pre-monsoon briefing (Apr 2026, via HT/Curly Tales)
                </a>
                ; trend 386 (2024) / 453 (2025):{" "}
                <a href="https://www.oneindia.com/mumbai/mumbai-waterlogging-news-citys-flood-prone-areas-rise-to-453-as-monsoon-nears-4132175.html" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Oneindia
                </a>{" "}
                +{" "}
                <a href="https://www.freepressjournal.in/mumbai/bmc-boosts-dewatering-pumps-to-547-mithi-river-desilting-pending-as-waterlogging-spots-rise-10" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Free Press Journal
                </a>{" "}
                (also the 547-pump figure).
              </li>
              <li>
                26/7/2005 layer:{" "}
                <a href="https://cat.org.in/wp-content/uploads/2017/03/Mumbai-Marooned-An-Enquiry-into-Mumbais-Floods-2005.pdf" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Concerned Citizens&apos; Commission, Mumbai Marooned (2005)
                </a>
                ,{" "}
                <a href="https://nidm.gov.in/journal/PDF/Journal/Journal20092/Journal20092b.pdf" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Gupta, Disaster &amp; Development 3(2), NIDM 2009
                </a>
                ,{" "}
                <a href="https://www.oecd.org/content/dam/oecd/en/publications/reports/2010/11/flood-risks-climate-change-impacts-and-adaptation-benefits-in-mumbai_g17a1f04/5km4hv6wb434-en.pdf" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Hallegatte et al., OECD (2010)
                </a>
                .
              </li>
              <li>
                Climate-budget figures:{" "}
                <a href="https://data.opencity.in/dataset/mumbai-climate-action-plan/resource/d2da01c0-4afc-4039-9a16-7aeca5947929" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
                  BMC Climate Budget Report 2025-26
                </a>{" "}
                (Climate Action Cell, via OpenCity).
              </li>
              <li>
                Drainage: OpenStreetMap via Overpass (ODbL) - community-traced, not BMC&apos;s
                BRIMSTOWAD as-built network.
              </li>
            </ul>
            <p>
              Methodology and the full source list live at{" "}
              <Link
                href="/mumbai/about#data-sources"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                /mumbai/about
              </Link>
              .
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

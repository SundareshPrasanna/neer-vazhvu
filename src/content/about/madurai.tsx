"use client";

import { useLanguage } from "@/lib/i18n/context";
import { getPlaceConfig } from "@/lib/cities";
import { SubSection, DataSourceGroupHeader, DataSource, type LostBodyEntry } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { MaduraiPageDescriptions } from "./madurai-pages";

// 14 + 12 documented Madurai urban tanks (Vencatesan + DHAN field studies).
const MADURAI_LOST_BODIES: LostBodyEntry[] = [
  { name: "Thathaneri tank",          status: "Fully lost",       source: "Vencatesan (2014) urban tanks audit" },
  { name: "Bibikulam tank",           status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Chinna Chokkikulam tank",  status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Tallakulam tank",          status: "Fully lost",       source: "Vencatesan (2014) / Madurai Corporation records" },
  { name: "Managiri tank",            status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Sengulam tank",            status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Athikulam tank",           status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Pudhukulam tank",          status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Mudakkaththan tank",       status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Tirayathi tank",           status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Sathamangalam tank",       status: "Fully lost",       source: "Vencatesan (2014) / DHAN field studies" },
  { name: "Villapuram tank",          status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Anuppanady big tank",      status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Anuppanady small tank",    status: "Fully lost",       source: "Vencatesan (2014)" },
  { name: "Vandiyur tank",            status: "Severely reduced", source: "DHAN / Vencatesan (BHS-listed cluster)" },
  { name: "Madakulam tank",           status: "Severely reduced", source: "DHAN / Madras HC orders" },
  { name: "Sellur tank",              status: "Severely reduced", source: "DHAN / news (toxic-foam incidents)" },
  { name: "S. Kodikulam tank",        status: "Severely reduced", source: "DHAN field studies" },
  { name: "Kosakulam tank",           status: "Severely reduced", source: "DHAN field studies" },
  { name: "Veeramudiyan tank",        status: "Severely reduced", source: "DHAN field studies" },
  { name: "Avaniyapuram tank",        status: "Severely reduced", source: "DHAN / Madurai Corporation" },
  { name: "Chinthamani tank",         status: "Severely reduced", source: "DHAN field studies" },
  { name: "Puliyankulam tank",        status: "Severely reduced", source: "DHAN field studies" },
  { name: "Thenkaal tank",            status: "Severely reduced", source: "DHAN field studies" },
  { name: "Thenkal Kanmoi",           status: "Severely reduced", source: "DHAN field studies" },
  { name: "Koodal Alagar temple tank", status: "Severely reduced", source: "Heritage temple tank registry" },
];

/** Madurai's About-page content: the slots of the shared About frame that
 *  are specific to Madurai. A slot not listed renders the frame's default. */

export default function MaduraiAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const { t } = useLanguage();
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "reading-1":
      return (
        <>
            <SubSection title="How Madurai's tap is fed today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Madurai&apos;s drinking water travels a long path before it reaches a tap:
                <span className="font-semibold"> Mullaperiyar Dam (Kerala) → Periyar-Vaigai diversion tunnel → Vaigai Dam → Pannaipatty Water Treatment Plant (118.6 MLD) → Madurai Municipal Corporation distribution mains (~764 km) → 28 existing overhead reservoirs across 28 distribution zones / 81 District Metering Areas → ~95,487 connections → tap.</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                Two things are worth knowing when reading the dashboard&apos;s headline:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                <li>
                  <span className="font-semibold">Vaigai is a multi-purpose dam, not a city reservoir.</span> It&apos;s owned by the Tamil Nadu Public Works Department and shared across Madurai, Theni, Sivagangai and Ramanathapuram districts for both irrigation and drinking water. MMC&apos;s sanctioned drinking-water allocation is <span className="font-semibold">1,500 mcft per year</span> - a small slice of Vaigai&apos;s total storage. The most recent reported actual draw is ~900 mcft per year (≈70 MLD continuous).
                </li>
                <li>
                  <span className="font-semibold">We haven&apos;t yet found a public daily feed.</span> Pannaipatty WTP&apos;s daily raw-water intake and treated output, the 28 existing OHTs&apos; live levels (with 37 more being built under Tranche 2), and zone-by-zone supply are tracked inside MMC&apos;s ICCC and SCADA systems for internal monitoring; we don&apos;t have a route to a daily public surface for them today. So a single &quot;days of water left&quot; number for the city would be guesswork; we don&apos;t generate one.
                </li>
              </ul>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                What the dashboard <span className="font-semibold">does</span> show: Vaigai&apos;s live dam level (sourced daily from the Tamil Nadu Agriculture Department&apos;s reservoir page), MMC&apos;s public allocation and recent-draw constants, and the structural infrastructure of Pannaipatty WTP and the distribution network. That&apos;s the honest version of what&apos;s currently knowable from outside MMC.
              </p>
            </SubSection>
          
            <SubSection title="What's missing today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                A few daily-operations layers aren&apos;t currently part of {cityName}&apos;s public dataset. Most of these data points are tracked inside MMC&apos;s ICCC and SCADA systems for internal monitoring; they just aren&apos;t routed to a public surface yet. Listed here so users know where this dashboard&apos;s daily view ends.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                If any of these become available, the dashboard can move from structural numbers (annual allocation, plant capacity) to a real measured daily runway.
              </p>
              <div className="space-y-3 mt-3">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Daily Pannaipatty WTP raw-water intake + treated output</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Tracked inside MMC&apos;s ICCC SCADA. With a daily series, the dashboard could move from showing the allocation slice to showing actual measured throughput.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Per-DMA supply across the 81 District Metering Areas</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    DMA-level supply telemetry isn&apos;t in the public dataset today. 42 DMAs are covered via earlier 24x7 + Smart City Mission rollouts; ADB Tranche 3 covers the remaining 39, with 115 newly-established DMAs targeted post-build. With this telemetry the dashboard could surface which neighbourhoods are getting served daily and which lean on tankers and borewells.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">OHT-wise live storage (23 overhead reservoirs)</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Aggregate existing-OHT capacity (41.05 MLD across 28 OHTs per IEE Part 2) is documented per-tank in `madurai-supply-overview.json`; per-OHT live levels live in MMC&apos;s SCADA. Per-OHT readings would let zone-level supply gaps surface in near real time.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Non-revenue water and per-capita supply (LPCD)</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    MoHUA&apos;s Service Level Benchmarks set targets (135 LPCD, 20% NRW). We haven&apos;t yet found Madurai-specific actuals against these targets in any open dataset. Pey Jal Survekshan (which Madurai is a pilot city for) computes LPCD internally; we haven&apos;t found a public city-level scorecard.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">PWD-WRD daily Vaigai drinking-water release log</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Daily drinking-water release volumes from Vaigai are reported episodically through news during release events (Chithirai pulses, summer ~200 cusec drinking baseline) but not as a structured feed. A daily series would let the dashboard&apos;s allocation view reflect real seasonal variation rather than a static constant.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">In flight: ADB Investment Program IEE / DPR parse</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The ADB Tamil Nadu Urban Flagship Investment Program Tranches 2 and 3 contain engineering-grade tables for Madurai distribution zones, OHT capacities, and demand projections to 2046. Parsing those PDFs once is the next planned data unlock for the dashboard - converts the allocation hero into a zone-reliability heatmap.
                  </p>
                </div>
              </div>
            </SubSection>
          
            <SubSection title={t("about.consumption_madurai_title")}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("about.consumption_intro")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">{t("about.col_parameter")}</th>
                      <th className="pb-2 font-medium">{t("about.col_default")}</th>
                      <th className="pb-2 font-medium">{t("about.col_source")}</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_demand")}</td>
                      <td className="py-2 font-mono">{config.defaultConsumptionMld ?? "n/a"} MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        {t("about.row_demand_note")}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_desal")}</td>
                      <td className="py-2 font-mono">0 MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.row_desal_note")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_gw")}</td>
                      <td className="py-2 font-mono">{t("about.row_gw_value")}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        {t("about.row_gw_note")}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_evap")}</td>
                      <td className="py-2 font-mono">{t("about.row_evap_value")}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        {t("about.row_evap_note")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("about.adjust_note")}
              </p>
            </SubSection>
          
        </>
      );
    case "pages-1":
      return (
        <>
            <MaduraiPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="TN Agriculture - daily reservoir page + dated archive"
                url="https://tnagriculture.in/ARS/home/reservoir"
                description="Daily storage, level, inflow and outflow for Vaigai and Mullaperiyar (listed as Periyar) on a state-wide page. The same site serves a dated archive back to 2018, which we use to backfill the 9-year history chart."
                frequency="daily + 2018 archive"
              />
              <DataSource
                name="ADB TNUFIP Tranche 2 IEE - Madurai dedicated water supply scheme"
                url="https://www.adb.org/sites/default/files/project-documents/49107/49107-005-iee-en_10.pdf"
                description="Engineering-grade structural numbers extracted from the December 2025 ADB Initial Environmental Examination Parts 1-3 + Tranche 3 IEE: 192 MLD existing supply mix across 7 schemes (Vaigai surface 115 + Vaigai sub-surface 47 + Cauvery via Melur 30); Pannaipatty WTP 118.6 MLD existing (71.6 Line-I + 47.0 Line-II) / 243.6 MLD planned post-Tranche 2; 28 existing OHTs (12 N + 16 S, 410.5 LL aggregate) plus 37 new under Tranche 2; 28 distribution zones / 81 District Metering Areas (42 today + 39 in Tranche 3 scope; 115 newly-established post-build); 764 km existing mains + 813 km new under Tranche 3; 95,487 connections (94,487 dom + 600 non-dom + 400 com), targeting 163,958 households; 2034 demand 317 MLD; PWD allocation table (MMC 51.09 cusecs continuous). Powers the dashboard's at-a-glance tile."
                frequency="static (per ADB tranche publication)"
              />
              <DataSource
                name="MMC water-supply page"
                url="https://maduraicorporation.co.in/aboutus/water-supply/"
                description="MMC's published 1,500 mcft/year drinking-water allocation from Vaigai with ~900 mcft recent draw. Infrastructure stats on the public page differ slightly from the engineering IEE values (page lists 23 OHTs, 96,048 connections, 467 km mains, 81 distribution zones) - we treat the IEE Parts 1-3 as the primary engineering record and document the disagreements in `madurai-supply-overview.json._secondary_local_source`."
                frequency="static"
              />
              <DataSource
                name="Reservoir forecast (AutoARIMA)"
                url={`/${config.cityId}`}
                description="14-day forecast with 80% confidence band per reservoir, refit daily as new readings land. Seasonal differencing kicks in once we have at least two years of history."
                frequency="daily refit"
              />
            </>
          
        </>
      );
    case "data-sources-3":
      return (
        <>
            <DataSource
              name="OSM Nominatim + Overpass - locality search points"
              url="https://overpass-api.de/"
              description="51 Madurai neighbourhood points (Anna Nagar, Pasumalai, Mattuthavani, KK Nagar, Sellur, Vandiyur, etc.) extracted from OpenStreetMap for the my-ward search box. 49/51 carry Tamil names. Powers locality-name -> ward resolution."
              frequency="periodic (one-off refresh today)"
            />
          
        </>
      );
    case "data-sources-4":
      return (
        <>
            <DataSource
              name="CGWB Ground Water Year Book of Tamil Nadu &amp; Puducherry"
              url="https://cgwb.gov.in/cgwbpnm/"
              description="Peer-reviewed quarterly depth-to-water-level readings (May / Aug / Nov / Jan) at 21 dug-well stations in Madurai district, sourced from the 2023-24 and 2024-25 Year Books. Replaces an IDW-interpolated ward depth choropleth - Madurai's live WRIS network is too sparse (4 stations) for honest per-ward synthesis. Stitched into a 2-year per-station time series."
              frequency="annual (per Year Book release)"
            />
          
        </>
      );
    case "data-sources-5":
      return (
        <>
            <>
              <DataSource
                name="Vencatesan (2014) - Madurai's lost urban tanks"
                url="https://www.atree.org/"
                description="14 fully lost and 12 severely reduced urban tanks - roughly 16.5 sq km of combined area, around 30% of the old city's footprint."
                frequency="static"
              />
              <DataSource
                name="Madurai flagship water-bodies (DHAN + heritage records)"
                url={`/${config.cityId}/lake-restoration`}
                description="19 hand-curated flagship tanks and dams with status, area, builder / era, and court-order anchors. Powers the restoration-priority composite."
                frequency="static"
              />
              <DataSource
                name="Restoration priority algorithm"
                url={`/${config.cityId}/lake-restoration`}
                description="Each flagship is scored on status severity (0-80) plus a cultural-heritage bonus (0-35) plus a size bucket (4-25), then scaled by a source-confidence multiplier between 0.7 and 1.0."
                frequency="on update"
              />
              <DataSource
                name="Restoration programmes &amp; court orders"
                url={`/${config.cityId}/lake-restoration`}
                description="Hand-curated rows for the Kudimaramathu, AMRUT, Smart City, and IAMWARM programmes plus the Madras HC anchors that have shaped restoration policy."
                frequency="manual"
              />
            </>
          
        </>
      );
    case "data-sources-6":
      return (
        <>
            <>
              <DataSource
                name="CPCB - National Water Monitoring Programme"
                url="https://cpcb.gov.in/nwmp-data-2/"
                description="Annual River Water Quality reports (2020-2024 covered today). Vaigai is monitored at two stations - upstream and downstream of Madurai - with min and max readings per parameter; we use the midpoint."
                frequency="annual"
              />
              <DataSource
                name="Madras HC Madurai Bench - Vaigai pollution PIL"
                url="https://www.dtnext.in/news/tamilnadu/madras-hc-directs-tamil-nadu-govt-to-file-report-on-causes-of-pollution-in-vaigai-river-815586"
                description="December 2024 suo motu order naming 177 sewage and industrial discharge points across 5 districts, sampled stretches graded unfit even for irrigation, and a state-government action plan due January 2025."
                frequency="incident-driven"
              />
              <DataSource
                name="Supreme Court - Mullaperiyar 2014 verdict"
                url="https://en.wikipedia.org/wiki/Mullaperiyar_Dam"
                description="May 2014 Constitution Bench permitted 142 ft Mullaperiyar storage and struck down Kerala's 2006 cap. Established a permanent Supervisory Committee that still arbitrates seasonal storage and dam-safety reviews."
                frequency="incident-driven"
              />
              <DataSource
                name="Vaigai-basin industrial pollution sources"
                url={`/${config.cityId}/rivers`}
                description="Six hand-curated polluters: SIDCO Kappalur and K. Pudur estates, Sellur sewage discharge zone, Dindigul tannery cluster, Theni textile dyeing units, and the multi-district outfall inventory cited in the December 2024 HC order."
                frequency="manual"
              />
              <DataSource
                name="TNPCB - online effluent monitoring"
                url="https://ocmms.tn.gov.in/"
                description="The Tamil Nadu Pollution Control Board's real-time monitoring portal for red-category industries. Cross-check reference for the curated sources list."
                frequency="real-time"
              />
              <DataSource
                name="DHAN Foundation - Centre for Urban Water Resource (CURE)"
                url="https://www.dhan.org/"
                description="Field study finding 8 of 9 Vaigai sampling spots unfit for human use across physical, chemical, and biological parameters. Underpins the qualitative status notes in the rivers and lake-restoration narratives."
                frequency="periodic"
              />
            </>
          
        </>
      );
    case "data-sources-7":
      return (
        <>
            <>
              <DataSource
                name="JRC Global Surface Water (Monthly Recurrence)"
                url="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyRecurrence"
                description="Per-water-body wet/dry history from satellite. Pipeline ready; data layer pending for Madurai's 19 flagships."
                frequency="historical monthly"
              />
              <DataSource
                name="Copernicus Sentinel-2 (via Earth Engine)"
                url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED"
                description="NDWI thumbnails + change detection per flagship. Pending for Madurai."
                frequency="periodic"
              />
              <DataSource
                name="HydroBASINS / MERIT Hydro"
                url="https://www.hydrosheds.org/products/hydrobasins"
                description="Catchment polygons for Vaigai dam and its sub-basins, used to ground catchment-rainfall context. Pending wiring for Madurai."
                frequency="static"
              />
            </>
          
        </>
      );
    case "data-quality-2":
      return (
        <>
            <SubSection title={`Open data gaps in ${cityName}`}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Some layers we&apos;d like to surface aren&apos;t publicly released yet for {cityName}. We&apos;ve listed each one with the workaround currently in place; tracked as RTI follow-ups where applicable.
              </p>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public flood-hazard return-period layer</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Standard 5/10/25/50/100/200-year flood return-period polygons are not currently published for Madurai. The flood-risk page falls back to a narrative-only view anchored on the 6,000-cusec Vaigai dam-release threshold; 2018 floods peaked above 12,000.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public drainage / sewerage GeoJSONs</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Drainage line and sewerage main GeoJSONs aren&apos;t publicly released - tracked as RTI follow-ups to Madurai Municipal Corporation. The ward risk composite ships a 3-factor variant (water bodies, lost bodies, groundwater) until those layers land.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">CPCB monitors only 2 of the 6 candidate Vaigai stations</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    NWMP covers Vaigai U/S Madurai (10059) and D/S Madurai (10060). Vaigai dam, Andipatti, Manamadurai, and Ramanathapuram are seeded for future expansion but stay readings-empty.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">No per-ward depth choropleth (deliberate)</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Madurai district has only four India WRIS live groundwater stations - far too sparse to honestly interpolate a 100-ward choropleth. Instead we surface 21 CGWB Year Book point stations as the depth signal, alongside the 11-block CGWB exploitation classification. The IDW-interpolated view used in earlier drafts has been retired.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Lost-tank coordinates not populated</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The 26 Vencatesan / DHAN documented lost tanks have name + status but no lat/lng - geocoding historical tank names is research-heavy and most have no OSM presence (they&apos;re lost). Listed as a Tier 3 follow-up.
                  </p>
                </div>
              </div>
            </SubSection>
          
        </>
      );
    case "data-quality-3":
      return (
        <>
            <SubSection title="Documented lost urban tanks (Vencatesan + DHAN)">
              <div className="overflow-x-auto hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {MADURAI_LOST_BODIES.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === "Fully lost"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500 dark:text-slate-400 text-xs">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden space-y-2">
                {MADURAI_LOST_BODIES.map((row) => (
                  <div key={row.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
                      <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.status === "Fully lost"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                      }`}>
                        {row.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
                  </div>
                ))}
              </div>
            </SubSection>
          
        </>
      );
    case "source-imd-rainfall":
      return (
        <>
          <DataSource
            name="IMD Gridded Rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/"
            description="India Meteorological Department 0.25-degree gridded rainfall, 1970-2025. Madurai grid cell at 9.9 deg N, 78.0 deg E, 862.6 mm long-term mean. Same imdlib pipeline as Chennai's IMD generator."
            frequency="monthly archive"
          />
        </>
      );
    case "source-wris-gwr":
      return (
        <>
          <DataSource
            name="India WRIS / CGWB - block-level Dynamic GWR"
            url="https://indiawris.gov.in/"
            description="Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). 11 blocks classified across Madurai district (Madurai East/North/South/West, Melur, Peraiyur, Thirupparankundram, Tirumangalam, Usilampatti, Vadipatti, Kallikudi)."
            frequency="annual"
          />
        </>
      );
    case "flood-infrastructure":
      return (
        <>
            <DataSource
              name="Pending RTI to Madurai Corporation"
              url={`/${config.cityId}/flood-risk`}
              description="Hazard zone polygons (5, 10, 25, 50, 100, 200-year return periods), historical flood hotspots, drainage and sewerage networks - none of these are publicly published for Madurai today. Tracked as follow-up RTIs."
              frequency="data gap"
            />
          
        </>
      );
    case "satellite-header":
      return (
        <>
          <DataSourceGroupHeader title="Satellite & remote sensing (planned)" />
        </>
      );
    default:
      return <>{fallback}</>;
  }
}

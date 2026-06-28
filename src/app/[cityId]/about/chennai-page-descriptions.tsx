"use client";

/**
 * Chennai-specific "What each page shows" subsections.
 *
 * Mirrors the shape of madurai-page-descriptions.tsx /
 * bangalore-page-descriptions.tsx: a single exported component that the
 * shared CityAboutContent mounts inside the `#pages` Section. Carries the
 * rich per-page methodology Chennai shipped on its old flat fork, plus the
 * LOST_WATER_BODY_SOURCES table (which lives inside the water-bodies
 * subsection here, matching the fork). All subsection anchor ids are kept
 * stable (#page-dashboard, #page-groundwater, #page-water-bodies,
 * #page-rivers, #page-flood, #page-coastal, #page-my-ward, #page-facts).
 *
 * Copy is fully translation-keyed (t("about.*") + t("uplift.*")) just as
 * the fork was, so en / ta render identically to before.
 */

import { useLanguage } from "@/lib/i18n/context";

interface LostBodyEntry {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  source: string;
}

const LOST_WATER_BODY_SOURCES: LostBodyEntry[] = [
  { name: "Long Tank (Otteri Nullah)", status: "Fully lost", source: "Care Earth Trust / IIT Madras Water Bodies Study" },
  { name: "Nungambakkam Tank", status: "Fully lost", source: "Survey of India historical maps / CMDA" },
  { name: "Kodambakkam Lake", status: "Fully lost", source: "Care Earth Trust water body survey" },
  { name: "Virugambakkam Lake", status: "Severely reduced", source: "CMDA Master Plan / Care Earth Trust" },
  { name: "Pallikaranai Marsh", status: "Severely reduced", source: "Care Earth Trust / Ashoka Trust for Research in Ecology" },
  { name: "Perungudi Lake", status: "Fully lost", source: "Care Earth Trust / Greater Chennai Corporation records" },
  { name: "Madipakkam Lake", status: "Partially encroached", source: "Madras High Court / NGT records" },
  { name: "Sholinganallur Marshland", status: "Severely reduced", source: "Salim Ali Centre for Ornithology / Care Earth Trust" },
  { name: "Villivakkam Lake", status: "Partially encroached", source: "CMDA / Revenue records / Care Earth Trust" },
  { name: "Kolathur Lake", status: "Partially encroached", source: "Care Earth Trust water body inventory" },
  { name: "Tambaram Tank", status: "Severely reduced", source: "Survey of India maps / Tamil Nadu PWD records" },
  { name: "Manali Wetlands", status: "Severely reduced", source: "TNPCB / Tamil Nadu Pollution Control Board reports" },
  { name: "Ennore Creek Wetlands", status: "Severely reduced", source: "Coastal Management Society / National Green Tribunal (Chennai)" },
  { name: "Muttukadu Backwaters", status: "Partially encroached", source: "CMDA Coastal Regulation Zone / Care Earth Trust" },
  { name: "Chetpet Lake", status: "Severely reduced", source: "GCC / Care Earth Trust / Madras High Court order 2018" },
];

function SubSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
    >
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function ChennaiPageDescriptions({ cityId: _cityId, cityName: _cityName }: Props) {
  const { t } = useLanguage();

  return (
    <>
      {/* Dashboard & reservoirs (forecasting + GEE catchment) */}
      <SubSection id="page-dashboard" title={t("about.page_dashboard_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.forecast_intro")}
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">{t("about.technique")}</h4>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.technique_before_link")} <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">AutoARIMA</span> {t("about.technique_after_link")}{" "}
          <a href="https://nixtla.github.io/statsforecast/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">statsforecast</a>{" "}
          <span className="font-medium">{t("about.technique_exogenous_term")}</span> {t("about.technique_after_term")}
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
          <li>{t("about.tech_bullet_independent")}</li>
          <li>{t("about.tech_bullet_retrained")}</li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_exogenous_label")}</span> {t("about.tech_exogenous_desc")}
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_future_label")}</span> {t("about.tech_future_desc")}
          </li>
          <li>
            <span className="font-medium text-slate-700 dark:text-slate-300">{t("about.tech_fallback_label")}</span> {t("about.tech_fallback_desc")}
          </li>
          <li>{t("about.tech_bullet_clamped")}</li>
        </ul>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 mt-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.gee_catchment_title")}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("about.gee_catchment_desc")}
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-3">
            <li>{t("about.gee_catchment_step1")}</li>
            <li>{t("about.gee_catchment_step2")}</li>
            <li>{t("about.gee_catchment_step3")}</li>
            <li>{t("about.gee_catchment_step4")}</li>
          </ul>
        </div>
      </SubSection>

      {/* Groundwater page (choropleth + CGWB stations + ward risk) */}
      <SubSection id="page-groundwater" title={t("about.page_gw_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.gw_map_desc1")}
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.gw_map_desc2")}
        </p>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ward_risk_title")}</span>
              <span className="text-slate-600 dark:text-slate-400"> {t("about.ward_risk_desc")}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("about.gw_cgwb_stations_title")}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {t("about.gw_cgwb_stations_intro")}
            </p>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              {t("about.gw_cgwb_modes_title")}
            </h5>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
              <li>{t("about.gw_cgwb_modes_manual")}</li>
              <li>{t("about.gw_cgwb_modes_telem")}</li>
              <li>{t("about.gw_cgwb_modes_meta")}</li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              {t("about.gw_cgwb_quality_title")}
            </h5>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {t("about.gw_cgwb_quality_intro")}
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
              <li>
                <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">stuck</span>{" "}
                {t("about.gw_cgwb_quality_stuck")}
              </li>
              <li>
                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">stale</span>{" "}
                {t("about.gw_cgwb_quality_stale")}
              </li>
              <li>
                <span className="font-mono text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded">ok</span>{" "}
                {t("about.gw_cgwb_quality_ok")}
              </li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
              {t("about.gw_cgwb_quality_ui")}
            </p>
          </div>
        </div>
      </SubSection>

      {/* Water bodies & restoration (GEE NDWI + rich panel + lost WBs + restoration priority) */}
      <SubSection id="page-water-bodies" title={t("about.page_wb_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.wb_map_desc")}
        </p>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.gee_surface_title")}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("about.gee_surface_desc")}
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-3">
            <li>{t("about.gee_surface_step1")}</li>
            <li>{t("about.gee_surface_step2")}</li>
            <li>{t("about.gee_surface_step3")}</li>
            <li>{t("about.gee_surface_step4")}</li>
          </ul>
        </div>

        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Rich-Data Deep-Zoom Panel (flagship bodies)</h4>
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-1">
              Seven Chennai water bodies have a dedicated full-screen panel layered on top of the standard <span className="font-mono text-xs">/water-bodies</span> map. Clicking a flagship body opens yearly satellite imagery 1984-present, cumulative water-loss and built-gain tints, per-year zonal stats, and a sources &amp; methodology modal.
            </p>
          </div>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
            <span className="font-semibold text-emerald-900 dark:text-emerald-100">Onboarded today (7):</span> Pallikaranai Marsh (TNSWA gazetted Ramsar Site #2481 boundary), Sholavaram Lake, Red Hills Reservoir (Puzhal), Chembarambakkam Lake, Porur Lake, Velachery Lake, Perumbakkam Lake. The last six use the OpenStreetMap relation as the primary boundary.
          </p>
          <ul className="list-disc list-inside text-sm text-emerald-800/80 dark:text-emerald-200/80 space-y-2">
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Yearly chips 1984-present</span> - Landsat 5 TM (1984-1998), Landsat 5+7 (1999-2012), Landsat 7+8 (2013-2018), Sentinel-2 SR Harmonized (2019-present). All chips are pre-loaded on panel open so the time-lapse plays without flicker.</li>
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Cumulative water-loss tint</span> over the body polygon, computed from JRC Global Surface Water v1.4 (baseline 1988-92 vs end 2017-21).</li>
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Cumulative built-gain tint</span> over the 1 km halo, computed from Google Dynamic World V1 (baseline 2016-18 vs end 2023-25).</li>
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Per-year stats</span> - water surface % in body (JRC 1984-2021, spliced with Dynamic World water class 2022-now so the chart runs continuous through {new Date().getFullYear()}), built fraction % in halo (Dynamic World 2016-now), buildings in halo, buildings in body (Overture Maps quarterly, Open Buildings v3 fallback).</li>
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Caveats stated in-panel</span> - the JRC v1.4 series ends at 2021, so post-2021 water-fraction readings come from Dynamic World (slight methodology step at the splice). The 1 km halo is editorial reference (not a legally codified buffer) for every body except Pallikaranai, where it aligns with the NGT 1 km eco-sensitive zone reference.</li>
            <li><span className="font-semibold text-emerald-900 dark:text-emerald-100">Pallikaranai-only set-algebra</span> - For Pallikaranai both a gazetted TNSWA boundary (1246.76 ha) and an OSM <span className="font-mono text-xs">natural=wetland</span> polygon (1073.06 ha) exist; the panel surfaces the 233.06 ha gap between the two.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">{t("about.gee_thresholds_title")}</h4>
          <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-2 mt-3">
            <li>{t("about.gee_thresholds_water")}</li>
            <li>{t("about.gee_thresholds_rain")}</li>
            <li>{t("about.gee_thresholds_confidence")}</li>
            <li>{t("about.gee_thresholds_scope")}</li>
          </ul>
        </div>

        {/* Restoration priority scoring */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration")}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("about.restoration_desc")}
          </p>
          <div className="space-y-2">
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_size")}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_lost")}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_river")}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_industrial")}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.restoration_comp_type")}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {t("about.restoration_note")}
          </p>
        </div>

        {/* Lost water bodies table */}
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">{t("about.wb_lost_heading")}</h4>
        {/* Desktop table */}
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                <th className="pb-2 font-medium">{t("about.wb_col_name")}</th>
                <th className="pb-2 font-medium">{t("about.wb_col_status")}</th>
                <th className="pb-2 font-medium">{t("about.wb_col_source_ref")}</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {LOST_WATER_BODY_SOURCES.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.status === "Fully lost"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : row.status === "Severely reduced"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}>
                      {row.status === "Fully lost"
                        ? t("about.fully_lost")
                        : row.status === "Severely reduced"
                        ? t("about.severely_reduced")
                        : t("about.partially_encroached")}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {LOST_WATER_BODY_SOURCES.map((row) => (
            <div key={row.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
                <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.status === "Fully lost"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : row.status === "Severely reduced"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                }`}>
                  {row.status === "Fully lost"
                    ? t("about.fully_lost")
                    : row.status === "Severely reduced"
                    ? t("about.severely_reduced")
                    : t("about.partially_encroached")}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Rivers */}
      <SubSection id="page-rivers" title={t("about.page_rivers_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.river_map_desc")}
        </p>
      </SubSection>

      {/* Flood */}
      <SubSection id="page-flood" title={t("about.page_flood_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.page_flood_desc")}
        </p>
      </SubSection>

      {/* Shoreline change */}
      <SubSection id="page-coastal" title="Shoreline change">
        <p className="text-slate-600 dark:text-slate-400">
          The <span className="font-mono text-xs">/shoreline</span> page maps shoreline erosion and
          accretion along the 86 km Chennai-Ennore-Pulicat coast. Its primary layer is{" "}
          <span className="font-semibold">Neer Vazhvu&apos;s own measurement</span>: an MNDWI water index
          computed from dry-season Landsat 5/7/8 and Sentinel-2 composites (ten epochs, 1990-2026 -
          extending the study&apos;s 2024 window with current Sentinel-2) in Google Earth Engine, sampled
          along 972 shore-normal 100 m transects, with a DSAS-equivalent weighted linear regression per
          transect plus a per-transect movement-over-time chart and an early-vs-recent acceleration check.
          The six study zones and named port hotspots from Anagha, Singh &amp; Frappart (2026,{" "}
          <span className="italic">Environmental Challenges</span>) are drawn as faint context over the
          same map - the study validates our measurement rather than sitting in a separate view. The two
          methods agree on pattern and direction (Zone V around the Ennore and Kattupalli ports is the
          most eroded, the Adyar/Cooum and Chennai Port stretches accrete); our absolute rates run lower
          than the paper&apos;s because we use a fixed MNDWI threshold without tidal correction, so we
          present it as independent corroboration rather than a replica. Every feature is tagged with its
          provenance (our measurement vs study-reported) in the data itself.
        </p>
      </SubSection>

      {/* Climate risk */}
      <SubSection id="page-climate-risk" title="Climate risk">
        <p className="text-slate-600 dark:text-slate-400">
          The <span className="font-mono text-xs">/climate-risk</span> page maps climate-induced risk to
          water systems across the six sub-basins of the Chennai basin - Adyar, Araniyar, Cooum,
          Gummidipoondi, Kosasthalaiyar and Kovalam. Risk is the product of{" "}
          <span className="font-semibold">hazard x exposure x vulnerability</span> (IPCC AR5 framing, 33
          indicators, Jenks classes), taken from the TNGCC + CEEW 2026 study{" "}
          <span className="italic">Towards Climate-resilient River Systems in Chennai</span> (CC BY-NC 4.0).
          A four-way toggle (overall risk / hazard / exposure / vulnerability) recolours the same six
          sub-basins; clicking one opens its risk classes, the top-five contributing indicators per
          component, and its projected unmet water demand. The home dashboard carries a companion
          water-balance tile (basin demand 2,479 to 2,728 MCM by 2050; unmet demand 546 to 654 MCM, which
          treated-water reuse and micro-irrigation can cut 52-93%).{" "}
          <span className="font-semibold">Cooum and Kosasthalaiyar carry the highest risk.</span> The CEEW
          study does not publish sub-basin boundaries, so we derive them as hydrological catchments from
          WWF/HydroSHEDS hybas_12 (grouped by drainage outlet following the TN-WRD / IAMWARM sub-basin
          scheme), clipped to the Tamil Nadu state boundary. Over the flat Pulicat coast the small Kovalam
          and Gummidipoondi sub-basins are approximate - the boundaries are tagged as such on the map.
        </p>
      </SubSection>

      {/* My Ward */}
      <SubSection id="page-my-ward" title={t("about.page_my_ward_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.page_my_ward_desc")}
        </p>

        {/* Report card methodology */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.report_card_title")}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("about.report_card_desc")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium">Weight</th>
                  <th className="pb-2 font-medium">Direction</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300 text-xs">
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.factor_drainage")}</td>
                  <td className="py-1.5 font-mono">25%</td>
                  <td className="py-1.5">Higher = better</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.factor_sewerage_infra")}</td>
                  <td className="py-1.5 font-mono">25%</td>
                  <td className="py-1.5">Higher = better</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.factor_flood_risk")}</td>
                  <td className="py-1.5 font-mono">25%</td>
                  <td className="py-1.5">Lower = better</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.factor_wb_health")}</td>
                  <td className="py-1.5 font-mono">15%</td>
                  <td className="py-1.5">Lower = better</td>
                </tr>
                <tr>
                  <td className="py-1.5">{t("uplift.factor_wb_density")}</td>
                  <td className="py-1.5 font-mono">10%</td>
                  <td className="py-1.5">Higher = better</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("about.report_card_grading")}
          </p>
        </div>

        {/* Uplift planner methodology */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t("about.uplift_title")}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("about.uplift_desc")}
          </p>

          <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            {t("about.uplift_how_title")}
          </h5>
          <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <li>{t("about.uplift_step1")}</li>
            <li>{t("about.uplift_step2")}</li>
            <li>{t("about.uplift_step3")}</li>
          </ol>

          <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide pt-1">
            {t("about.uplift_caps_title")}
          </h5>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("about.uplift_caps_desc")}
          </p>

          <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide pt-1">
            {t("about.uplift_costs_title")}
          </h5>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("about.uplift_costs_desc")}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                  <th className="pb-2 font-medium">Intervention</th>
                  <th className="pb-2 font-medium">Cost/unit</th>
                  <th className="pb-2 font-medium">Metric</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300 text-xs">
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.int_build_drain")}</td>
                  <td className="py-1.5 font-mono">1.5-3.0 Cr/km</td>
                  <td className="py-1.5">{t("uplift.factor_drainage")}</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.int_build_pumping_main")}</td>
                  <td className="py-1.5 font-mono">3.0-6.0 Cr/km</td>
                  <td className="py-1.5">{t("uplift.factor_sewerage_infra")}</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.int_flood_mitigation")}</td>
                  <td className="py-1.5 font-mono">5-15 Cr/zone</td>
                  <td className="py-1.5">{t("uplift.factor_flood_risk")}</td>
                </tr>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5">{t("uplift.int_restore_wb")}</td>
                  <td className="py-1.5 font-mono">2-8 Cr/body</td>
                  <td className="py-1.5">{t("uplift.factor_wb_health")}</td>
                </tr>
                <tr>
                  <td className="py-1.5">{t("uplift.int_revive_wb")}</td>
                  <td className="py-1.5 font-mono">10-25 Cr/body</td>
                  <td className="py-1.5">{t("uplift.factor_wb_density")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </SubSection>

      {/* Chennai Water Facts */}
      <SubSection id="page-facts" title={t("about.page_facts_title")}>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.page_facts_desc")}
        </p>
      </SubSection>
    </>
  );
}

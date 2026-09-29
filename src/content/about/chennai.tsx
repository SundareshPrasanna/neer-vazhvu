"use client";

import { useLanguage } from "@/lib/i18n/context";
import { getPlaceConfig } from "@/lib/cities";
import { SubSection, DataSourceGroupHeader, DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { ChennaiPageDescriptions } from "./chennai-pages";

/** Chennai's About-page content: the slots of the shared About frame that
 *  are specific to Chennai. A slot not listed renders the frame's default. */

export default function ChennaiAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const { t } = useLanguage();
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "reading-1":
      return (
        <>
            <SubSection title={t("about.assumptions")}>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">{t("about.param")}</th>
                      <th className="pb-2 font-medium">{t("about.default")}</th>
                      <th className="pb-2 font-medium">{t("about.source_col")}</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_consumption")}</td>
                      <td className="py-2 font-mono">830 MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.src_cmwssb_report")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_desalination")}</td>
                      <td className="py-2 font-mono">190 MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.row_desalination_source")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_groundwater")}</td>
                      <td className="py-2 font-mono">{t("about.not_modeled")}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.src_conservative")}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">{t("about.row_evaporation")}</td>
                      <td className="py-2 font-mono">{t("about.not_modeled")}</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">{t("about.planned_v2")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {[
                  { param: t("about.row_consumption"), value: "830 MLD", source: t("about.src_cmwssb_report") },
                  { param: t("about.row_desalination"), value: "190 MLD", source: t("about.row_desalination_source") },
                  { param: t("about.row_groundwater"), value: t("about.not_modeled"), source: t("about.src_conservative") },
                  { param: t("about.row_evaporation"), value: t("about.not_modeled"), source: t("about.planned_v2") },
                ].map((row) => (
                  <div key={row.param} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{row.param}</div>
                    <div className="font-mono text-slate-700 dark:text-slate-300 mt-1">{row.value}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{row.source}</div>
                  </div>
                ))}
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
            <ChennaiPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-1":
      return (
        <>
            <div className="space-y-3">
              <DataSourceGroupHeader title={t("about.ds_group_reservoir")} />
              <DataSource
                name="CMWSSB Lake Level Page"
                url="https://cmwssb.tn.gov.in/lake-level"
                description={t("about.ds_cmwssb_desc")}
                frequency={t("about.freq_daily_scraped")}
              />
              <DataSource
                name="Open-Meteo"
                url="https://open-meteo.com/"
                description={t("about.ds_open_meteo_desc")}
                frequency={t("about.freq_daily")}
              />
              <DataSource
                name="NASA POWER (fallback)"
                url="https://power.larc.nasa.gov/"
                description={t("about.ds_nasa_desc")}
                frequency={t("about.freq_daily_lag")}
              />
              <DataSource
                name="OpenCity Chennai (Lake Storage)"
                url="https://data.opencity.in/"
                description={t("about.ds_opencity_lake_desc")}
                frequency={t("about.freq_historical")}
              />
              <DataSource
                name="IMD Gridded Rainfall (via imdlib)"
                url="https://imdlib.readthedocs.io/"
                description={t("about.ds_imd_desc")}
                frequency={t("about.freq_one_time_gen")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_gw")} />
              <DataSource
                name="India WRIS Ground Water Level API (CGWB Stations)"
                url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
                description={t("about.ds_wris_stations_desc")}
                frequency={t("about.freq_daily")}
              />
              <DataSource
                name="India WRIS / CGWB (Block Exploitation)"
                url="https://indiawris.gov.in/"
                description={t("about.ds_cgwb_desc")}
                frequency={t("about.freq_static_fetch")}
              />
              <DataSource
                name="OpenCity Chennai (Groundwater)"
                url="https://data.opencity.in/"
                description={t("about.ds_opencity_gw_desc")}
                frequency={t("about.freq_monthly")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_wb")} />
              <DataSource
                name="First Census of Water Bodies (data.gov.in)"
                url="https://data.gov.in/resource/state-wise-data-first-census-water-bodies-tamil-nadu"
                description={t("about.ds_census_wb_desc")}
                frequency={t("about.freq_one_time")}
              />
              <DataSource
                name="Kaggle Chennai Water Management"
                url="https://www.kaggle.com/datasets/sudalairajkumar/chennai-water-management"
                description={t("about.ds_kaggle_desc")}
                frequency={t("about.freq_one_time")}
              />
              <DataSource
                name="Care Earth Trust / NGT / CMDA: Lost Water Bodies"
                url="https://careearthtrust.org/"
                description={t("about.ds_careearth_desc")}
                frequency={t("about.freq_manual")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_rivers")} />
              <DataSource
                name="Chennai Rivers Restoration Trust (CRRT)"
                url="https://www.crrt.tn.gov.in/"
                description={t("about.ds_crrt_desc")}
                frequency={t("about.freq_manual")}
              />
              <DataSource
                name="CPCB National Water Monitoring Programme (NWMP)"
                url="https://cpcb.gov.in/nwmp-data-2024/"
                description={t("about.ds_cpcb_desc")}
                frequency={t("about.freq_annual")}
              />
              <DataSource
                name="Nethaji Mariappan et al. (2017): Cooum Sewage Inlets"
                url="https://neptjournal.com/upload-images/NL-61-47-(45)B-3437.pdf"
                description={t("about.ds_sewage_inlets_desc")}
                frequency={t("about.freq_one_time")}
              />
              <DataSource
                name="NGT Southern Bench / TNPCB / CPCB: Industrial Pollution Sources"
                url="https://www.tnpcb.gov.in/"
                description={t("about.ds_ngt_desc")}
                frequency={t("about.freq_manual")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_flood")} />
              <DataSource
                name="OpenCity Chennai (Flood Hazard Data)"
                url="https://data.opencity.in/"
                description={t("about.ds_flood_desc")}
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="GCC Storm Water Drain Survey"
                url="https://data.opencity.in/dataset/chennai-stormwater-drain-swd-maps"
                description={t("about.ds_swd_desc")}
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="CMWSSB Sewerage Network"
                url="https://data.opencity.in/dataset/chennai-sewerage-collection-system"
                description={t("about.ds_sewerage_desc")}
                frequency={t("about.freq_static")}
              />

              <DataSourceGroupHeader title="Coast &amp; shoreline" />
              <DataSource
                name="Anagha, Singh & Frappart (2026), Environmental Challenges"
                url="https://www.sciencedirect.com/science/article/pii/S2667010026001083"
                description="Peer-reviewed shoreline-change + seawater-intrusion study of the Chennai coast (1990-2024). Source of the per-zone rates and named port hotspots that validate the /shoreline map, and of the coastal facts."
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="Landsat 5/7/8 (via Earth Engine)"
                url="https://developers.google.com/earth-engine/datasets/catalog/landsat"
                description="USGS Landsat surface reflectance, with Sentinel-2, drives our own MNDWI shoreline transects on the /shoreline map (ten epochs, 1990-2026)."
                frequency={t("about.freq_static")}
              />

              <DataSourceGroupHeader title="Climate risk" />
              <DataSource
                name="TNGCC &amp; CEEW (2026), Towards Climate-resilient River Systems in Chennai"
                url="https://www.ceew.in/"
                description="The sub-basin climate-risk index (hazard x exposure x vulnerability, 33 indicators) and the WEAP water-balance projections behind the /climate-risk map and the dashboard water-balance tile. CC BY-NC 4.0."
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="WWF/HydroSHEDS HydroBASINS (level 12, via Earth Engine)"
                url="https://www.hydrosheds.org/products/hydrobasins"
                description="Drainage units grouped by coastal outlet (following the TN-WRD / IAMWARM sub-basin scheme) to derive the six sub-basin catchment boundaries, since the CEEW study publishes none."
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="IAMWARM Sub-Basin DPRs (TN Water Resources Dept)"
                url="https://iamwarm.gov.in/"
                description="The official Tamil Nadu sub-basin scheme (by taluk + area) used to name and validate the catchments - e.g. the Araniyar DPR (763 km2 in TN; Ponneri/Gummidipoondi/Uthukottai taluks)."
                frequency={t("about.freq_static")}
              />
              <DataSource
                name="geoBoundaries (Tamil Nadu state boundary)"
                url="https://www.geoboundaries.org/"
                description="Open ADM1 boundary used to clip the derived catchments to Tamil Nadu so they don't spill into Andhra Pradesh across the shared Pulicat catchment."
                frequency={t("about.freq_static")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_satellite")} />
              <DataSource
                name="NDWI Water Detection (via Sentinel-2)"
                url="https://en.wikipedia.org/wiki/Normalized_difference_water_index"
                description={t("about.ds_ndwi_desc")}
                frequency={t("about.freq_periodic_summary")}
              />
              <DataSource
                name="JRC Global Surface Water (Monthly Recurrence)"
                url="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyRecurrence"
                description={t("about.ds_gee_jrc_desc")}
                frequency={t("about.freq_historical_monthly")}
              />
              <DataSource
                name="CHIRPS Daily Rainfall"
                url="https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY"
                description={t("about.ds_gee_chirps_desc")}
                frequency={t("about.freq_daily")}
              />
              <DataSource
                name="Copernicus Sentinel-2 (via Earth Engine)"
                url="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED"
                description={t("about.ds_sentinel2_desc")}
                frequency={t("about.freq_evidence_refresh")}
              />
              <DataSource
                name="HydroBASINS / MERIT Hydro"
                url="https://www.hydrosheds.org/products/hydrobasins"
                description={t("about.ds_gee_catchments_desc")}
                frequency={t("about.freq_static_fetch")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_base")} />
              <DataSource
                name="OpenStreetMap (Overpass API)"
                url="https://overpass-api.de/"
                description={t("about.ds_osm_desc")}
                frequency={t("about.freq_static")}
              />

              <DataSourceGroupHeader title={t("about.ds_group_ai")} />
              <DataSource
                name="Anthropic Claude API"
                url="https://docs.anthropic.com/"
                description={t("about.ds_anthropic_desc")}
                frequency={t("about.freq_daily_monthly")}
              />
            </div>
          
        </>
      );
    case "data-quality-1":
      return (
        <>
                <> Cooum, Adyar, and Buckingham Canal hold their labels under both signals (data and PRS Priority I agree); rivers where the two disagree (Vaigai&apos;s PRS Priority III vs Class C/D NWMP readings) reflect what the data shows now.</>
              
        </>
      );
    case "data-quality-2":
      return (
        <>
            <SubSection title={t("about.data_quality")}>
              <p className="text-slate-600 dark:text-slate-400">
                {t("about.dq_intro")}
              </p>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    {t("about.dq_census_units_title")}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t("about.dq_census_units_desc")}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    {t("about.dq_census_capacity_title")}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t("about.dq_census_capacity_desc")}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    {t("about.dq_census_shape_title")}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t("about.dq_census_shape_desc")}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    {t("about.dq_satellite_baseline_title")}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t("about.dq_satellite_baseline_desc")}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                    {t("about.dq_catchment_geometry_title")}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t("about.dq_catchment_geometry_desc")}
                  </p>
                </div>
              </div>
            </SubSection>
          
        </>
      );
    case "intelligence":
      return (
        <>
            <>
              <p className="text-slate-600 dark:text-slate-400">
                {t("about.intelligence_intro")}
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.daily_briefing_title")}</span>
                    <span className="text-slate-600 dark:text-slate-400"> {t("about.daily_briefing_desc")}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ai_narrative_title")}</span>
                    <span className="text-slate-600 dark:text-slate-400"> {t("about.ai_narrative_desc")}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ward_profile_title")}</span>
                    <span className="text-slate-600 dark:text-slate-400"> {t("about.ward_profile_desc")}</span>
                  </div>
                </div>
              </div>
            </>
          
        </>
      );
    case "river-status-consequence":
      return null;
    default:
      return <>{fallback}</>;
  }
}

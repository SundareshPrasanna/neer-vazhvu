"use client";

import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/i18n/context";

const LOST_WATER_BODY_SOURCES: {
  name: string;
  status: "Fully lost" | "Severely reduced" | "Partially encroached";
  source: string;
}[] = [
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

function DataSource({
  name,
  url,
  description,
  frequency,
}: {
  name: string;
  url: string;
  description: string;
  frequency: string;
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {name}
        </a>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{frequency}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

export function AboutContent() {
  const { t } = useLanguage();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t("about.title")}</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
        {t("about.intro")}
      </p>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.days_heading")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.days_intro")}
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.pessimistic")}</span>
              <span className="text-slate-600 dark:text-slate-400"> {t("about.pessimistic_desc")}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.current_trend")}</span>
              <span className="text-slate-600 dark:text-slate-400"> {t("about.current_desc")}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.seasonal")}</span>
              <span className="text-slate-600 dark:text-slate-400"> {t("about.seasonal_desc")}</span>
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.assumptions")}</h2>
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
      </section>

      <Separator className="my-8" />

      <section id="data-sources" className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.data_sources")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.data_pipeline")}
          {" "}{t("about.data_pipeline2")}
        </p>
        <div className="space-y-3">
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
            name="OpenCity Chennai (Groundwater)"
            url="https://data.opencity.in/"
            description={t("about.ds_opencity_gw_desc")}
            frequency={t("about.freq_monthly")}
          />
          <DataSource
            name="OpenCity Chennai (Lake Storage)"
            url="https://data.opencity.in/"
            description={t("about.ds_opencity_lake_desc")}
            frequency={t("about.freq_historical")}
          />
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
            name="OpenStreetMap (Overpass API)"
            url="https://overpass-api.de/"
            description={t("about.ds_osm_desc")}
            frequency={t("about.freq_static")}
          />
          <DataSource
            name="Care Earth Trust / NGT / CMDA: Lost Water Bodies"
            url="https://www.careearth.org/"
            description={t("about.ds_careearth_desc")}
            frequency={t("about.freq_manual")}
          />
          <DataSource
            name="CPCB: Status of Water Quality in India"
            url="https://cpcb.nic.in/nwmp-data/"
            description={t("about.ds_cpcb_desc")}
            frequency={t("about.freq_annual")}
          />
          <DataSource
            name="NGT Southern Bench / TNPCB / CPCB: Industrial Pollution Sources"
            url="https://www.tnpcb.gov.in/"
            description={t("about.ds_ngt_desc")}
            frequency={t("about.freq_manual")}
          />
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
          <DataSource
            name="Anthropic Claude API"
            url="https://docs.anthropic.com/"
            description={t("about.ds_anthropic_desc")}
            frequency={t("about.freq_daily_monthly")}
          />
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.intelligence")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.intelligence_intro")}
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.ward_risk_title")}</span>
              <span className="text-slate-600 dark:text-slate-400"> {t("about.ward_risk_desc")}</span>
            </div>
          </div>
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
      </section>

      <Separator className="my-8" />

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.forecasting")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.forecast_intro")}
        </p>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{t("about.technique")}</h3>
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
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.gw_map")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.gw_map_desc1")}
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.gw_map_desc2")}
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.wb_map")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.wb_map_desc")}
        </p>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{t("about.wb_lost_heading")}</h3>
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
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.river_map")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.river_map_desc")}
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.restoration")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.restoration_desc")}
        </p>
        <div className="space-y-3">
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
        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
          {t("about.restoration_note")}
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.disclaimer")}</h2>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_gov_title")}</span>{" "}
            {t("about.disclaimer_gov_desc")}
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_info_title")}</span>{" "}
            {t("about.disclaimer_info_desc")}
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{t("about.disclaimer_privacy_title")}</span>{" "}
            {t("about.disclaimer_privacy_desc")}
          </p>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.limitations")}</h2>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
          <li>{t("about.limit1")}</li>
          <li>{t("about.limit2")}</li>
          <li>{t("about.limit3")}</li>
          <li>{t("about.limit4")}</li>
          <li>{t("about.limit5")}</li>
        </ul>
      </section>

      <Separator className="my-8" />

      <section id="data-quality" className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.data_quality")}</h2>
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
        </div>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t("about.open_source")}</h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t("about.open_source_desc")}
        </p>
        <a
          href="https://github.com/SundareshPrasanna/neer-vazhvu"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          {t("about.view_github")}
        </a>
      </section>
    </div>
  );
}

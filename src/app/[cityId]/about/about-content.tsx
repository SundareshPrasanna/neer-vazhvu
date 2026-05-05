"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/context";
import type { PlaceConfig } from "@/lib/cities";

// Per-city data-source registry. Renders the "Data sources for <City>" block.
// Shared sources (Open-Meteo, Anthropic, OSM, India WRIS, IMD) are listed for
// every place that uses them; place-specific sources (CMWSSB for Chennai,
// TN Agri ARS for Madurai/Kaveri) only appear under the city that uses them.
interface DataSourceItem {
  name: string;
  url: string;
  description: string;
  frequency: string;
}

const SHARED_GROUNDWATER: DataSourceItem[] = [
  {
    name: "India WRIS Ground Water Level API (CGWB stations)",
    url: "https://indiawris.gov.in/Dataset/Ground%20Water%20Level",
    description: "Daily/seasonal manual + DWLR groundwater readings from CGWB's National Hydrograph Network.",
    frequency: "daily / seasonal",
  },
  {
    name: "India WRIS / CGWB Dynamic GWR (block exploitation)",
    url: "https://indiawris.gov.in/",
    description: "Annual block-level Dynamic Groundwater Resource Assessment classification (Safe / Semi Critical / Critical / Over Exploited).",
    frequency: "annual",
  },
];

const SHARED_WEATHER: DataSourceItem[] = [
  {
    name: "Open-Meteo",
    url: "https://open-meteo.com/",
    description: "Free, no-auth daily weather data: precipitation, temperature, humidity, ET0, wind. ECMWF/ERA5-Land base.",
    frequency: "daily",
  },
  {
    name: "IMD Gridded Rainfall (via imdlib)",
    url: "https://imdlib.readthedocs.io/",
    description: "India Meteorological Department 0.25-degree gridded rainfall, 1970-present.",
    frequency: "monthly archive",
  },
];

const SHARED_AI: DataSourceItem[] = [
  {
    name: "Anthropic Claude API",
    url: "https://docs.anthropic.com/",
    description: "AI city narratives and ward profiles; daily and monthly cadence.",
    frequency: "daily / monthly",
  },
];

const SHARED_OSM: DataSourceItem[] = [
  {
    name: "OpenStreetMap (Overpass API)",
    url: "https://overpass-api.de/",
    description: "Base geometry: water bodies, rivers, drainage, industrial zones, locality gazetteer.",
    frequency: "static",
  },
];

const PER_CITY_RESERVOIR: Record<string, DataSourceItem[]> = {
  chennai: [
    {
      name: "CMWSSB Lake Level Page",
      url: "https://cmwssb.tn.gov.in/lake-level",
      description: "Daily storage, level, inflow/outflow for Poondi, Cholavaram, Red Hills, Chembarambakkam, Veeranam, Kannankottai.",
      frequency: "daily (scraped)",
    },
  ],
  madurai: [
    {
      name: "TN Agriculture ARS (tnagriculture.in)",
      url: "https://tnagriculture.in/ARS/home/reservoir",
      description: "Daily storage, level, inflow/outflow for Vaigai and Mullaperiyar (listed as Periyar) on a single state-wide page.",
      frequency: "daily (scraped)",
    },
  ],
};

const PER_CITY_RIVER_QUALITY: Record<string, DataSourceItem[]> = {
  chennai: [
    {
      name: "CPCB National Water Monitoring Programme (NWMP)",
      url: "https://cpcb.nic.in/nwmp-data-2024/",
      description: "Annual river-quality samples (BOD, DO, pH, fecal coliform) for Cooum, Adyar, Kosasthalaiyar.",
      frequency: "annual",
    },
  ],
  madurai: [
    {
      name: "CPCB National Water Monitoring Programme (NWMP)",
      url: "https://cpcb.nic.in/nwmp-data-2024/",
      description: "Annual river-quality samples for Vaigai (~6-8 stations along Vaigai dam-Madurai-Manamadurai-Ramanathapuram).",
      frequency: "annual",
    },
  ],
};

function Section({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 open:shadow-sm"
    >
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none select-none p-4 sm:p-5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 [&::-webkit-details-marker]:hidden">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <svg
          className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-5">{children}</div>
    </details>
  );
}

function DataSource({ name, url, description, frequency }: DataSourceItem) {
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

function DataSourceGroupHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 pt-2 pb-1">
      {title}
    </h3>
  );
}

export function CityAboutContent({ config }: { config: PlaceConfig }) {
  const { t } = useLanguage();

  const reservoirSources = PER_CITY_RESERVOIR[config.cityId] ?? [];
  const riverSources = PER_CITY_RIVER_QUALITY[config.cityId] ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        About {config.displayName} Water Intelligence
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
        {t("about.intro")}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 italic">
        {t("about.collapsed_hint")}
      </p>

      <div className="space-y-3">
        {/* What this dashboard tracks for this city - direct from the place registry */}
        <Section title={`What we track for ${config.displayName}`} defaultOpen>
          <p className="text-slate-600 dark:text-slate-400">
            {config.displayName} is governed by{" "}
            <span className="font-semibold">{config.primaryAuthority.name}</span>
            {config.placeKind === "city" && config.localGovernment && (
              <>
                {" "}with civic services under {config.localGovernment.name}
                {" "}({config.localGovernment.wardCount} wards)
              </>
            )}
            .
            {config.defaultConsumptionMld !== null && (
              <>
                {" "}Estimated daily city demand: ~{config.defaultConsumptionMld} MLD
                {config.defaultDesalinationMld !== null && config.defaultDesalinationMld > 0 && (
                  <> (of which ~{config.defaultDesalinationMld} MLD is desalinated)</>
                )}.
              </>
            )}
          </p>

          {config.waterSources.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Water sources tracked daily
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.waterSources.map((s) => (
                  <div
                    key={s.sourceCode}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {s.displayName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {s.type}
                      {s.fullCapacityMcft !== null && (
                        <> · {s.fullCapacityMcft.toLocaleString()} Mcft full capacity</>
                      )}
                      {s.fullTankLevelFt !== null && (
                        <> · FRL {s.fullTankLevelFt} ft</>
                      )}
                      {s.isPrimaryDrinkingSource && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          primary drinking
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Methodology - all shared with Chennai's about; reuses existing translations */}
        <Section title={t("about.group_reading")}>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {t("about.days_heading")}
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.days_intro")}
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t("about.pessimistic")}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}{t("about.pessimistic_desc")}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t("about.current_trend")}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}{t("about.current_desc")}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t("about.seasonal")}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}{t("about.seasonal_desc")}
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* Data sources - place-specific reservoir + river + shared blocks */}
        <Section title={t("about.data_sources")}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.data_pipeline")} {t("about.data_pipeline2")}
          </p>
          <div className="space-y-3">
            {reservoirSources.length > 0 && (
              <>
                <DataSourceGroupHeader title={t("about.ds_group_reservoir")} />
                {reservoirSources.map((s) => <DataSource key={s.url} {...s} />)}
                {SHARED_WEATHER.map((s) => <DataSource key={s.url} {...s} />)}
              </>
            )}

            <DataSourceGroupHeader title={t("about.ds_group_gw")} />
            {SHARED_GROUNDWATER.map((s) => <DataSource key={s.url} {...s} />)}

            {riverSources.length > 0 && (
              <>
                <DataSourceGroupHeader title={t("about.ds_group_rivers")} />
                {riverSources.map((s) => <DataSource key={s.url} {...s} />)}
              </>
            )}

            <DataSourceGroupHeader title={t("about.ds_group_base")} />
            {SHARED_OSM.map((s) => <DataSource key={s.url} {...s} />)}

            <DataSourceGroupHeader title={t("about.ds_group_ai")} />
            {SHARED_AI.map((s) => <DataSource key={s.url} {...s} />)}
          </div>
        </Section>

        {/* Limitations - shared */}
        <Section title={t("about.limitations")}>
          <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
            <li>{t("about.limit1")}</li>
            <li>{t("about.limit2")}</li>
            <li>{t("about.limit3")}</li>
            <li>{t("about.limit4")}</li>
            <li>{t("about.limit5")}</li>
            <li>{t("about.limit6")}</li>
            <li>{t("about.limit7")}</li>
            <li>{t("about.limit8")}</li>
          </ul>
        </Section>

        {/* Disclaimer + open source + support - all shared */}
        <Section title={t("about.group_project")}>
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {t("about.disclaimer_gov_title")}
              </span>{" "}
              {t("about.disclaimer_gov_desc")}
            </p>
            <p>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {t("about.disclaimer_info_title")}
              </span>{" "}
              {t("about.disclaimer_info_desc")}
            </p>
            <p>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {t("about.disclaimer_privacy_title")}
              </span>{" "}
              {t("about.disclaimer_privacy_desc")}
            </p>
          </div>

          <div className="pt-3 space-y-3">
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
          </div>
        </Section>
      </div>
    </div>
  );
}

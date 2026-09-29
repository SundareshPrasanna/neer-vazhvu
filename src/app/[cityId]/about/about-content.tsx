"use client";

import { useLanguage } from "@/lib/i18n/context";
import type { PlaceConfig } from "@/lib/cities";
import { CatchmentMethodologySection } from "@/components/cascade/catchment-methodology-section";
import { CityAbout } from "@/components/about/city-about";
import { Section, SubSection, DataSourceGroupHeader, DataSource } from "@/components/about/primitives";

/**
 * City-aware About page. Mirrors the section structure of Chennai's
 * src/app/about/about-content.tsx but with per-place content where the
 * underlying data layers differ (e.g. TN Agri ARS vs CMWSSB, Vaigai NWMP
 * vs Cooum/Adyar, Madurai 3-factor ward composite vs Chennai 5-factor).
 *
 * Translation-keyed strings (t("about.X")) are reused verbatim from
 * Chennai when the content is city-agnostic. Madurai-specific literal
 * English copy is written directly to keep the translations file lean.
 */

/* ── helpers ────────────────────────────────────────────────────── */

/* ── main content ───────────────────────────────────────────────── */

export function CityAboutContent({ config }: { config: PlaceConfig }) {
  const { t } = useLanguage();
  const cityName = config.displayName;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        {t("about.h1_prefix")} {cityName} {t("about.h1_suffix")}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
        {t("about.intro")}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 italic">
        {t("about.collapsed_hint")}
      </p>

      <div className="space-y-3">

        {/* ─────────────────────────────────────────────────────────
            1. What we track for this city + Reading the dashboard
            ───────────────────────────────────────────────────────── */}
        <Section title={`${t("about.section_what_we_track")} ${cityName}`} defaultOpen>
          <p className="text-slate-600 dark:text-slate-400">
            {cityName} is governed by{" "}
            <span className="font-semibold">{config.primaryAuthority.name}</span>
            {config.localGovernment && (
              <> with civic services under {config.localGovernment.name}{" "}
                ({config.localGovernment.wardCount} wards)</>
            )}.
            {config.defaultConsumptionMld !== null && (
              <> Estimated daily city demand: ~{config.defaultConsumptionMld} MLD
              {config.defaultDesalinationMld !== null && config.defaultDesalinationMld > 0 && (
                <> (of which ~{config.defaultDesalinationMld} MLD is desalinated)</>
              )}.</>
            )}
          </p>

          {config.waterSources.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                {t("about.water_sources_daily")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.waterSources.map((s) => (
                  <div key={s.sourceCode} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{s.displayName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {s.type}
                      {s.fullCapacityMcft !== null && (<> - {s.fullCapacityMcft.toLocaleString()} Mcft full capacity</>)}
                      {s.fullTankLevelFt !== null && (<> - FRL {s.fullTankLevelFt} ft</>)}
                      {s.isPrimaryDrinkingSource && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{t("about.primary_drinking")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title={t("about.group_reading")}>
          <SubSection title={t("about.days_heading")}>
            <p className="text-slate-600 dark:text-slate-400">{t("about.days_intro")}</p>
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
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{t("hero.current_trend")}</span>
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
          </SubSection>

          <CityAbout slot="reading-1" cityId={config.cityId} />
        </Section>

        {/* ─────────────────────────────────────────────────────────
            2. What each page shows
            ───────────────────────────────────────────────────────── */}
        <Section id="pages" title={`${t("about.section_what_each_page")} ${cityName}`}>
          <CityAbout slot="pages-1" cityId={config.cityId} />

        </Section>

        {/* ─────────────────────────────────────────────────────────
            3. Intelligence & AI narratives
            ───────────────────────────────────────────────────────── */}
        <Section id="intelligence" title={t("about.section_intelligence")}>
          <CityAbout
            slot="intelligence"
            cityId={config.cityId}
            fallback={

            <>
              <p className="text-slate-600 dark:text-slate-400">
                Daily AI briefings, longer-form weekly narratives, and per-ward AI profiles are pending for {cityName} - the underlying summary stores aren&apos;t yet multi-city. Until those land, the page surfaces raw data without an AI commentary layer.
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Daily briefing</span>
                    <span className="text-slate-600 dark:text-slate-400"> Template-based briefing (no LLM) summarising current storage, 7-day delta, days-of-water-left, and high-risk ward count. Pending for {cityName}.</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">CityStory narrative</span>
                    <span className="text-slate-600 dark:text-slate-400"> Anthropic Claude API generates a longer-form weekly narrative grounded in the latest data. Pending for {cityName}.</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Per-ward AI profile</span>
                    <span className="text-slate-600 dark:text-slate-400"> Monthly Claude-generated micro-narrative per ward. Pending for {cityName}.</span>
                  </div>
                </div>
              </div>
            </>
            }
          />
        </Section>

        {/* ─────────────────────────────────────────────────────────
            Lake Catchment Atlas methodology - the "Catchments" view on
            /water-bodies. Anchor id is referenced from the atlas side
            panel's "How this is built -->" link.
            ───────────────────────────────────────────────────────── */}
        {config.hasCascadeOverlay && (
          <Section
            id="catchment-methodology"
            title={`Lake catchment atlas methodology - ${cityName}`}
          >
            <CatchmentMethodologySection cityDisplayName={cityName} cityId={config.cityId} />
          </Section>
        )}

        {/* ─────────────────────────────────────────────────────────
            4. Data Source Index
            ───────────────────────────────────────────────────────── */}
        <Section id="data-sources" title={`${t("about.section_data_sources_for")} ${cityName}`}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.data_pipeline")} {t("about.data_pipeline2")}
          </p>

          <CityAbout
            slot="data-sources-1"
            cityId={config.cityId}
            fallback={

          <>
          <DataSourceGroupHeader title="Reservoir &amp; weather" />
          <CityAbout slot="data-sources-2" cityId={config.cityId} />
          <DataSource
            name="Open-Meteo"
            url="https://open-meteo.com/"
            description="Free, no-auth daily weather data: precipitation, temperature, humidity, ET0, wind. ECMWF / ERA5-Land base. For cities with the provisional-rainfall layer, its archive API also fills the months IMD's gridded series hasn't published yet - rendered as asterisked provisional months that IMD supersedes automatically."
            frequency="daily"
          />
          <CityAbout
            slot="source-imd-rainfall"
            cityId={config.cityId}
            fallback={
              <DataSource
            name="IMD Gridded Rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/"
            description="India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Used for monsoon-context overlays."
            frequency="monthly archive"
          />
            }
          />
          <CityAbout slot="data-sources-3" cityId={config.cityId} />

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="India WRIS - groundwater level (CGWB stations)"
            url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
            description="Daily and seasonal manual + telemetric (DWLR) groundwater readings from the Central Ground Water Board's National Hydrograph Network."
            frequency="daily / seasonal"
          />
          <CityAbout
            slot="source-wris-gwr"
            cityId={config.cityId}
            fallback={
              <DataSource
            name="India WRIS / CGWB - block-level Dynamic GWR"
            url="https://indiawris.gov.in/"
            description="Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited)."
            frequency="annual"
          />
            }
          />
          <CityAbout slot="data-sources-4" cityId={config.cityId} />

          <DataSourceGroupHeader title="Water bodies &amp; restoration" />
          <DataSource
            name="OpenStreetMap"
            url="https://www.openstreetmap.org/"
            description="Base geometry for water-body polygons and the rivers polyline."
            frequency="static (refetch as needed)"
          />
          <CityAbout slot="data-sources-5" cityId={config.cityId} />

          <DataSourceGroupHeader title="Rivers &amp; pollution" />
          <CityAbout slot="data-sources-6" cityId={config.cityId} />

          <DataSourceGroupHeader title="Flood &amp; civic infrastructure" />
          <CityAbout slot="flood-infrastructure" cityId={config.cityId} />

          <CityAbout
            slot="satellite-header"
            cityId={config.cityId}
            fallback={<DataSourceGroupHeader title="Satellite & remote sensing" />}
          />
          <CityAbout slot="data-sources-7" cityId={config.cityId} />

          <DataSourceGroupHeader title="Base geometry &amp; AI" />
          <CityAbout slot="data-sources-8" cityId={config.cityId} />
          <DataSource
            name="Anthropic Claude API"
            url="https://docs.anthropic.com/"
            description={`AI city narratives and per-ward profiles. Live for Chennai; pending for ${cityName}.`}
            frequency="daily / monthly"
          />
          </>
            }
          />
        </Section>

        {/* ─────────────────────────────────────────────────────────
            5. Data quality & limitations
            ───────────────────────────────────────────────────────── */}
        <Section id="data-quality" title={t("about.section_data_quality")}>
          <SubSection title="How we classify river health">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              CPCB publishes <span className="font-semibold">two parallel</span> river-water-quality classification systems, and they don&apos;t always agree. Knowing which one we use - and why - matters for reading our river status badges honestly.
            </p>
            <div className="space-y-3 mt-3">
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Designated Best-Use classes (A-E)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Computed from <span className="font-semibold">current</span> dissolved-oxygen, BOD and coliform thresholds at each NWMP station. Updates every reading. Class A = drinking with disinfection only; Class B = outdoor bathing; Class C = drinking with conventional treatment; Class D = fisheries/wildlife; Class E = irrigation only. <span className="font-semibold">Below E = practically dead.</span>
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Polluted River Stretch (PRS) Priority I-V</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  A <span className="font-semibold">historical, multi-year</span> stretch-level designation reflecting cumulative pollution. Slow to update; once a river stretch is on the Priority list it tends to stay there even if recent readings improve. Priority I = worst (BOD &gt; 30 mg/L sustained); Priority V = least bad of the polluted stretches.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
              <span className="font-semibold">Our status badges (&quot;dead&quot;, &quot;severely degraded&quot;, &quot;degraded&quot;, &quot;stressed&quot;, &quot;healthy&quot;) are computed from current readings via the Designated Best-Use thresholds</span> - not from the PRS Priority list. We take the worst classification across a river&apos;s monitored stations and surface that as the river-level status.
              <CityAbout slot="data-quality-1" cityId={config.cityId} />
            </p>
            <CityAbout
              slot="river-status-consequence"
              cityId={config.cityId}
              fallback={

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Practical consequence: a river on CPCB&apos;s PRS Priority list (e.g. the Madurai-Manamadurai stretch of the Vaigai is Priority III) won&apos;t automatically render as &quot;severely degraded&quot; here. If the underlying NWMP readings show only Class C/D conditions, the badge reflects that. The PRS designation belongs in the river description as historical context, not as the live status.
              </p>
              }
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
              Status thresholds follow CPCB&apos;s published Designated Best-Use criteria; readings are from CPCB NWMP annual River Water Quality reports.
            </p>
          </SubSection>

          <CityAbout slot="data-quality-2" cityId={config.cityId} />

          <SubSection title={t("about.limitations")}>
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
          </SubSection>

          <CityAbout slot="data-quality-3" cityId={config.cityId} />
        </Section>

        {/* ─────────────────────────────────────────────────────────
            6. About the project
            ───────────────────────────────────────────────────────── */}
        <Section id="about-project" title={t("about.group_project")}>
          <SubSection title={t("about.disclaimer")}>
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
          </SubSection>

          <SubSection title={t("about.open_source")}>
            <p className="text-slate-600 dark:text-slate-400">{t("about.open_source_desc")}</p>
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
          </SubSection>

          <SubSection title={t("about.support")}>
            <p className="text-slate-600 dark:text-slate-400">{t("about.support_desc")}</p>
            <a
              href="https://www.patreon.com/NeerVazhvu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF424D] text-white rounded-lg text-sm font-medium hover:bg-[#e03840] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.386 2c-3.49 0-6.322 2.832-6.322 6.322 0 3.49 2.832 6.322 6.322 6.322 3.49 0 6.322-2.832 6.322-6.322C21.708 4.832 18.876 2 15.386 2M2.292 22h3.449V2H2.292v20z" />
              </svg>
              {t("about.view_patreon")}
            </a>
          </SubSection>
        </Section>

      </div>
    </div>
  );
}

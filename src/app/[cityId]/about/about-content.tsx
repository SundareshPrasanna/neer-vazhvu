"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/context";
import type { PlaceConfig } from "@/lib/cities";
import type { CascadeStats } from "@/lib/cascade-stats";
import { resolveConvergenceExample } from "@/lib/cascade-stats";
import type { CascadeSensitivity } from "@/lib/cascade-sensitivity";
import { CascadeMethodologySection } from "@/components/cascade/cascade-methodology-section";

const MaduraiPageDescriptions = dynamic(() =>
  import("./madurai-page-descriptions").then((mod) => mod.MaduraiPageDescriptions),
);

const BangalorePageDescriptions = dynamic(() =>
  import("./bangalore-page-descriptions").then((mod) => mod.BangalorePageDescriptions),
);

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

interface DataSourceItem {
  name: string;
  url: string;
  description: string;
  frequency: string;
}

interface LostBodyEntry {
  name: string;
  status: "Fully lost" | "Severely reduced";
  source: string;
}

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

// Documented lost + severely-reduced Bengaluru kere, anchored on
// Harini Nagendra, Nature in the City: Bengaluru (OUP 2016) +
// Fathima Samana (2008) + IISc CES survey + Citizen Matters
// reporting. 5 fully-lost and 4 severely-reduced; conservative
// inventory of NAMED conversions. Greater Bengaluru had ~280
// kere in 19th-century gazetteers vs ~100 functional today,
// so the fully-lost set runs into the dozens at BBMP scale.
const BANGALORE_LOST_BODIES: LostBodyEntry[] = [
  { name: "Dharmambudhi tank",       status: "Fully lost",       source: "Nagendra (OUP 2016) - drained 1950s for Majestic bus station" },
  { name: "Sampangi tank",           status: "Fully lost",       source: "Nagendra (OUP 2016) - now Sri Kanteerava stadium complex" },
  { name: "Karanji Anjaneya tank",   status: "Fully lost",       source: "Nagendra (OUP 2016) - Bishop Cotton Boys School playing fields" },
  { name: "Akkithimmanahalli tank",  status: "Fully lost",       source: "Nagendra (OUP 2016) - hockey stadium uses the tank's name" },
  { name: "Domlur tank",             status: "Fully lost",       source: "Nagendra (OUP 2016) - BDA Domlur Layout + arterial road network" },
  { name: "Kempambudhi tank",        status: "Severely reduced", source: "INTACH Bengaluru + Nagendra (OUP 2016) - Kempegowda family-deity tank, sewage-receiving" },
  { name: "Halsoor (Ulsoor) Lake",   status: "Severely reduced", source: "Nagendra (OUP 2016) - 1811 Cantonment encroachment cut into original perimeter" },
  { name: "Sankey Tank",             status: "Severely reduced", source: "Nagendra (OUP 2016) - 1882 colonial decorative tank, foot-of-its-former extent" },
  { name: "Bellandur Lake",          status: "Severely reduced", source: "T.V. Ramachandra IISc CES + NGT Forward Foundation v Karnataka OA 222/2014" },
];

/* ── helpers ────────────────────────────────────────────────────── */

function Section({ id, title, children, defaultOpen = false }: { id?: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
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
        <svg className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 space-y-5">{children}</div>
    </details>
  );
}

function SubSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
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

function DataSource({ name, url, description, frequency }: DataSourceItem) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <a
          href={url}
          target={url.startsWith("/") ? undefined : "_blank"}
          rel={url.startsWith("/") ? undefined : "noopener noreferrer"}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {name}
        </a>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">{frequency}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </div>
  );
}

/* ── main content ───────────────────────────────────────────────── */

export function CityAboutContent({
  config,
  cascadeStats,
  cascadeSensitivity,
}: {
  config: PlaceConfig;
  cascadeStats: CascadeStats | null;
  cascadeSensitivity?: CascadeSensitivity | null;
}) {
  const { t } = useLanguage();
  const cityName = config.displayName;
  const isMadurai = config.cityId === "madurai";
  const isBangalore = config.cityId === "bangalore";

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
                      {s.fullCapacityMcft !== null && (<> · {s.fullCapacityMcft.toLocaleString()} Mcft full capacity</>)}
                      {s.fullTankLevelFt !== null && (<> · FRL {s.fullTankLevelFt} ft</>)}
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
          </SubSection>

          {isMadurai && (
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
          )}

          {isBangalore && (
            <SubSection title="How Bengaluru's tap is fed today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Bengaluru&apos;s drinking water travels a much longer path than Chennai&apos;s or Madurai&apos;s:
                <span className="font-semibold"> Cauvery river (Karnataka allocation 270 TMC of the CWDT 726-TMC pool) → 4 upstream Karnataka reservoirs (KRS 48.4 TMC + Hemavathi 35.7 + Kabini 19.5 + Harangi 8.5) → BWSSB pumps from T.K. Halli 95 km north + 500 m elevation lift → 5 WTPs at the headworks (Cauvery Stages I-V) → 8,746 km BWSSB distribution mains → 84 ground-level reservoirs / 84 distribution stations across 9 administrative zones → ~865,000 piped connections → tap.</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                Three structural facts worth knowing when reading the dashboard&apos;s headline:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                <li>
                  <span className="font-semibold">The 4 upstream dams aren&apos;t Bengaluru&apos;s tap supply.</span> They are irrigation-primary reservoirs owned by the Karnataka Water Resources Department; the city&apos;s drinking-water carve-out is the slice released into BWSSB&apos;s pumping line at T.K. Halli. We track them because they set the seasonal ceiling on what BWSSB can pump - similar to how Madurai tracks Mullaperiyar even though it&apos;s in Kerala.
                </li>
                <li>
                  <span className="font-semibold">~48% non-revenue water.</span> Per the JICA Phase 3 Final Report (Nov 2017), nearly half of what BWSSB pumps 95 km is lost between WTP and household meter (physical leakage + commercial losses + unmetered uses). Bringing NRW under 20% would free more water than the entire Stage V augmentation.
                </li>
                <li>
                  <span className="font-semibold">BWSSB serves ~5.8M of ~14M GBA residents.</span> The rest depend on private borewells (over-extracted - all 6 CGWB blocks Over-Exploited since 2011) and the ~5,000-tanker informal economy. The piped/non-piped split is the single biggest equity gap in Bengaluru&apos;s water story.
                </li>
              </ul>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                What the dashboard <span className="font-semibold">does</span> show: the Cauvery Pumping hero (1,310 MLD installed across Stages I-V, 95 km / 500 m lift, 48% NRW, ~5.8M served), live daily storage at the 4 upstream Karnataka dams (TN Agri / TNAU reservoir page, which lists them alongside the TN reservoirs because Cauvery is shared), 8 years of daily history per dam (2018-today), 14-day AutoARIMA forecasts per dam, and the Stage V under-delivery flag from The Ken (Feb 2026: ~400 MLD actual vs 775 MLD design).
              </p>
            </SubSection>
          )}

          {isMadurai && (
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
          )}

          {isBangalore && (
            <SubSection title="What's missing today">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Several daily-operations layers aren&apos;t part of Bengaluru&apos;s public dataset. Most are tracked inside BWSSB&apos;s SCADA / IoT systems for internal monitoring; they just aren&apos;t routed to a public surface. Listed here so users know where this dashboard&apos;s daily view ends, and which RTI / partnership unlocks would move it from structural numbers to a real measured runway.
              </p>
              <div className="space-y-3 mt-3">
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Daily T.K. Halli WTP raw + treated throughput per stage</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    The 5 Cauvery Stage I-V WTPs at T.K. Halli have SCADA-monitored daily raw-water intake and treated-water output. The JICA Phase 3 report flagged Stage V&apos;s designed 775 MLD; The Ken&apos;s Feb 2026 reporting put actual delivery at ~400 MLD - a daily series would close the gap between &quot;commissioned&quot; and &quot;delivering&quot;.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Per-zone supply across the 9 BWSSB administrative zones</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Zone-level supply telemetry isn&apos;t in the public dataset today. With it the dashboard could show which IISc-flagged stress wards (65 wards on the 2025 IISc Groundwater Outlook) are actually getting served vs which rely on tankers + over-extracted borewells.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">CWR-wise live storage (84 ground-level reservoirs)</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Aggregate CWR + WDSS count is documented in `bangalore-supply-overview.json` from JICA Phase 3; per-CWR live levels live in BWSSB&apos;s SCADA. Per-CWR readings would surface zone-level supply gaps in near real time.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Tanker calls served via Kaveriwheels app</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    BWSSB&apos;s Kaveriwheels app booking + delivery log would let us correlate stress-ward demand against IISc&apos;s 65-ward critical list. With ~19,000 downloads in a 14M city (2.8/5 rating), it&apos;s nowhere near the full ~5,000-tanker informal market scale OpenCity surveys - a public booking feed would expose that gap.
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">39 STP daily compliance + treated-effluent quality</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    KSPCB&apos;s OCEMS (Online Continuous Effluent Monitoring System) collects per-STP outlet readings continuously, but the public-facing dashboard is intermittent and partial. A daily public feed would link STP underperformance to the K&amp;C cascade foam events at Bellandur / Varthur.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">In flight: BWSSB Stage V monthly progress report</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    BWSSB publishes Stage V commissioning + Phase 3 progress reports irregularly. Parsing them to convert the headline static &quot;775 MLD design&quot; into a measured monthly delivery time series is the next planned data unlock here.
                  </p>
                </div>
              </div>
            </SubSection>
          )}

          {isMadurai && (
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
          )}
        </Section>

        {/* ─────────────────────────────────────────────────────────
            2. What each page shows
            ───────────────────────────────────────────────────────── */}
        <Section id="pages" title={`${t("about.section_what_each_page")} ${cityName}`}>
          {isMadurai && (
            <MaduraiPageDescriptions cityId={config.cityId} cityName={cityName} />
          )}

          {isBangalore && (
            <BangalorePageDescriptions cityId={config.cityId} cityName={cityName} />
          )}

          {!isMadurai && !isBangalore && (
            <p className="text-slate-600 dark:text-slate-400">
              Per-page methodology documentation for {cityName} is pending. See the dedicated Chennai about page (<Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">/about</Link>) for the canonical methodology pattern.
            </p>
          )}
        </Section>

        {/* ─────────────────────────────────────────────────────────
            3. Intelligence & AI narratives
            ───────────────────────────────────────────────────────── */}
        <Section id="intelligence" title={t("about.section_intelligence")}>
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
        </Section>

        {/* ─────────────────────────────────────────────────────────
            Cascade Reconstruction Methodology - shown only when the
            city has the overlay enabled. Anchor id is referenced from
            the on-map "Full methodology -->" link.
            ───────────────────────────────────────────────────────── */}
        {config.hasCascadeOverlay && cascadeStats && (
          <Section
            id="cascade-methodology"
            title={`Cascade reconstruction methodology - ${cityName}`}
          >
            <CascadeMethodologySection
              cityDisplayName={cityName}
              cityId={config.cityId}
              nodeCount={cascadeStats.node_count}
              edgeCount={cascadeStats.edge_count}
              riverOutletCount={cascadeStats.river_outlet_count}
              maxCascadeDepth={cascadeStats.max_cascade_depth}
              topConvergenceExample={
                resolveConvergenceExample(cascadeStats) ?? undefined
              }
              edgeConfidenceCounts={cascadeStats.edge_confidence_counts}
              sensitivity={cascadeSensitivity}
            />
          </Section>
        )}

        {/* ─────────────────────────────────────────────────────────
            4. Data Source Index
            ───────────────────────────────────────────────────────── */}
        <Section id="data-sources" title={`${t("about.section_data_sources_for")} ${cityName}`}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.data_pipeline")} {t("about.data_pipeline2")}
          </p>

          <DataSourceGroupHeader title="Reservoir &amp; weather" />
          {isMadurai && (
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
          )}
          {isBangalore && (
            <>
              <DataSource
                name="TN Agriculture - daily reservoir page + dated archive"
                url="https://tnagriculture.in/ARS/home/reservoir"
                description="The same TN Agri page that feeds Madurai's Vaigai + Mullaperiyar also serves daily storage / level / inflow / outflow for the 4 upstream Karnataka Cauvery dams (KRS, Hemavathi, Kabini, Harangi). Cauvery is a shared inter-state basin, so the dams appear on the same TN page even though they sit in Karnataka. Dated archive back to 2018-01-01 powers the 8-year history chart per dam."
                frequency="daily + 2018 archive"
              />
              <DataSource
                name="JICA Phase 3 Final Report (Bengaluru Water Supply and Sewerage Project)"
                url="https://www.jica.go.jp/"
                description="Engineering-grade structural numbers extracted from the JICA Phase 3 Preparatory Survey Final Report (November 2017): 1,310 MLD installed treatment across Stages I-V at T.K. Halli; 95 km transmission distance + 500 m elevation lift; 48% NRW; ~5.8M population served vs ~14M GBA; ~865,000 piped connections (2017); 8,746 km distribution mains; 84 ground-level CWRs + 84 WDSS across 9 zones; 2,235 MLD CWSS allocation; 2034 demand projection 2,608 MLD; project cost Rs 5,690 crore (85% JICA loan). Powers the Cauvery Pumping hero + bangalore-supply-overview.json."
                frequency="static (Nov 2017 baseline; periodic refresh on subsequent JICA reports)"
              />
              <DataSource
                name="BWSSB Stage V commissioning + The Ken under-delivery reporting"
                url="https://the-ken.com/"
                description="Stage V was commissioned at T.K. Halli on 16 October 2024 with 775 MLD design capacity. The Ken reported in Feb 2026 that actual delivery is ~400 MLD - about half the design. The shortfall is part of why ~33% of BBMP wards (IISc Groundwater Outlook 2025) still rely on tankers + over-extracted borewells."
                frequency="incident-driven"
              />
              <DataSource
                name="Reservoir forecast (AutoARIMA)"
                url={`/${config.cityId}`}
                description="14-day forecast with 80% confidence band per dam (KRS, Hemavathi, Kabini, Harangi), refit daily as new readings land. Fitted on a 2-year history window for tractable wall-clock; seasonal AutoARIMA with annual season_length=365."
                frequency="daily refit"
              />
            </>
          )}
          <DataSource
            name="Open-Meteo"
            url="https://open-meteo.com/"
            description="Free, no-auth daily weather data: precipitation, temperature, humidity, ET0, wind. ECMWF / ERA5-Land base."
            frequency="daily"
          />
          <DataSource
            name="IMD Gridded Rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/"
            description={isMadurai
              ? "India Meteorological Department 0.25-degree gridded rainfall, 1970-2025. Madurai grid cell at 9.9 deg N, 78.0 deg E, 862.6 mm long-term mean. Same imdlib pipeline as Chennai's IMD generator."
              : isBangalore
                ? "India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Bengaluru grid cell at 12.97 deg N, 77.6 deg E. Used for monsoon-context overlays (Bengaluru is south-west monsoon dominant with a smaller north-east monsoon tail through Oct-Nov; Cauvery basin recharge depends on both)."
                : "India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Used for monsoon-context overlays."}
            frequency="monthly archive"
          />
          {isMadurai && (
            <DataSource
              name="OSM Nominatim + Overpass - locality search points"
              url="https://overpass-api.de/"
              description="51 Madurai neighbourhood points (Anna Nagar, Pasumalai, Mattuthavani, KK Nagar, Sellur, Vandiyur, etc.) extracted via scripts/fetch-localities-osm-madurai.ts for the my-ward search box. 49/51 carry Tamil names. Powers locality-name -> ward resolution."
              frequency="periodic (one-off refresh today)"
            />
          )}
          {isBangalore && (
            <DataSource
              name="OSM Nominatim + Overpass - locality search points"
              url="https://overpass-api.de/"
              description="369 Bengaluru neighbourhood points (Whitefield, Indiranagar, Koramangala, HSR Layout, JP Nagar, Yelahanka, Hesaraghatta, Bommanahalli, etc.) - one per GBA ward - in public/data/bangalore-localities.json. Powers locality-name -> ward resolution in the my-ward search box."
              frequency="periodic (one-off refresh today)"
            />
          )}

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="India WRIS - groundwater level (CGWB stations)"
            url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
            description="Daily and seasonal manual + telemetric (DWLR) groundwater readings from the Central Ground Water Board's National Hydrograph Network."
            frequency="daily / seasonal"
          />
          <DataSource
            name="India WRIS / CGWB - block-level Dynamic GWR"
            url="https://indiawris.gov.in/"
            description={isMadurai
              ? "Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). 11 blocks classified across Madurai district (Madurai East/North/South/West, Melur, Peraiyur, Thirupparankundram, Tirumangalam, Usilampatti, Vadipatti, Kallikudi)."
              : isBangalore
                ? "Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). 6 canonical blocks across Bangalore Urban district (Bangalore (North), Bangalore-East, Bangalore-South, Bangalore-City, Yelahanka, Anekal) extracted across 7 vintages 2011-2024 from the WRIS ArcGIS REST endpoint by scripts/fetch-wris-groundwater-bangalore.ts. All 6 blocks have been Over-Exploited every year (Bangalore-East worst at 306% draft-vs-recharge in GEC 2024; Yelahanka accelerated 140 -> 260% in 4 years 2020-2024)."
                : "Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited)."
            }
            frequency="annual"
          />
          {isMadurai && (
            <DataSource
              name="CGWB Ground Water Year Book of Tamil Nadu &amp; Puducherry"
              url="https://cgwb.gov.in/cgwbpnm/search?type=2&cat_id=4&state_id=33"
              description="Peer-reviewed quarterly depth-to-water-level readings (May / Aug / Nov / Jan) at 21 dug-well stations in Madurai district, sourced from the 2023-24 and 2024-25 Year Books. Replaces an IDW-interpolated ward depth choropleth - Madurai's live WRIS network is too sparse (4 stations) for honest per-ward synthesis. Stitched into a 2-year time series stored in public/data/madurai-cgwb-stations.json."
              frequency="annual (per Year Book release)"
            />
          )}
          {isBangalore && (
            <>
              <DataSource
                name="CGWB telemetric DWLR station inventory (Bangalore Urban district)"
                url="https://indiawris.gov.in/wris/"
                description="13 telemetric DWLR stations across Bangalore Urban district observed via the India-WRIS API: Nimhans, Lalbagh Garden, Jayanagar (IISc stress ward), Hesaraghatta Piezometer, Thalaghattapura, Anekal, Cubbon Park, Dasanapura, Indian Institute of Science, Yelahanka (IISc stress ward), Adugodi, Bangalore University Ars Ls, Singasandra. Density ~1 station per 21 sq km is too sparse to honestly IDW across 369 GBA wards - so the per-ward depth choropleth is deliberately disabled here (Chennai's depth view is supported by OpenCity's monthly per-ward survey, which Bengaluru doesn't have an equivalent for)."
                frequency="annual (Year Book hydrograph back-fill is a follow-up RTI / PDF parse)"
              />
              <DataSource
                name="IISc Groundwater Outlook for Bengaluru (April 2025)"
                url="https://www.bwssb.karnataka.gov.in/"
                description="BWSSB-commissioned IISc Groundwater Outlook (April 2025) identifies 65 of 198 BBMP wards (~33%) as critically over-extracted - operating beyond CGWB's safe-yield limit. Stage V was designed to relieve these wards via piped supply; the Stage V under-delivery is why most remain on groundwater + tankers. Referenced by the round-7 cgwb-stations file (per-station proximity flag) and surfaced in the dashboard's headline."
                frequency="periodic (per IISc release)"
              />
              <DataSource
                name="WELL Labs Bengaluru Urban Water Balance Report (Jan 2024)"
                url="https://wellabs.org/"
                description="Independent academic-grade water balance for Greater Bengaluru: rainfall, runoff, recharge, demand, supply gap, source-mix accounting. Used as a cross-check against JICA Phase 3 numbers; cited in `bangalore-supply-overview.json._secondary_local_source`."
                frequency="periodic (per WELL Labs release)"
              />
            </>
          )}

          <DataSourceGroupHeader title="Water bodies &amp; restoration" />
          <DataSource
            name="OpenStreetMap"
            url="https://www.openstreetmap.org/"
            description="Base geometry for water-body polygons and the rivers polyline."
            frequency="static (refetch as needed)"
          />
          {isMadurai && (
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
          )}
          {isBangalore && (
            <>
              <DataSource
                name="OSM bbox extract - 1,897 water-body polygons (BBMP)"
                url="https://www.openstreetmap.org/"
                description="OpenStreetMap community-mapped water bodies across BBMP, fetched via Overpass bbox query and committed to public/geojson/bangalore-water-bodies-current.geojson. 1,033 polygons larger than 1 ha become cascade nodes in the round-10 reconstruction; the rest are sub-hectare ponds."
                frequency="periodic (manual refresh)"
              />
              <DataSource
                name="Harini Nagendra - Nature in the City: Bengaluru (OUP 2016)"
                url="https://global.oup.com/academic/product/nature-in-the-city-9780199465927"
                description="Canonical academic source for Bengaluru kere history: ~280 named kere in 19th-century Greater Bengaluru gazetteers, ~100 functional today. The 9 fully-lost / severely-reduced bodies surfaced in our lost-narrative overlay (Dharmambudhi -> Majestic, Sampangi -> Sri Kanteerava, Karanji Anjaneya -> Bishop Cotton, etc.) are anchored on Nagendra's documentation."
                frequency="static (book; supplements added via DHAN / INTACH / IISc CES papers)"
              />
              <DataSource
                name="T.V. Ramachandra (IISc CES) - Wetlands of Bengaluru"
                url="https://wgbis.ces.iisc.ac.in/energy/water/paper/ETR101/bangalore.html"
                description="IISc Centre for Sustainable Technologies (CES) 105-lake survey + ongoing Bellandur / Varthur monitoring. Cited in restoration-priority narrative, the K&amp;C foam cascade story, and the rich-body cohort's water-trend caveats."
                frequency="periodic (academic papers)"
              />
              <DataSource
                name="NGT Forward Foundation v State of Karnataka (OA 222/2014)"
                url="https://greentribunal.gov.in/"
                description="The 2016 NGT order that imposed the 75 m no-construction buffer around BBMP lakes + 50 m around rajakaluves + 30 m around secondary drains, and halted Mantri Tech Park (Espana) and Coremind constructions encroaching the Bellandur buffer. The legal anchor for every BBMP rich-body panel's status badges + the cascade-Layer-B court_anchor on K&amp;C foam cascade."
                frequency="incident-driven (NGT orders + compliance hearings)"
              />
              <DataSource
                name="Bengaluru rich-data lake cohort (14 bodies)"
                url={`/${config.cityId}/water-bodies`}
                description="14 flagship lakes with the full deep-zoom panel: Bellandur, Varthur, Madivala, Ulsoor, Hebbal, Sankey, Yelahanka, Kempambudhi, Hesaraghatta, Agara, Puttenahalli, Jakkur, Rachenahalli, Iblur. Each ships polygon + 1 km halo + 35-year imagery slider (1990-2024 yearly) + JRC water-loss tint + Dynamic World built-gain tint + Open Buildings v3 + Overture Q1 2026 stats + curated timeline + sources modal."
                frequency="periodic (cohort additions in rich-body rounds)"
              />
              <DataSource
                name="Cascade reconstruction (terrain-derived + Layer B curation)"
                url={`/${config.cityId}/cascades`}
                description="HydroSHEDS conditioned DEM + D8 flow direction + multi-outflow scoring produces 1,033 cascade nodes / 1,053 edges / 43 river outlets / max depth 11 for the BBMP-wide cascade graph. Layer B curation today: 4 named chains (K&amp;C foam cascade with NGT Forward Foundation anchor / Yelahanka-Hebbal north restoration model with JNNURM Jakkur anchor / Vrishabhavathi headwaters with 1894 Hesaraghatta anchor / Kempegowda old-city heritage fragments). 76 auto-derived chains scored LOW priority pending further Layer B."
                frequency="manual (regenerate after curation updates)"
              />
            </>
          )}

          <DataSourceGroupHeader title="Rivers &amp; pollution" />
          {isMadurai && (
            <>
              <DataSource
                name="CPCB - National Water Monitoring Programme"
                url="https://cpcb.nic.in/nwmp-data-2/"
                description="Annual River Water Quality reports (2020-2024 covered today). Vaigai is monitored at two stations - upstream and downstream of Madurai - with min and max readings per parameter; we use the midpoint."
                frequency="annual"
              />
              <DataSource
                name="Madras HC Madurai Bench - Vaigai pollution PIL"
                url="https://www.dtnext.in/news/tamilnadu/madras-hc-directs-tamil-nadu-govt-to-file-report-on-causes-of-pollution-in-vaigai-river-815586"
                description="December 2024 suo motu order naming 177 sewage and industrial discharge points across 5 districts, 36 samples below CPCB Class D, and a state-government action plan due January 2025."
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
          )}
          {isBangalore && (
            <>
              <DataSource
                name="KSPCB / CPCB river quality monitoring"
                url="https://kspcb.karnataka.gov.in/"
                description="9 stations across the 3 Bengaluru rivers (Vrishabhavathi / Arkavati / Dakshina Pinakini) extracted from KSPCB monthly water quality reports cross-referenced with CPCB NWMP annual River Water Quality reports. Per-station BOD / COD / DO / pH / fecal coliform readings, 2020-2024 covered. Caveat: OSM polylines for these rivers are partial through built-up BBMP (urban segment flows as storm drains); 8 of 9 sampling stations carry an off_osm_river_polyline flag because they sit at named city places where OSM doesn't trace the river - documented in scripts/snap-river-stations.py."
                frequency="monthly (KSPCB) + annual (CPCB)"
              />
              <DataSource
                name="NGT + Karnataka HC litigation on Bellandur / Varthur foam events"
                url="https://greentribunal.gov.in/"
                description="The 16 Feb 2017 Bellandur foam fire drew international news + a PMO statement. NGT constituted a Bellandur-Varthur monitoring committee under retired Justice Santosh Hegde and ordered the 75 m / 50 m / 30 m buffer regime. A second foam fire in January 2018 escalated compliance pressure. The 2017 NGT order is the legal anchor for both the rich-body panels' status badges and the K&amp;C foam cascade in the round-18 cascades page."
                frequency="incident-driven"
              />
              <DataSource
                name="K&amp;C valley + Vrishabhavathi industrial pollution sources (14 clusters)"
                url={`/${config.cityId}/rivers`}
                description="14 industrial clusters mapped as type-coloured markers across the three valleys: Peenya, Bommasandra, Yelahanka, Mahadevapura, Whitefield, Bidadi (Toyota / Bidadi industrial belt), Doddaballapur, plus textile-dyeing / electroplating / tannery clusters that feed the Vrishabhavathi and K&amp;C catchments. Compiled from KIADB records, KSPCB consent-to-operate filings, and IISc CES academic surveys."
                frequency="manual"
              />
              <DataSource
                name="KSPCB OCEMS - online effluent monitoring"
                url="https://kspcb.karnataka.gov.in/"
                description="Karnataka State Pollution Control Board's online continuous effluent monitoring system for red-category industries. Public-facing dashboard is intermittent and partial; cross-check reference for the curated industrial sources list."
                frequency="real-time (when feed is up)"
              />
            </>
          )}

          <DataSourceGroupHeader title="Flood &amp; civic infrastructure" />
          {isMadurai ? (
            <DataSource
              name="Pending RTI to Madurai Corporation"
              url={`/${config.cityId}/flood-risk`}
              description="Hazard zone polygons (5, 10, 25, 50, 100, 200-year return periods), historical flood hotspots, drainage and sewerage networks - none of these are publicly published for Madurai today. Tracked as follow-up RTIs."
              frequency="data gap"
            />
          ) : isBangalore ? (
            <>
              <DataSource
                name="BWSSB sewerage trunk network (14,121 km)"
                url={`/${config.cityId}/water-bodies`}
                description="14,121 km of mapped underground sewerage trunks feeding the 39 BWSSB STPs, extracted from a BWSSB GIS source and shipped as public/geojson/bangalore-sewerage-trunks.geojson. Gravity-fed except across the ridge between valleys, where pumping stations lift to the next basin."
                frequency="static (manual refresh)"
              />
              <DataSource
                name="BWSSB STP inventory (39 plants)"
                url={`/${config.cityId}/water-bodies`}
                description="39 STPs as of 2024 (vs 14 at the JICA Phase 3 baseline in 2017) with locations + design capacity in public/geojson/bangalore-stps.geojson. Aggregate installed capacity ~1,500 MLD against ~1,400 MLD generation; the treatment-meets-generation milestone disguises persistent KSPCB compliance gaps at older plants."
                frequency="static (manual refresh)"
              />
              <DataSource
                name="Pending RTI to BBMP / GBA - flood hazard zones + rajakaluve network"
                url={`/${config.cityId}/flood-risk`}
                description="Standard 5 / 10 / 25 / 50 / 100 / 200-year flood return-period polygons + the BBMP rajakaluve (primary storm drain) GeoJSON + historical flood hotspots (Whitefield / Sarjapur / ORR-East inundation events 2022 / 2024) aren't publicly released for Bengaluru today. Tracked as RTI follow-ups to BBMP and the Greater Bengaluru Authority."
                frequency="data gap"
              />
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Civic-infrastructure layers (drainage / sewerage / flood hazard) are city-specific. See Chennai&apos;s about page for the canonical layer registry.
            </p>
          )}

          <DataSourceGroupHeader title="Satellite &amp; remote sensing (planned)" />
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

          <DataSourceGroupHeader title="Base geometry &amp; AI" />
          <DataSource
            name="Anthropic Claude API"
            url="https://docs.anthropic.com/"
            description="AI city narratives and per-ward profiles. Pending for Madurai."
            frequency="daily / monthly"
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
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Practical consequence: a river on CPCB&apos;s PRS Priority list (e.g. the Madurai-Manamadurai stretch of the Vaigai is Priority III) won&apos;t automatically render as &quot;severely degraded&quot; here. If the underlying NWMP readings show only Class C/D conditions, the badge reflects that. The PRS designation belongs in the river description as historical context, not as the live status.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
              Methodology lives in <span className="font-mono">src/lib/utils/river-classification.ts</span>; readings are from CPCB NWMP annual River Water Quality reports.
            </p>
          </SubSection>

          {isMadurai && (
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
          )}

          {isBangalore && (
            <SubSection title={`Open data gaps in ${cityName}`}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Layers we&apos;d like to surface for Bengaluru that aren&apos;t publicly released yet. Each one has the workaround currently in place; tracked as RTI / partnership follow-ups.
              </p>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public flood-hazard return-period layer</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Standard 5 / 10 / 25 / 50 / 100 / 200-year flood return-period polygons are not currently published for Bengaluru. The flood-risk page surfaces the BWSSB rajakaluve / sewerage trunk network + a narrative on recurring Whitefield / Sarjapur / ORR-East inundation tied to encroached storm drains and Bellandur-Varthur overflow.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public BBMP rajakaluve GeoJSON</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The primary stormwater drain (rajakaluve) network is mapped internally by BBMP but the GeoJSON is not publicly released. NGT Forward Foundation order set a 50 m buffer regulation around them but enforcement requires the boundary; tracked as an RTI / GBA-partnership follow-up.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public BWSSB tanker call log / Kaveriwheels feed</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    BWSSB&apos;s Kaveriwheels app (~19K downloads in a 14M city) collects booking + delivery data but does not publish a feed. OpenCity Tanker Survey 2024-25 fills the gap with a ~5,000-tanker estimate + crisis-peak rate spreads; a public Kaveriwheels feed would let us correlate stress-ward demand against IISc&apos;s 65-ward critical list.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">No per-ward depth choropleth (deliberate)</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Bengaluru has 13 CGWB telemetric DWLR stations across 369 GBA wards - density ~1 station per 21 sq km, far too sparse to honestly interpolate a per-ward choropleth. Instead the groundwater page surfaces the 13-station point overlay alongside the 6-block GEC exploitation classification + 3-factor ward risk composite. The IDW-interpolated view that Chennai uses is deliberately disabled because Bengaluru lacks Chennai's equivalent of the OpenCity monthly per-ward survey.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Per-station hydrograph readings deferred</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The 13 CGWB station markers carry name + block + IISc-stress-ward proximity but the annual hydrograph series (peer-reviewed quarterly depth-to-water-level readings) hasn&apos;t been transcribed from the CGWB Karnataka Year Book yet. Tracked as a follow-up Year Book PDF parse / RTI.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Lost-kere coordinates not populated</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The 9 Nagendra-anchored lost / severely-reduced kere have name + status + conversion note but no lat/lng - the fully-lost ones (Dharmambudhi, Sampangi, Karanji Anjaneya, Akkithimmanahalli, Domlur) have no OSM presence (they're under bus stations, stadiums, schools and BDA layouts). The 4 severely-reduced bodies are mappable via their OSM osm_ids (Kempambudhi, Ulsoor, Sankey, Bellandur) and already surface in the rich-body cohort. Listed as a Tier 3 follow-up.
                  </p>
                </div>
              </div>
            </SubSection>
          )}

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

          {isMadurai && (
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
          )}

          {isBangalore && (
            <SubSection title="Documented lost + severely-reduced kere (Nagendra OUP 2016 + IISc CES)">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Conservative named-only inventory. Greater Bengaluru had ~280 kere in 19th-century gazetteers vs ~100 functional today, so the fully-lost set runs into the dozens at BBMP scale - this table lists only the named cases where conversion to built use is unambiguously documented.
              </p>
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
                    {BANGALORE_LOST_BODIES.map((row) => (
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
                {BANGALORE_LOST_BODIES.map((row) => (
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
          )}
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

"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/context";
import type { PlaceConfig } from "@/lib/cities";

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

export function CityAboutContent({ config }: { config: PlaceConfig }) {
  const { t } = useLanguage();
  const cityName = config.displayName;
  const isMadurai = config.cityId === "madurai";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        About {cityName} Water Intelligence
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
        <Section title={`What we track for ${cityName}`} defaultOpen>
          <p className="text-slate-600 dark:text-slate-400">
            {cityName} is governed by{" "}
            <span className="font-semibold">{config.primaryAuthority.name}</span>
            {config.placeKind === "city" && config.localGovernment && (
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
                Water sources tracked daily
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
                        <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">primary drinking</span>
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
            <SubSection title="Default consumption assumptions (Madurai)">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Madurai-specific defaults used to compute days-of-water-left.
                These are conservative starting points; the dashboard exposes
                sliders so users can substitute their own.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                      <th className="pb-2 font-medium">Parameter</th>
                      <th className="pb-2 font-medium">Default</th>
                      <th className="pb-2 font-medium">Source / note</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">Daily city demand</td>
                      <td className="py-2 font-mono">{config.defaultConsumptionMld ?? "n/a"} MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        Madurai Corporation operational estimate; ~85 MLD piped supply across 100 wards.
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">Desalination contribution</td>
                      <td className="py-2 font-mono">0 MLD</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">No desal plants commissioned for Madurai.</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">Groundwater contribution</td>
                      <td className="py-2 font-mono">Excluded from days-left</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        Borewells supplement the piped supply but exact MLD is unmodelled. CGWB block + ward-level depth views show groundwater stress separately.
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2">Reservoir evaporation</td>
                      <td className="py-2 font-mono">Not modelled</td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        Vaigai / Mullaperiyar evaporation is non-trivial in summer; planned for v2 once a daily ET0 series is wired.
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
        <Section id="pages" title={`What each page shows for ${cityName}`}>
          {isMadurai && (
            <>
              <SubSection id="page-dashboard" title="Home / dashboard">
                <p className="text-slate-600 dark:text-slate-400">
                  The home page anchors {cityName}&apos;s reservoir picture. Vaigai dam (the drinking-water source) is the headline; Mullaperiyar (Periyar reservoir in Idukki, Kerala) is the upstream feeder via the 1886 lease tunnel and contributes ~80% of Vaigai&apos;s annual yield.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">9-year history chart</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Daily storage and percent-FRL trends going back to 2018, scraped from TN Agri ARS&apos;s archive (one HTML page per date). Toggle between 90 days, 1 year, 3 years, and the full archive; toggle Vaigai vs Mullaperiyar series independently. Backfilled by <span className="font-mono text-xs">neer-vazhvu-api/scripts/backfill_tn_pwd_reservoirs.py</span>.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">14-day forecast (AutoARIMA)</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Each reservoir gets its own AutoARIMA fit (<a href="https://nixtla.github.io/statsforecast/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">statsforecast</a>). Seasonal differencing kicks in once we have ≥2 years of history; the forecast is shown as a dashed continuation line plus a shaded 80% confidence band. Refits daily as new readings land. Output goes to <span className="font-mono text-xs">reservoir_forecast_v2</span> (Supabase mig 020).
                </p>
                <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
                  <li>Each reservoir is forecast independently - no cross-source pooling.</li>
                  <li>The model retrains on every refresh; we don&apos;t freeze parameters.</li>
                  <li>14-day horizon is aggressive but useful; the 80% band widens as you go out.</li>
                  <li>Predictions clamp at 0 and the registered FRL capacity per source.</li>
                </ul>
              </SubSection>

              <SubSection id="page-groundwater" title="Groundwater">
                <p className="text-slate-600 dark:text-slate-400">
                  {cityName}&apos;s groundwater page combines three views toggled in the headline bar: CGWB block exploitation (the official annual classification), interpolated ward depth, and a 3-factor risk composite.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Block exploitation (GWR)</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  All 66 of Madurai district&apos;s CGWB-classified blocks (Safe / Semi Critical / Critical / Over Exploited) coloured by the latest annual draft-percentage. Latest (2017): 4 over-exploited, 7 critical, 21 semi-critical, 34 safe. The most stressed block is <span className="font-semibold">Sindhupatti</span> at ~119% draft.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Ward depth (interpolated)</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  No authoritative ward-level groundwater survey exists for Madurai (Chennai uses OpenCity ward-monthly data). We interpolate per-ward depth using inverse-distance weighting (k=4 nearest stations within 15 km, power=2) over the ~35 telemetric CGWB stations in Madurai district from India WRIS. Lives at <span className="font-mono text-xs">/api/groundwater/wards-interpolated?city=madurai</span>; cached 6 h to amortize the geojson + table cost. Refreshes daily as <span className="font-mono text-xs">scrape_wris_madurai.py</span> upserts new readings.
                </p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live CGWB station overlay</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    On the depth view we also drop markers for each WRIS station in Madurai district. Click a marker for the well&apos;s metadata (acquisition mode, depth, aquifer type) and the recent reading window.
                  </p>
                  <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Acquisition modes</h5>
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                    <li><span className="font-medium">Manual</span> - field-team measurements, typically 4 readings/year.</li>
                    <li><span className="font-medium">Telemetric (DWLR)</span> - automated daily readings.</li>
                  </ul>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Madurai is overwhelmingly telemetric (much denser than Chennai). All 35 stations in the latest scrape are DWLR.
                  </p>
                </div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Ward risk composite (madurai-risk-v1-3factor)</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  A 3-factor weighted percentile score per ward, A-F graded. Chennai uses 5 factors (drainage 25%, sewerage 25%, flood 25%, WB-health 15%, WB-density 10%); Madurai&apos;s drainage / sewerage / flood-hazard GeoJSON layers don&apos;t exist publicly yet, so v1 ships a reduced composite with what we have:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                        <th className="pb-2 font-medium">Factor</th>
                        <th className="pb-2 font-medium">Weight</th>
                        <th className="pb-2 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300 text-xs">
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5">Groundwater depth (IDW)</td>
                        <td className="py-1.5 font-mono">50%</td>
                        <td className="py-1.5">Deeper = higher risk</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5">Water-body density (per sq km)</td>
                        <td className="py-1.5 font-mono">20%</td>
                        <td className="py-1.5">Denser = lower risk</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">Water-body health (mean restoration_priority within 3 km)</td>
                        <td className="py-1.5 font-mono">30%</td>
                        <td className="py-1.5">Higher score = sicker tank = higher risk</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Each factor is converted to a city-wide percentile (0=best, 100=highest risk), weighted, and summed. Composite ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, &gt;80 = F. Generated by <span className="font-mono">scripts/compute-madurai-ward-risk.ts</span> into <span className="font-mono">public/data/ward-risk-madurai.json</span>.
                </p>
              </SubSection>

              <SubSection id="page-water-bodies" title="Water bodies">
                <p className="text-slate-600 dark:text-slate-400">
                  715 OSM water-body polygons across Madurai district, assembled via the Overpass API and stitched with osmtogeojson. Click any polygon for its OSM tags; named flagship tanks (19 hand-curated) get extra metadata.
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Vaigai mainstem polygons are explicitly labelled (a post-process bakes the river name into water_type=river properties using a 500 m proximity check against the OSM rivers polyline). This avoids the &quot;unnamed dam wall&quot; class of confusing shapes that earlier appeared on the map.
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Lake-restoration narrative (lost tanks, flagships, programmes, court orders) lives at the dedicated <a href="/madurai/lake-restoration" className="text-blue-600 dark:text-blue-400 hover:underline">/madurai/lake-restoration</a> page rather than the map view.
                </p>
              </SubSection>

              <SubSection id="page-rivers" title="Rivers">
                <p className="text-slate-600 dark:text-slate-400">
                  Vaigai-system scope: 304 km Vaigai mainstem, 121 km Periyar (Kerala feeder), 72 km Suruliyaru, 27 km Manjalar, 117 km Varaha tributaries. Per-river sidebar shows length, status, upstream/downstream termini, and feed.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CPCB NWMP station markers</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Vaigai is on the CPCB Priority III polluted-stretch list. Two NWMP stations are monitored: 10059 (Madurai U/S, our &quot;vaigai-sellur&quot;) and 10060 (Madurai D/S, our &quot;vaigai-anuppanadi&quot;). Annual midpoint readings (DO, BOD, pH, conductivity, fecal coliform, nitrate) for 2021-2024 are parsed from the CPCB annual report PDFs by <span className="font-mono text-xs">scrape_cpcb_nwmp_vaigai.py</span> and rendered as a per-station table in the sidebar.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Markers are colour-coded by latest BOD: red &gt;6 mg/L, amber &gt;3, green ≤3, grey when no readings. The 4 other candidate stations (Vaigai dam, Andipatti, Manamadurai, Ramanathapuram) stay seed-only because CPCB doesn&apos;t monitor them today.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Court orders &amp; key events</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Hand-curated event log at <span className="font-mono text-xs">public/data/river-events-madurai.json</span>. Categories: court_order, dispute, threshold, news, restoration. Seed entries cover the Madras HC Dec 2024 PIL on Vaigai pollution (177 discharge points, 36 below CPCB Class D), the SC 2014 Mullaperiyar verdict (142 ft cap), and operational thresholds (~6,000 cusecs Vaigai dam release as Madurai-city flood warning).
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Industrial pollution sources</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  6 hand-curated Vaigai-basin polluters mapped as type-coloured markers: SIDCO Kappalur + K. Pudur estates, Sellur sewage discharge zone, Dindigul tannery cluster, Theni textile dyeing units, and the Madras HC 2024 multi-district inventory (177 outfalls across 5 districts). Sourced from TNSIDCO, DHAN CURE study, Columbia GSAPP studio, NGT/news. Compliance reference: TNPCB OCMMS (real-time effluent monitoring portal).
                </p>
              </SubSection>

              <SubSection id="page-flood" title="Flood risk">
                <p className="text-slate-600 dark:text-slate-400">
                  Narrative-only stub. Hazard-zone polygons (5/10/25/50/100/200-year return periods), historical flood-hotspot layers, drainage GeoJSON, and sewerage overlays don&apos;t exist publicly for Madurai (in contrast with Chennai&apos;s OpenCity-published layers). The page surfaces the Vaigai dam-release threshold (~6,000 cusecs as Madurai-city flood warning; 12,000+ during the 2018 floods) and a documented locality risk note pending RTI to Madurai Corporation.
                </p>
              </SubSection>

              <SubSection id="page-lake-restoration" title="Lake restoration">
                <p className="text-slate-600 dark:text-slate-400">
                  Madurai-only narrative-rich page (Chennai redirects /lake-restoration to /water-bodies). Sections: 14 lost urban tanks, 12 severely-reduced tanks, 19 hand-curated flagships, restoration programmes (Kudimaramathu / AMRUT / Smart City / IAMWARM), Madras HC court-order anchors, DHAN partnership target.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Restoration priority (madurai-flagship-v1)</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  Each flagship gets a colour-coded priority badge derived from <span className="font-mono text-xs">scripts/compute-restoration-priority-madurai.ts</span>:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li><span className="font-semibold">Status severity 0-80</span> - drying / lost &gt; severely reduced &gt; encroached / polluted &gt; restored.</li>
                  <li><span className="font-semibold">Cultural bonus 0-35</span> - Biodiversity Heritage Site (+25), Ramsar candidate (+20), HC PIL anchor (+15), pre-1700 heritage (+10), dynasty-era (+8).</li>
                  <li><span className="font-semibold">Size 4-25</span> - acres bucketed (very large / large / medium / small / tiny).</li>
                  <li><span className="font-semibold">Source confidence ×0.7-1.0</span> - V (verified), N (newsroom), C (claim only) downweights.</li>
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Sum is bucketed: ≤40 low, ≤60 moderate, ≤80 high, &gt;80 critical. First run produced 5 critical, 2 high, 7 moderate, 5 low. Top 5: Vandiyur 100, Thenkal Kanmoi 100, Madakulam 88, Avaniyapuram 85, Samanatham 80.
                </p>
              </SubSection>

              <SubSection id="page-my-ward" title="My Ward / Report Card">
                <p className="text-slate-600 dark:text-slate-400">
                  Ward-boundary map for Madurai Corporation&apos;s 100 wards (5 zones, 2022 delimitation). Click a ward to see zone, area, centroid, and a link into the per-ward report card.
                </p>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Per-ward report card</h4>
                <p className="text-slate-600 dark:text-slate-400">
                  At <span className="font-mono text-xs">/madurai/my-ward/report?ward=N</span>: large grade badge (A-F), composite score / 100, city rank, zone, area; a metric breakdown showing each factor&apos;s raw value + percentile + weight; and a methodology footer explaining the algorithm version. Without a ward parameter the page renders an index grouping ward chips by grade so you can jump straight to the worst-graded wards.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Madurai&apos;s report card is intentionally slimmer than Chennai&apos;s 540-line equivalent. Chennai&apos;s is built on a 5-factor composite + uplift-planner cost matrix; that costing layer is out-of-scope for Madurai v1 because the underlying drainage/sewerage GeoJSONs aren&apos;t published.
                </p>
              </SubSection>

              <SubSection id="page-facts" title="Water facts">
                <p className="text-slate-600 dark:text-slate-400">
                  Journalist-ready quotable stats grouped by tier (1 live, 2 derived, 3 historical, 4 heritage). Madurai currently ships 14 hand-curated Tier 3-4 facts (heritage, governance, capacity stats) plus 9 auto-derived Tier 2 facts that compute from the data files we ship: over-exploited blocks, critical+semi-critical blocks, restoration priority counts, F-grade ward count + worst ward, citywide IDW depth, Vaigai BOD pollution gradient, Vaigai DO downstream, urban tank area lost.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Re-run <span className="font-mono">scripts/compute-madurai-derived-facts.ts</span> after any underlying data file refresh to keep /madurai/facts in sync. The script strips its own prior auto-mad-* rows before re-appending so hand-curated facts stay untouched.
                </p>
              </SubSection>
            </>
          )}

          {!isMadurai && (
            <p className="text-slate-600 dark:text-slate-400">
              Per-page methodology documentation for {cityName} is pending. See the dedicated Chennai about page (<a href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">/about</a>) for the canonical methodology pattern.
            </p>
          )}
        </Section>

        {/* ─────────────────────────────────────────────────────────
            3. Intelligence & AI narratives
            ───────────────────────────────────────────────────────── */}
        <Section id="intelligence" title="Intelligence &amp; AI narratives">
          <p className="text-slate-600 dark:text-slate-400">
            Chennai layers an AI daily briefing, a CityStory narrative (Anthropic Claude pipeline), and per-ward AI profiles on top of the raw data. For {cityName}, those layers are pending; the underlying tables (water_estimate_daily, ward_risk_score) aren&apos;t yet city-aware.
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
            4. Data Source Index
            ───────────────────────────────────────────────────────── */}
        <Section id="data-sources" title={`Data sources for ${cityName}`}>
          <p className="text-slate-600 dark:text-slate-400">
            {t("about.data_pipeline")} {t("about.data_pipeline2")}
          </p>

          <DataSourceGroupHeader title="Reservoir &amp; weather" />
          {isMadurai && (
            <>
              <DataSource
                name="TN Agriculture ARS - daily + historical archive"
                url="https://tnagriculture.in/ARS/home/reservoir"
                description="Daily storage, level, inflow/outflow for Vaigai and Mullaperiyar (listed as Periyar) on a state-wide HTML page; dated archive back to 2018 at /ARS/home/reservoir/YYYY-MM-DD. Live scrape: scrape_tn_pwd_reservoirs.py. History backfill: backfill_tn_pwd_reservoirs.py."
                frequency="daily (scraped) + 2018 backfill"
              />
              <DataSource
                name="Reservoir AutoARIMA forecast"
                url="/madurai"
                description="neer-vazhvu-api/scripts/compute_reservoir_forecast_madurai.py fits seasonal AutoARIMA when ≥2 years of history exist, non-seasonal otherwise; emits 14-day forecasts with 80% CI bands to Supabase reservoir_forecast_v2 (mig 020)."
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
            description="India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Used for monsoon-context overlays."
            frequency="monthly archive"
          />

          <DataSourceGroupHeader title="Groundwater" />
          <DataSource
            name="India WRIS Ground Water Level API (CGWB stations)"
            url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
            description="Daily / seasonal manual + DWLR groundwater readings from CGWB's National Hydrograph Network. Madurai daily ingest: scrape_wris_madurai.py."
            frequency="daily / seasonal"
          />
          <DataSource
            name="India WRIS / CGWB Dynamic GWR (block exploitation)"
            url="https://indiawris.gov.in/"
            description="Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). 66 Madurai-district blocks classified."
            frequency="annual"
          />
          {isMadurai && (
            <>
              <DataSource
                name="Inverse-distance interpolation (ward depth)"
                url="/api/groundwater/wards-interpolated?city=madurai"
                description="src/lib/groundwater/idw.ts (k=4 nearest stations within 15 km, power=2). Served by /api/groundwater/wards-interpolated, cached 6 h."
                frequency="daily refresh"
              />
              <DataSource
                name="Ward risk composite (madurai-risk-v1-3factor)"
                url="/madurai/my-ward/report"
                description="scripts/compute-madurai-ward-risk.ts emits ward-risk-madurai.json. 3-factor weighted percentile composite: GW depth 50%, water-body density 20%, water-body health 30%."
                frequency="on data refresh"
              />
            </>
          )}

          <DataSourceGroupHeader title="Water bodies &amp; restoration" />
          <DataSource
            name="OpenStreetMap (Overpass API)"
            url="https://overpass-api.de/"
            description="Base water-body polygons + rivers polyline. Madurai fetch: scripts/fetch-water-bodies-osm-madurai.ts produces 715 polygons via osmtogeojson stitching."
            frequency="static (refetch as needed)"
          />
          {isMadurai && (
            <>
              <DataSource
                name="Vencatesan (2014) - Madurai's lost urban tanks"
                url="https://www.atree.org/"
                description="14 fully lost + 12 severely reduced urban tanks compiled into public/data/water-bodies-lost-madurai.json (~16.5 sq km combined area lost, ~30% of old city footprint)."
                frequency="static"
              />
              <DataSource
                name="Madurai flagship water-bodies (DHAN + heritage records)"
                url="/madurai/lake-restoration"
                description="19 hand-curated flagship tanks/dams with status, area, builder/era, court-order anchors. Source for the restoration-priority composite."
                frequency="static"
              />
              <DataSource
                name="Restoration priority algorithm (madurai-flagship-v1)"
                url="/madurai/lake-restoration"
                description="scripts/compute-restoration-priority-madurai.ts scores flagships by status severity (0-80) + cultural anchor (0-35) + size (4-25) × source-confidence multiplier (0.7-1.0)."
                frequency="on update"
              />
              <DataSource
                name="Restoration projects + court orders"
                url="/madurai/lake-restoration"
                description="Kudimaramathu / AMRUT / Smart City / IAMWARM programme rows + Madras HC anchors. public/data/restoration-projects-madurai.json."
                frequency="manual"
              />
            </>
          )}

          <DataSourceGroupHeader title="Rivers &amp; pollution" />
          {isMadurai && (
            <>
              <DataSource
                name="CPCB NWMP River Water Quality reports (2020-2024)"
                url="https://cpcb.nic.in/wqm/2024/WQuality_River-Data-2024.pdf"
                description="Annual PDFs at cpcb.nic.in/wqm/{YEAR}/WQuality_River-Data-{YEAR}.pdf. Vaigai is monitored at 2 stations (10059 Madurai U/S, 10060 Madurai D/S). Parsed by scrape_cpcb_nwmp_vaigai.py - drop PDFs in docs/cpcb/ and re-run when new editions land."
                frequency="annual"
              />
              <DataSource
                name="Madras HC Madurai Bench - Vaigai pollution PIL"
                url="https://www.dtnext.in/news/tamilnadu/madras-hc-directs-tamil-nadu-govt-to-file-report-on-causes-of-pollution-in-vaigai-river-815586"
                description="Dec 2024 suo motu order. 177 sewage / industrial discharge points across 5 districts; 36 samples below CPCB Class D. Encoded as a court_order event in public/data/river-events-madurai.json."
                frequency="incident-driven"
              />
              <DataSource
                name="Mullaperiyar Supreme Court 2014 verdict + Supervisory Committee"
                url="https://en.wikipedia.org/wiki/Mullaperiyar_Dam"
                description="5-judge Constitution Bench (May 2014) permitted 142 ft Mullaperiyar storage; struck down Kerala's 2006 cap; established the still-active Supervisory Committee that arbitrates seasonal storage."
                frequency="incident-driven"
              />
              <DataSource
                name="Vaigai-basin industrial pollution sources"
                url="/madurai/rivers"
                description="6 hand-curated sources at public/data/industrial-sources-madurai.json: SIDCO Kappalur + K. Pudur, Sellur sewage zone, Dindigul tannery cluster, Theni textile dyeing units, the HC 2024 multi-district inventory. Compiled from TNSIDCO, DHAN CURE study, Columbia GSAPP studio, NGT / news."
                frequency="manual"
              />
              <DataSource
                name="TNPCB OCMMS - online continuous monitoring"
                url="https://ocmms.tn.gov.in/"
                description="TN Pollution Control Board's real-time effluent monitoring stream for red-category industries. Manual reference for cross-checking the curated sources file; not yet auto-scraped for Madurai."
                frequency="real-time"
              />
              <DataSource
                name="DHAN Foundation - Centre for Urban Water Resource (CURE) study"
                url="https://www.dhan.org/"
                description="Field study finding 8 of 9 Vaigai sampling spots unfit for human use (physical, chemical, biological parameters). Underpins the qualitative status assessments in the rivers + lake-restoration narratives."
                frequency="periodic"
              />
            </>
          )}

          <DataSourceGroupHeader title="Flood &amp; civic infrastructure" />
          {isMadurai ? (
            <DataSource
              name="Pending RTI to Madurai Corporation"
              url="/madurai/flood-risk"
              description="Hazard zone polygons (5/10/25/50/100/200-yr return periods), historical flood hotspots (e.g. 2018), drainage GeoJSON, sewerage overlays - none publicly published for Madurai today. Tracked as Tier 2 follow-ups."
              frequency="data gap"
            />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Civic-infrastructure layers (drainage / sewerage / flood hazard) are city-specific. See Chennai&apos;s about page for the canonical layer registry.
            </p>
          )}

          <DataSourceGroupHeader title="Satellite &amp; remote sensing (planned)" />
          <DataSource
            name="JRC Global Surface Water (Monthly Recurrence)"
            url="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_MonthlyRecurrence"
            description="Per-water-body wet/dry history. Algorithm portable from Chennai; data layer pending for Madurai's 19 flagships."
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
            description="Catchment polygons for Vaigai dam + sub-basins, used for catchment rainfall context. Pending wiring to /madurai dashboard."
            frequency="static"
          />

          <DataSourceGroupHeader title="Base geometry &amp; AI" />
          <DataSource
            name="Anthropic Claude API"
            url="https://docs.anthropic.com/"
            description="AI city narratives + ward profiles. Pending for Madurai (template-based briefing scaffolding shipped, LLM layer not yet wired for Madurai)."
            frequency="daily / monthly"
          />
        </Section>

        {/* ─────────────────────────────────────────────────────────
            5. Data quality & limitations
            ───────────────────────────────────────────────────────── */}
        <Section id="data-quality" title="Data quality &amp; limitations">
          {isMadurai && (
            <SubSection title="Madurai-specific data gaps">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {cityName} is materially less instrumented than Chennai. Some honest gaps:
              </p>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public flood-hazard layer</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Chennai publishes 5/10/25/50/100/200-year flood return-period polygons through OpenCity. Madurai has none. The flood-risk page falls back to a narrative-only stub anchored on the 6,000-cusec dam-release threshold; 2018 floods peaked above 12,000.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">No public drainage / sewerage GeoJSONs</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Chennai&apos;s ward-risk composite uses drainage and sewerage GeoJSONs sourced from OpenCity. Madurai equivalents don&apos;t exist publicly - tracked as RTI follow-ups to Madurai Corporation. Until then the ward risk composite ships a 3-factor (vs Chennai&apos;s 5-factor) variant.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">CPCB monitors only 2 of the 6 candidate Vaigai stations</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    NWMP covers Vaigai U/S Madurai (10059) and D/S Madurai (10060). Vaigai dam, Andipatti, Manamadurai, and Ramanathapuram are seeded for future expansion but stay readings-empty.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">Ward depth is interpolated, not surveyed</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Chennai uses an authoritative OpenCity ward-monthly groundwater dataset. Madurai has no equivalent, so we IDW from the 35 telemetric CGWB stations in the district. IDW uncertainty grows with distance - wards far from any station may be coloured noData.
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

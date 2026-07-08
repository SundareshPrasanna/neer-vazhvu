"use client";

import { useState } from "react";
import { elevationLegendEntries, useElevationBands } from "@/components/map/elevation-bands";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

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
  const { t } = useLanguage();
  // Default layer state: primary + secondary drains + named hotspots
  // visible; the broader unnamed-vulnerable cloud off (turn on for
  // exploratory view, off to keep the named-locality story readable).
  const [layerState, setLayerState] = useState({
    showPrimary: true,
    showSecondary: true,
    showHotspotsNamedProne: true,
    showHotspotsLowLying: true,
    showHotspotsVulnerable: false,
    showElevation: false,
  });

  const elevation = useElevationBands("bangalore", layerState.showElevation);
  const toggle = (key: keyof typeof layerState) => () =>
    setLayerState((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header / context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {tFmt(t("frb.scope_label"), { city: cityDisplayName })}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t("frb.summary_counts")}
        </span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map area */}
        <div className="relative h-[45vh] shrink-0 md:h-full md:flex-1 md:shrink">
          {/* Mobile: the map needs an explicit height - as a flex-basis-0 item
              next to the tall text sidebar it collapses to 0px and only its
              floating controls remain visible. Desktop keeps filling the row. */}
          <FloodLeafletMap
            center={[12.9716, 77.5946]}
            zoom={11}
            layerState={layerState}
            elevationData={elevation.data}
          />

          {/* Layer-toggle panel - top-right overlay */}
          <div className="absolute top-3 right-3 z-[500] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md p-3 space-y-2 text-xs max-w-[230px]">
            <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wide">
              {t("frb.layers")}
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
                {t("frb.primary_drains")}
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
                {t("frb.secondary_drains")}
              </span>
            </label>
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layerState.showHotspotsNamedProne}
                  onChange={toggle("showHotspotsNamedProne")}
                  className="accent-red-600"
                />
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
                  {t("frb.named_prone")}
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
                  {t("frb.named_low_lying")}
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
                  {t("frb.vulnerable")}
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
                  {elevationLegendEntries(elevation.data).map(({ band, color }) => (
                    <span key={band} className="inline-flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                      {band}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Ground height above sea level from satellite (FABDEM 30 m, buildings and
                  forests removed). Bengaluru&apos;s floods follow its valleys - the blue bands
                  are the low ground the rajakaluves drain. Read as bands, not spot heights
                  (~2 m vertical accuracy).
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
              {tFmt(t("frb.heading"), { city: cityDisplayName })}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {t("frb.intro")}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("frb.what_shows")}
            </h3>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-[13px] mt-1">
              <li>{t("frb.bullet_primary")}</li>
              <li>{t("frb.bullet_secondary")}</li>
              <li>{t("frb.bullet_named_prone")}</li>
              <li>{t("frb.bullet_named_low")}</li>
              <li>{t("frb.bullet_vulnerable")}</li>
            </ul>
          </section>

          <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t("frb.gaps_heading")}
            </h3>
            <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 space-y-1.5 text-[12px] mt-1">
              <li>{t("frb.gap_return_period")}</li>
              <li>{t("frb.gap_tertiary")}</li>
              <li>{t("frb.gap_live_rainfall")}</li>
              <li>{t("frb.gap_bbmp_kaluve")}</li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("frb.external_heading")}
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
                - {t("frb.ksndmc_note")}
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
                - {t("frb.bhuvan_note")}
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
                - {t("frb.wb_note")}
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
                - {t("frb.iisc_note")}
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
                - {t("frb.bmtpc_note")}
              </li>
            </ul>
          </section>

          <section className="border-t border-slate-200 dark:border-slate-700 pt-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              {tFmt(t("frb.source_para"), { opencity: "OPENCITY_PLACEHOLDER" }).split("OPENCITY_PLACEHOLDER").map((seg, i, arr) => (
                <span key={i}>
                  {seg}
                  {i < arr.length - 1 && (
                    <a
                      href="https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban"
                      target="_blank"
                      rel="noopener"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      OpenCity Bengaluru
                    </a>
                  )}
                </span>
              ))}
            </p>
            <p>
              {tFmt(t("frb.about_para"), { about_link: "ABOUT_PLACEHOLDER" }).split("ABOUT_PLACEHOLDER").map((seg, i, arr) => (
                <span key={i}>
                  {seg}
                  {i < arr.length - 1 && (
                    <Link
                      href="/bangalore/about#data-sources"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      /bangalore/about
                    </Link>
                  )}
                </span>
              ))}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { FloodViewToggle } from "@/components/flood-risk/flood-view-toggle";
import { FloodLegend } from "@/components/flood-risk/flood-legend";
import { FloodDetailPanel } from "@/components/flood-risk/flood-detail-panel";
import { HAZARD_COLORS } from "@/types/flood-risk";
import type { FloodViewMode, HazardCategory, SelectedFloodFeature } from "@/types/flood-risk";
import { useLanguage } from "@/lib/i18n/context";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("flood.loading_map")}</span>
    </div>
  );
}

const FloodRiskMap = dynamic(
  () =>
    import("@/components/flood-risk/flood-risk-map").then((m) => m.FloodRiskMap),
  { ssr: false, loading: () => <MapLoading /> }
);

const HAZARD_CATS: HazardCategory[] = ["very_high", "high", "moderate", "low", "very_low"];

export default function FloodRiskPage() {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<FloodViewMode>("hazard");
  const [selected, setSelected] = useState<SelectedFloodFeature | null>(null);
  const [historicalEvent, setHistoricalEvent] = useState<"2015" | "2020">("2015");

  const hasPanel = selected !== null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Context bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {t("context.flood_narrative")}
        </span>
      </div>

      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        {viewMode === "hazard" && (
          <>
            {HAZARD_CATS.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: HAZARD_COLORS[cat] }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {t(`flood.${cat}`)}
                </span>
              </div>
            ))}
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("flood.tagline_hazard")}
            </p>
          </>
        )}

        {viewMode === "historical" && (
          <>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
              <button
                onClick={() => setHistoricalEvent("2015")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  historicalEvent === "2015"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t("flood.event_2015")}
              </button>
              <button
                onClick={() => setHistoricalEvent("2020")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  historicalEvent === "2020"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t("flood.event_2020")}
              </button>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {historicalEvent === "2015" ? "327 " : "53 "}{t("flood.hotspots")}
              {historicalEvent === "2015" && <> · 192 {t("flood.depth_readings")}</>}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("flood.tagline_historical")}
            </p>
          </>
        )}

        {viewMode === "drainage" && (
          <>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">8,092</span> {t("flood.swd_count")}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">2,089</span> {t("flood.side_drains")}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">52</span> {t("flood.macro_micro")}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("flood.tagline_drainage")}
            </p>
          </>
        )}

        {viewMode === "sewerage" && (
          <>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">8</span> {t("flood.stp_count")}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">348</span> {t("flood.sps_count")}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <span className="font-semibold text-slate-900 dark:text-slate-100">3,834</span> {t("flood.pm_count")}
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("flood.tagline_sewerage")}
            </p>
          </>
        )}
      </div>

      {/* View toggle bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
        <FloodViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Map + panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`relative flex-1 ${hasPanel ? "h-[55vh] md:h-full" : "h-full"}`}>
          <FloodRiskMap
            viewMode={viewMode}
            historicalEvent={historicalEvent}
            onSelect={setSelected}
          />
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
            <FloodLegend viewMode={viewMode} />
          </div>
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("flood.source_flood")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {viewMode === "drainage"
                  ? t("flood.source_gcc")
                  : viewMode === "sewerage"
                    ? t("flood.source_cmwssb")
                    : t("flood.source_opencity")}
              </span>
            </div>
          </div>
        </div>

        {hasPanel && (
          <div className="h-[45vh] md:h-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
            <FloodDetailPanel
              selected={selected}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

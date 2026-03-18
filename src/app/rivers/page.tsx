"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RiverPanel } from "@/components/rivers/river-panel";
import { PollutionPanel } from "@/components/pollution/pollution-panel";
import { RiversLegend } from "@/components/rivers/rivers-legend";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS } from "@/types/river-quality";
import type { IndustrialPollutionData, PollutionSource } from "@/types/industrial-pollution";
import { useLanguage } from "@/lib/i18n/context";

function RiversMapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("rivers_page.loading_map")}</span>
    </div>
  );
}

// Leaflet must be loaded client-side only (no SSR)
const CombinedRiversMap = dynamic(
  () =>
    import("@/components/rivers/combined-rivers-map").then(
      (m) => m.CombinedRiversMap
    ),
  {
    ssr: false,
    loading: () => <RiversMapLoading />,
  }
);

export default function RiversPage() {
  const { t } = useLanguage();
  const [qualityData, setQualityData] = useState<RiverQualityData | null>(null);
  const [pollutionData, setPollutionData] = useState<IndustrialPollutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRiver, setSelectedRiver] = useState<SelectedRiver | null>(null);
  const [selectedSource, setSelectedSource] = useState<PollutionSource | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/river-quality.json").then((r) => r.json()),
      fetch("/data/industrial-sources.json").then((r) => r.json()),
    ])
      .then(([quality, pollution]: [RiverQualityData, IndustrialPollutionData]) => {
        setQualityData(quality);
        setPollutionData(pollution);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">
          {t("rivers_page.loading")}
        </span>
      </div>
    );
  }

  if (!qualityData || !pollutionData) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {t("rivers_page.title")}
          </h1>
          <p>{t("rivers_page.no_data")}</p>
        </div>
      </div>
    );
  }

  const cooum = qualityData.rivers.find((r) => r.id === "cooum");
  const cooumLatestDO = cooum?.stations[0]?.readings.sort(
    (a, b) => b.year - a.year
  )[0]?.do_mgl;

  const hasPanel = selectedRiver !== null || selectedSource !== null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {qualityData.rivers.length} {t("rivers_page.rivers")} · {pollutionData.sources.length} {t("rivers_page.poll_sources")}
        </span>
        {cooum && cooumLatestDO !== undefined && cooumLatestDO !== null && (
          <span className="text-slate-500 dark:text-slate-400">
            {t("rivers_page.cooum_do")}{" "}
            <span
              className="font-semibold"
              style={{ color: QUALITY_COLORS[cooum.overall_status] }}
            >
              ~{cooumLatestDO} mg/L
            </span>{" "}
            <span className="text-xs">{t("rivers_page.aquatic_note")}</span>
          </span>
        )}
        <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto">
          {t("rivers_page.quality_data")} {qualityData.data_year_range[0]}-{qualityData.data_year_range[1]}
        </span>
      </div>

      {/* Map + panel area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className={`relative flex-1 ${hasPanel ? "h-[55vh] md:h-full" : "h-full"}`}>
          <CombinedRiversMap
            qualityData={qualityData}
            pollutionData={pollutionData}
            selectedRiver={selectedRiver}
            onSelectRiver={(sel) => { setSelectedRiver(sel); setSelectedSource(null); }}
            onSelectSource={(source) => { setSelectedSource(source); setSelectedRiver(null); }}
          />

          {/* Legend overlay  -  bottom left */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
            <RiversLegend />
          </div>

          {/* Source note overlay  -  top left */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("rivers_page.quality_label")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("rivers_page.quality_value")}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("rivers_page.sources_label")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("rivers_page.sources_value")}
              </span>
            </div>
          </div>
        </div>

        {/* Detail panel  -  bottom sheet on mobile, sidebar on desktop */}
        {hasPanel && (
          <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
            {selectedRiver && (
              <RiverPanel
                key={`${selectedRiver.riverId}-${selectedRiver.stationId ?? ""}`}
                selected={selectedRiver}
                qualityData={qualityData}
                onClose={() => setSelectedRiver(null)}
              />
            )}
            {selectedSource && (
              <PollutionPanel
                source={selectedSource}
                data={pollutionData}
                onClose={() => setSelectedSource(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

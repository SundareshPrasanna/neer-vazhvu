"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WaterBodyPanel } from "@/components/water-bodies/water-body-panel";
import { WaterBodiesLegend } from "@/components/water-bodies/water-bodies-legend";
import type { SelectedWaterBody, LostWaterBodyProperties } from "@/types/water-bodies";
import { useLanguage } from "@/lib/i18n/context";

function WaterBodiesMapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("wb.loading")}</span>
    </div>
  );
}

const WaterBodiesMap = dynamic(
  () =>
    import("@/components/water-bodies/water-bodies-map").then(
      (m) => m.WaterBodiesMap
    ),
  {
    ssr: false,
    loading: () => <WaterBodiesMapLoading />,
  }
);

interface LostGeoJSON {
  type: string;
  features: Array<{
    properties: LostWaterBodyProperties;
  }>;
}

export default function WaterBodiesPage() {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [stats, setStats] = useState<{
    lostCount: number;
    totalHaLost: number;
  } | null>(null);

  // Compute stats from the lost water bodies GeoJSON
  useEffect(() => {
    fetch("/geojson/chennai-water-bodies-lost.geojson")
      .then((r) => r.json())
      .then((data: LostGeoJSON) => {
        const lostCount = data.features.length;
        const totalHaLost = data.features.reduce((sum, f) => {
          const p = f.properties;
          const lost = p.historical_area_ha - (p.current_area_ha ?? 0);
          return sum + lost;
        }, 0);
        setStats({ lostCount, totalHaLost });
      })
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-70 flex-shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">1,635</span>{" "}
            {t("wb.existing")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70 flex-shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {stats?.lostCount ?? "—"}
            </span>{" "}
            {t("wb.lost")}
          </span>
        </div>
        {stats && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70 flex-shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                ~{Math.round(stats.totalHaLost / 100) * 100} ha
              </span>{" "}
              {t("wb.ha_lost")}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block">
          {t("wb.tagline")}
        </p>
      </div>

      {/* Map + panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div
          className={`relative flex-1 ${selected ? "h-[55vh] md:h-full" : "h-full"}`}
        >
          <WaterBodiesMap onSelect={setSelected} />

          {/* Legend overlay */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
            <WaterBodiesLegend />
          </div>

          {/* Source note overlay */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("wb.osm_source")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                OpenStreetMap
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("wb.lost_source")}{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t("wb.lost_source_value")}
              </span>
            </div>
          </div>
        </div>

        {/* Detail panel — bottom sheet on mobile, sidebar on desktop */}
        {selected && (
          <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
            <WaterBodyPanel selected={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

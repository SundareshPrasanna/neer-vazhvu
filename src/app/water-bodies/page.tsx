"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnifiedDetailPanel } from "@/components/water-bodies/unified-detail-panel";
import { UnifiedLegend } from "@/components/water-bodies/unified-legend";
import { ViewModeToggle } from "@/components/water-bodies/view-mode-toggle";
import type { ViewMode } from "@/components/water-bodies/view-mode-toggle";
import { RestorationRankingTable } from "@/components/lake-restoration/restoration-ranking-table";
import type { SelectedWaterBody, LostWaterBodyProperties } from "@/types/water-bodies";
import type { RestorationPriorityData, ScoredWaterBody } from "@/types/restoration";
import { getPriorityColor } from "@/types/restoration";
import { useLanguage } from "@/lib/i18n/context";

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("wb.loading")}</span>
    </div>
  );
}

const UnifiedMap = dynamic(
  () =>
    import("@/components/water-bodies/unified-map").then((m) => m.UnifiedMap),
  { ssr: false, loading: () => <MapLoading /> }
);

interface LostGeoJSON {
  type: string;
  features: Array<{ properties: LostWaterBodyProperties }>;
}

const PRIORITY_LEVELS = ["critical", "high", "moderate", "low"] as const;

export default function WaterBodiesPage() {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>("water-bodies");
  const [selected, setSelected] = useState<SelectedWaterBody | null>(null);
  const [restorationData, setRestorationData] = useState<RestorationPriorityData | null>(null);
  const [lostStats, setLostStats] = useState<{ lostCount: number; totalHaLost: number } | null>(null);

  // Build osm_id lookup for restoration data
  const scoreLookup = useMemo(() => {
    if (!restorationData) return new Map<number, ScoredWaterBody>();
    const map = new Map<number, ScoredWaterBody>();
    for (const wb of restorationData.water_bodies) map.set(wb.osm_id, wb);
    return map;
  }, [restorationData]);

  // Priority counts
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
    if (restorationData) {
      for (const wb of restorationData.water_bodies) counts[wb.priority_level]++;
    }
    return counts;
  }, [restorationData]);

  // Fetch restoration data
  useEffect(() => {
    fetch("/data/restoration-priority.json")
      .then((r) => r.json())
      .then((d: RestorationPriorityData) => setRestorationData(d))
      .catch(console.error);
  }, []);

  // Fetch lost stats
  useEffect(() => {
    fetch("/geojson/chennai-water-bodies-lost.geojson")
      .then((r) => r.json())
      .then((data: LostGeoJSON) => {
        const lostCount = data.features.length;
        const totalHaLost = data.features.reduce((sum, f) => {
          const p = f.properties;
          return sum + (p.historical_area_ha - (p.current_area_ha ?? 0));
        }, 0);
        setLostStats({ lostCount, totalHaLost });
      })
      .catch(console.error);
  }, []);

  // Find restoration data for the selected water body
  const selectedRestoration =
    selected?.kind === "current"
      ? scoreLookup.get(selected.props.osm_id) ?? null
      : null;

  // When ranking table selects a ScoredWaterBody, convert to SelectedWaterBody
  const handleRankingSelect = (wb: ScoredWaterBody) => {
    setSelected({
      kind: "current",
      props: {
        osm_id: wb.osm_id,
        osm_type: "",
        name: wb.name,
        name_ta: wb.name_ta,
        water_type: wb.water_type,
        area_ha: wb.area_ha,
      },
      latlng: wb.centroid,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center gap-x-5 overflow-x-auto">
        {viewMode === "water-bodies" ? (
          <>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="w-3 h-3 rounded-sm bg-blue-500 opacity-70 flex-shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">1,635</span>{" "}
                {t("wb.existing")}
              </span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <span className="w-3 h-3 rounded-sm bg-red-500 opacity-70 flex-shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {lostStats?.lostCount ?? "-"}
                </span>{" "}
                {t("wb.lost")}
              </span>
            </div>
            {lostStats && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="w-3 h-3 rounded-sm bg-orange-500 opacity-70 flex-shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    ~{Math.round(lostStats.totalHaLost / 100) * 100} ha
                  </span>{" "}
                  {t("wb.ha_lost")}
                </span>
              </div>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("wb.tagline")}
            </p>
          </>
        ) : (
          <>
            {restorationData && (
              <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{restorationData.total_scored.toLocaleString()}</span>{" "}
                  {t("lr.total_scored")}
                </span>
              </div>
            )}
            {PRIORITY_LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getPriorityColor(level) }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{priorityCounts[level]}</span>{" "}
                  {t(`lr.${level}`)}
                </span>
              </div>
            ))}
            <p className="text-xs text-slate-400 dark:text-slate-500 ml-auto hidden sm:block whitespace-nowrap">
              {t("lr.tagline")}
            </p>
          </>
        )}
      </div>

      {/* Main content with tabs */}
      <Tabs
        defaultValue="map"
        className="flex-1 flex flex-col overflow-hidden"
        onValueChange={(val) => {
          if (val === "ranking") setViewMode("restoration");
        }}
      >
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
          <TabsList variant="line" className="h-auto p-0 gap-6">
            <TabsTrigger
              value="map"
              className="px-1 py-2.5 text-sm font-medium border-none rounded-none data-[state=active]:border-none after:!bg-blue-600 after:!h-[2.5px] after:!rounded-full"
            >
              {t("lr.tab_map")}
            </TabsTrigger>
            <TabsTrigger
              value="ranking"
              className="px-1 py-2.5 text-sm font-medium border-none rounded-none data-[state=active]:border-none after:!bg-blue-600 after:!h-[2.5px] after:!rounded-full"
            >
              {t("lr.tab_ranking")}
            </TabsTrigger>
          </TabsList>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Map tab */}
        <TabsContent value="map" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
          <div className={`relative flex-1 ${selected ? "h-[55vh] md:h-full" : "h-full"}`}>
            <UnifiedMap
              viewMode={viewMode}
              scoredData={restorationData?.water_bodies ?? []}
              onSelectCurrent={setSelected}
              onSelectLost={setSelected}
            />
            <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
              <UnifiedLegend viewMode={viewMode} />
            </div>
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("wb.osm_source")}{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  OpenStreetMap
                </span>
              </div>
              {viewMode === "water-bodies" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("wb.lost_source")}{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {t("wb.lost_source_value")}
                  </span>
                </div>
              )}
              {viewMode === "restoration" && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t("lr.source_note")}
                </div>
              )}
            </div>
          </div>
          {selected && (
            <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
              <UnifiedDetailPanel
                selected={selected}
                restorationData={selectedRestoration}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </TabsContent>

        {/* Ranking table tab */}
        <TabsContent value="ranking" className="flex-1 m-0 flex flex-col md:flex-row overflow-hidden">
          <div className={`flex-1 ${selected ? "hidden md:block" : ""}`}>
            {restorationData && (
              <RestorationRankingTable
                data={restorationData.water_bodies}
                onSelect={handleRankingSelect}
              />
            )}
          </div>
          {selected && (
            <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
              <UnifiedDetailPanel
                selected={selected}
                restorationData={selectedRestoration}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

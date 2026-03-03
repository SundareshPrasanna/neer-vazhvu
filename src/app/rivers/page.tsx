"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RiverPanel } from "@/components/rivers/river-panel";
import { RiversLegend } from "@/components/rivers/rivers-legend";
import type { RiverQualityData, SelectedRiver } from "@/types/river-quality";
import { QUALITY_COLORS } from "@/types/river-quality";

// Leaflet must be loaded client-side only (no SSR)
const RiversMap = dynamic(
  () => import("@/components/rivers/rivers-map").then((m) => m.RiversMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">Loading map...</span>
      </div>
    ),
  }
);

export default function RiversPage() {
  const [qualityData, setQualityData] = useState<RiverQualityData | null>(null);
  const [selected, setSelected] = useState<SelectedRiver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/river-quality.json")
      .then((r) => r.json())
      .then((d: RiverQualityData) => {
        setQualityData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">
          Loading river quality data...
        </span>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            River Health Map
          </h1>
          <p>River quality data not available.</p>
        </div>
      </div>
    );
  }

  // Summary stats for the stats bar
  const cooum = qualityData.rivers.find((r) => r.id === "cooum");
  const cooumLatestDO = cooum?.stations[0]?.readings
    .sort((a, b) => b.year - a.year)[0]?.do_mgl;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {qualityData.rivers.length} rivers tracked
        </span>
        {cooum && cooumLatestDO !== undefined && cooumLatestDO !== null && (
          <span className="text-slate-500 dark:text-slate-400">
            Cooum DO:{" "}
            <span className="font-semibold" style={{ color: QUALITY_COLORS[cooum.overall_status] }}>
              ~{cooumLatestDO} mg/L
            </span>{" "}
            <span className="text-xs">(aquatic life needs ≥4 mg/L)</span>
          </span>
        )}
        <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto">
          Data updated: {qualityData.last_updated}
        </span>
      </div>

      {/* Map + panel area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className={`relative flex-1 ${selected ? "h-[55vh] md:h-full" : "h-full"}`}>
          <RiversMap qualityData={qualityData} onSelect={setSelected} />

          {/* Legend overlay */}
          <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
            <RiversLegend />
          </div>

          {/* Source note overlay */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Source:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                CPCB Annual Reports
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Data:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {qualityData.data_year_range[0]}–{qualityData.data_year_range[1]}
              </span>
            </div>
          </div>
        </div>

        {/* Detail panel — bottom sheet on mobile, sidebar on desktop */}
        {selected && (
          <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
            <RiverPanel
              selected={selected}
              qualityData={qualityData}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

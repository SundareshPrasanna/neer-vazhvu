"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WardDetailPanel } from "@/components/groundwater/ward-detail-panel";
import { GroundwaterLegend } from "@/components/groundwater/legend";
import type { GroundwaterWard, GroundwaterApiResponse, WardRiskData, RiskApiResponse, ViewMode } from "@/types/groundwater";

// Leaflet must be loaded client-side only (no SSR)
const WardMap = dynamic(() => import("@/components/groundwater/ward-map").then((m) => m.WardMap), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">Loading map...</span>
    </div>
  ),
});

export default function GroundwaterPage() {
  const [data, setData] = useState<GroundwaterApiResponse | null>(null);
  const [riskApiData, setRiskApiData] = useState<RiskApiResponse | null>(null);
  const [selectedWard, setSelectedWard] = useState<GroundwaterWard | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('depth');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/groundwater").then((r) => r.json()),
      fetch("/api/groundwater/risk").then((r) => r.json()),
    ])
      .then(([gw, risk]: [GroundwaterApiResponse, RiskApiResponse]) => {
        setData(gw);
        setRiskApiData(risk);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">Loading groundwater data...</span>
      </div>
    );
  }

  if (!data || !data.wards || data.wards.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Groundwater Map</h1>
          <p>No groundwater data available yet.</p>
          <p className="text-sm mt-2 font-mono bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1 rounded">
            npx tsx scripts/seed-opencity-groundwater.ts
          </p>
        </div>
      </div>
    );
  }

  const wardMap = new Map<number, GroundwaterWard>();
  for (const w of data.wards) {
    wardMap.set(w.wardNumber, w);
  }

  const riskMap = new Map<number, WardRiskData>();
  for (const r of riskApiData?.wards ?? []) {
    riskMap.set(r.wardNumber, r);
  }

  const selectedRisk = selectedWard ? riskMap.get(selectedWard.wardNumber) : undefined;
  const hasRiskData = riskMap.size > 0;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row">
      {/* Map area */}
      <div className={`relative flex-1 ${selectedWard ? "h-[55vh] md:h-full" : "h-full"}`}>
        <WardMap
          groundwaterData={wardMap}
          riskData={riskMap}
          viewMode={viewMode}
          onWardSelect={setSelectedWard}
        />

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
          <GroundwaterLegend viewMode={viewMode} />
        </div>

        {/* Period + view toggle overlay */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing data for{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(data.period.year, data.period.month - 1).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          {data.cityAverage !== null && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              City average: <span className="font-semibold">{data.cityAverage}m</span>
            </div>
          )}
        </div>

        {/* View mode toggle — only shown when risk data is available */}
        {hasRiskData && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000]">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 shadow-md text-xs font-medium">
              <button
                onClick={() => setViewMode('depth')}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === 'depth'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Depth
              </button>
              <button
                onClick={() => setViewMode('risk')}
                className={`px-3 py-1.5 transition-colors border-l border-slate-200 dark:border-slate-600 ${
                  viewMode === 'risk'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Risk Score
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel — bottom sheet on mobile, sidebar on desktop */}
      {selectedWard && (
        <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
          <WardDetailPanel
            ward={selectedWard}
            riskData={selectedRisk}
            onClose={() => setSelectedWard(null)}
          />
        </div>
      )}
    </div>
  );
}

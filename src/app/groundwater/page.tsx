"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WardDetailPanel } from "@/components/groundwater/ward-detail-panel";
import { GroundwaterLegend } from "@/components/groundwater/legend";
import type { GroundwaterWard, GroundwaterApiResponse } from "@/types/groundwater";

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
  const [selectedWard, setSelectedWard] = useState<GroundwaterWard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/groundwater")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
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

  // Build a Map for quick lookup
  const wardMap = new Map<number, GroundwaterWard>();
  for (const w of data.wards) {
    wardMap.set(w.wardNumber, w);
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row">
      {/* Map area */}
      <div className={`relative flex-1 ${selectedWard ? "h-[55vh] md:h-full" : "h-full"}`}>
        <WardMap groundwaterData={wardMap} onWardSelect={setSelectedWard} />

        {/* Legend overlay */}
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 z-[1000]">
          <GroundwaterLegend />
        </div>

        {/* Period info overlay */}
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
      </div>

      {/* Detail panel — bottom sheet on mobile, sidebar on desktop */}
      {selectedWard && (
        <div className="h-[45vh] md:h-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700">
          <WardDetailPanel ward={selectedWard} onClose={() => setSelectedWard(null)} />
        </div>
      )}
    </div>
  );
}

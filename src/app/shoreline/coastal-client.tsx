"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BottomSheet } from "@/components/map/bottom-sheet";
import { MapInfoButton } from "@/components/map/map-info-button";
import { CoastalLegend } from "@/components/coastal/coastal-legend";
import { CoastalDetailPanel } from "@/components/coastal/coastal-detail-panel";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";
import type { SelectedCoastal, CoastalSummary } from "@/types/coastal";

function MapLoading() {
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">Loading map…</span>
    </div>
  );
}

const CoastalMap = dynamic(
  () => import("@/components/coastal/coastal-map").then((m) => m.CoastalMap),
  { ssr: false, loading: () => <MapLoading /> },
);

const STUDY_URL = "https://www.sciencedirect.com/science/article/pii/S2667010026001083";

export default function CoastalClient() {
  useLockBodyScroll();
  const [selected, setSelected] = useState<SelectedCoastal | null>(null);
  const [summary, setSummary] = useState<CoastalSummary | null>(null);
  // Pre-select the worst-eroding transect once the data loads, so the panel
  // opens with a clear, self-explanatory example. Runs in the map's data-load
  // callback (not an effect), and only the first time; the user is in control
  // after that.
  const didAutoSelect = useRef(false);
  const handleSummary = (s: CoastalSummary) => {
    setSummary(s);
    if (!didAutoSelect.current && s.featured) {
      didAutoSelect.current = true;
      setSelected({ kind: "transect", props: s.featured });
    }
  };

  const accelPct =
    summary && summary.erodingWithSplit > 0
      ? Math.round((100 * summary.acceleratingErosion) / summary.erodingWithSplit)
      : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats / context bar - our measurement leads; the study validates. */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          Chennai shoreline change - {summary?.period ?? "1990-2026"}
        </span>
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <span className="w-3 h-3 rounded-sm bg-red-600 opacity-80" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary?.eroding ?? 387}</span> eroding
            {" / "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{summary?.total ?? 905}</span> transects
          </span>
        </div>
        {accelPct != null && (
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span className="w-3 h-3 rounded-sm bg-red-700 opacity-80" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{accelPct}%</span> eroding{" "}
              <span className="font-semibold">faster</span> than before
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
            Corroborated by{" "}
            <a href={STUDY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">
              Anagha et al. (2026)
            </a>
          </span>
          <Link
            href="/facts#bucket-coastal"
            className="text-xs text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Coastal facts →
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="relative flex-1 h-full">
          <CoastalMap selected={selected} onSelect={setSelected} onSummary={handleSummary} />

          {/* Legend overlay */}
          <div
            className={`absolute z-[1000] transition-[bottom] duration-300 left-2 right-auto md:left-auto md:right-4 ${
              selected ? "bottom-[148px] md:bottom-4" : "bottom-2 md:bottom-4"
            }`}
          >
            <CoastalLegend />
          </div>

          {/* Sources / honesty note */}
          <MapInfoButton className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000]">
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 max-w-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">What you see:</span> each dot is a
                100 m transect along the coast, coloured by how fast its shoreline is eroding (red) or accreting (blue),
                from our own measurement - an MNDWI water index on Landsat + Sentinel-2 via Google Earth Engine, 10
                epochs 1990-2026.
              </div>
              <div>
                The faint grey bands are the six study zones and the larger labelled dots are named hotspots, both from{" "}
                <a href={STUDY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 dark:text-slate-300 underline">
                  Anagha, Singh &amp; Frappart (2026)
                </a>
                . Our independent method matches the study&apos;s pattern; absolute rates differ (fixed MNDWI threshold,
                no tidal correction), so the study serves as validation.
              </div>
            </div>
          </MapInfoButton>
        </div>

        {selected ? (
          <BottomSheet onClose={() => setSelected(null)}>
            <CoastalDetailPanel selected={selected} onClose={() => setSelected(null)} />
          </BottomSheet>
        ) : null}
      </div>
    </div>
  );
}
